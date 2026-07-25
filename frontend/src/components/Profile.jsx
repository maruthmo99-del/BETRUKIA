import { useState } from "react";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { useAuth } from "../hooks/useAuth.js";
import { API_URL } from "../config/api.js";

export default function Profile() {
  const { appUser, getFreshIdToken, refreshSession } = useAuth();
  const [displayName, setDisplayName] = useState(appUser?.username || "");
  const [phone, setPhone] = useState(appUser?.phone || "");
  const [saving, setSaving] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [verificationInProgress, setVerificationInProgress] = useState(false);
  const [message, setMessage] = useState(null);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getFreshIdToken();
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      await refreshSession();
      setMessage("Profile updated");
    } catch (err) {
      setMessage(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function startPhoneVerification() {
    setMessage(null);
    try {
      const auth = getAuth();
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          "recaptcha-container",
          { size: "invisible" },
          auth
        );
      }
      setVerificationInProgress(true);
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, phone, appVerifier);
      window._phoneConfirmation = confirmation;
      setSmsSent(true);
      setMessage("SMS sent — enter the code to confirm.");
    } catch (err) {
      setMessage(err.message || "Failed to send SMS");
    } finally {
      setVerificationInProgress(false);
    }
  }

  async function confirmSmsCode() {
    setMessage(null);
    try {
      const confirmation = window._phoneConfirmation;
      if (!confirmation) throw new Error("No SMS confirmation present");
      await confirmation.confirm(smsCode);
      const token = await getFreshIdToken();
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) throw new Error("Failed to persist phone");
      await refreshSession();
      setMessage("Phone verified and saved.");
      setSmsSent(false);
      setSmsCode("");
    } catch (err) {
      setMessage(err.message || "Verification failed");
    }
  }

  return (
    <div className="profile-panel centered">
      <h2>My Profile</h2>
      <form onSubmit={saveProfile} className="profile-form">
        <label>Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <label>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2547XXXXXXXX" />
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
      </form>

      <div style={{ marginTop: 16 }}>
        <div id="recaptcha-container" />
        {!smsSent ? (
          <>
            <button onClick={startPhoneVerification} disabled={verificationInProgress || !phone} className="secondary-action">
              {verificationInProgress ? "Sending…" : "Verify phone via SMS"}
            </button>
          </>
        ) : (
          <>
            <label>SMS code</label>
            <input value={smsCode} onChange={(e) => setSmsCode(e.target.value)} placeholder="123456" />
            <button onClick={confirmSmsCode} className="primary-action">Confirm code</button>
          </>
        )}
      </div>

      {message && <div className="muted" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  );
}
