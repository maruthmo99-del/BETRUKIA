import { useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../firebase.js";
import { API_URL } from "../config/api.js";

function normalizeAuthIdentifier(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed;

  const digitsOnly = trimmed.replace(/\D/g, "");
  const looksLikePhone = digitsOnly.length >= 10 && digitsOnly.length <= 15;
  if (!looksLikePhone) return trimmed;

  return `phone_${digitsOnly}@rukia.local`;
}

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appUser, setAppUser] = useState(null); // { id, username, email, balance, isAdmin }
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setAppUser(null);
        setIdToken(null);
        setLoading(false);
        return;
      }
      console.log("[useAuth] onAuthStateChanged: user present", { uid: user.uid, email: user.email });
      try {
        const token = await user.getIdToken();
        console.log("[useAuth] got idToken (length)", token?.length);
        setIdToken(token);
        let res;
        try {
          res = await fetch(`${API_URL}/api/auth/session`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (fetchErr) {
          console.error("[useAuth] session fetch failed -", fetchErr.message, "API_URL:", API_URL);
          throw fetchErr;
        }
        console.log("[useAuth] session response", res.status);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to sync session");
        setAppUser(data.user);
        setAuthError(null);
      } catch (err) {
        console.error("[useAuth] session error:", err);
        setAuthError(err.message || "Unable to sign you in right now.");
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Always fetch a fresh token for REST calls / (re)connecting the socket —
  // Firebase ID tokens expire hourly, and getIdToken() transparently
  // refreshes an expired cached one under the hood.
  const getFreshIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    const token = await auth.currentUser.getIdToken();
    setIdToken(token);
    return token;
  }, []);

  const refreshSession = useCallback(async () => {
    const token = await getFreshIdToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setAppUser(data.user);
    } catch (err) {
      // ignore
    }
  }, [getFreshIdToken]);

  const signUp = useCallback(async ({ name, phone, identifier, password, referralCode }) => {
    setAuthError(null);
    try {
      const authIdentifier = normalizeAuthIdentifier(identifier);
      const cred = await createUserWithEmailAndPassword(auth, authIdentifier, password);
      if (cred.user && name) {
        await updateProfile(cred.user, { displayName: name });
      }

      const token = await cred.user.getIdToken();
      
      // Attach referral code if present
      if (referralCode) {
        try {
          await fetch(`${API_URL}/api/referrals/attach`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ code: referralCode }),
          });
        } catch (e) {
          console.error("Failed to attach referral code:", e);
        }
      }

      console.log("[useAuth] signUp: Firebase auth succeeded, updating profile at", `${API_URL}/api/auth/profile`);
      let profileRes;
      try {
        profileRes = await fetch(`${API_URL}/api/auth/profile`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: name, phone }),
        });
      } catch (fetchErr) {
        console.error("[useAuth] signUp: profile fetch failed -", fetchErr.message, "API_URL:", API_URL);
        throw new Error(`Cannot reach server at ${API_URL} - ${fetchErr.message}`);
      }
      const profileData = await profileRes.json().catch(() => ({}));
      if (!profileRes.ok) throw new Error(profileData.error || "Unable to finish account setup.");

      if (profileData.user) {
        setAppUser(profileData.user);
      } else {
        let sessionRes;
        try {
          sessionRes = await fetch(`${API_URL}/api/auth/session`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (fetchErr) {
          console.error("[useAuth] signUp: session fetch failed -", fetchErr.message, "API_URL:", API_URL);
          throw new Error(`Cannot reach server at ${API_URL} - ${fetchErr.message}`);
        }
        const sessionData = await sessionRes.json().catch(() => ({}));
        if (!sessionRes.ok) throw new Error(sessionData.error || "Unable to finish sign-in.");
        setAppUser(sessionData.user);
      }
      setAuthError(null);
    } catch (err) {
      setAuthError(friendlyFirebaseError(err));
      throw err;
    }
  }, []);

  const signIn = useCallback(async (identifier, password) => {
    setAuthError(null);
    try {
      const authIdentifier = normalizeAuthIdentifier(identifier);
      const cred = await signInWithEmailAndPassword(auth, authIdentifier, password);
      const token = await cred.user.getIdToken();
      console.log("[useAuth] signIn: Firebase auth succeeded, fetching session from", `${API_URL}/api/auth/session`);
      let res;
      try {
        res = await fetch(`${API_URL}/api/auth/session`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (fetchErr) {
        console.error("[useAuth] signIn: fetch failed -", fetchErr.message, "API_URL:", API_URL);
        throw new Error(`Cannot reach server at ${API_URL} - ${fetchErr.message}`);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to finish sign-in.");
      setAppUser(data.user);
      setAuthError(null);
    } catch (err) {
      setAuthError(friendlyFirebaseError(err));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  // Re-fetch just the wallet balance portion of appUser (e.g. after a bet).
  const refreshBalance = useCallback(async () => {
    const token = await getFreshIdToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/api/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) setAppUser((u) => (u ? { ...u, balance: data.balance } : u));
  }, [getFreshIdToken]);

  return {
    firebaseUser,
    appUser,
    idToken,
    loading,
    authError,
    signUp,
    signIn,
    refreshSession,
    logout,
    getFreshIdToken,
    refreshBalance,
  };
}

function friendlyFirebaseError(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "That email or phone login is already registered — try logging in.";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Incorrect email/phone or password.";
  if (code.includes("user-not-found")) return "No account found with that email or phone number.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("invalid-email")) return "That doesn't look like a valid email address.";
  return err?.message || "Something went wrong. Please try again.";
}
