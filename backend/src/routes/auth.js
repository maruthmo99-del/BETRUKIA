import { Router } from "express";
import { requireAuth } from "./middleware.js";
import { db } from "../db/index.js";
import { displayNameFor } from "../auth/userSync.js";
import { getOrCreateDemoUser } from "../auth/userSync.js";

const router = Router();

// Called once after the client signs in/up with Firebase. requireAuth
// already verified the token and created/looked-up the local user row;
// this just returns that row's app-specific state (balance, admin flag)
// in the shape the frontend expects.
router.post("/session", requireAuth, (req, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.userId);
  res.json({
    user: {
      id: user.id,
      username: displayNameFor(user),
      phone: user.phone || null,
      email: user.email,
      balance: user.balance,
      isAdmin: !!user.is_admin,
    },
  });
});

// Update the local profile (display name and phone). Called by the
// client once after registration completes to persist extra fields
// that are not present in the Firebase ID token.
router.post("/profile", requireAuth, (req, res) => {
  const { displayName, phone } = req.body || {};
  if (!displayName && !phone) return res.status(400).json({ error: "Nothing to update" });
  const updates = [];
  const params = [];
  if (displayName) {
    updates.push("display_name = ?");
    params.push(displayName);
  }
  if (phone) {
    updates.push("phone = ?");
    params.push(phone);
  }
  params.push(req.userId);
  const stmt = db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`);
  stmt.run(...params);
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.userId);
  res.json({ user: { id: user.id, username: displayNameFor(user), email: user.email, balance: user.balance, isAdmin: !!user.is_admin } });
});

// Create or retrieve a server-side demo account and return a demo token.
// This is intentionally lightweight: the "token" is the literal string "demo",
// and sockets/clients will present it to identify as the demo user.
router.post("/demo", (_req, res) => {
  try {
    const user = getOrCreateDemoUser();
    res.json({ token: "demo", user: { id: user.id, username: displayNameFor(user), phone: user.phone || null, email: user.email || null, balance: user.balance, isAdmin: !!user.is_admin } });
  } catch (err) {
    res.status(500).json({ error: "Failed to create demo account" });
  }
});

export default router;

