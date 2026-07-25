import { db } from "../db/index.js";
import { verifyFirebaseIdToken } from "../auth/firebaseVerify.js";
import { getOrCreateDemoUser, getOrCreateUserByFirebaseUid } from "../auth/userSync.js";

// Verifies the Firebase ID token in the Authorization header, syncs/creates
// the corresponding local user row, and attaches req.userId / req.isAdmin.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token provided" });

  const idToken = header.replace("Bearer ", "");
  try {
    const identity = await verifyFirebaseIdToken(idToken);
    const user = getOrCreateUserByFirebaseUid(identity);
    req.userId = user.id;
    req.firebaseUid = identity.uid;
    req.isAdmin = !!user.is_admin;
    next();
  } catch (err) {
    // Debug: log verification failure reason (no token contents)
    console.error("[AUTH] token verification failed:", err?.message);
    return res.status(401).json({ error: "Invalid or expired token: " + err.message });
  }
}

// Re-checks admin status against the DB rather than trusting a cached
// claim, since a user's admin flag could change between requests.
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const user = db.prepare(`SELECT is_admin FROM users WHERE id = ?`).get(req.userId);
    if (!user?.is_admin) return res.status(403).json({ error: "Admin access required" });
    next();
  });
}

export async function verifySocketAuth(idToken) {
  try {
    // Lightweight demo token support
    if (idToken === "demo") {
      const demo = getOrCreateDemoUser();
      return { userId: demo.id, firebaseUid: demo.firebase_uid, isAdmin: !!demo.is_admin };
    }

    const identity = await verifyFirebaseIdToken(idToken);
    const user = getOrCreateUserByFirebaseUid(identity);
    return { userId: user.id, firebaseUid: identity.uid, isAdmin: !!user.is_admin };
  } catch {
    return null;
  }
}
