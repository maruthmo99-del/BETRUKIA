import { db } from "../db/index.js";

/**
 * Looks up (or creates) the local users-table row for a Firebase-verified
 * identity. Firebase owns authentication; we still need a local row for
 * wallet balance, admin flag, and to keep bets/rounds foreign keys as
 * plain integers.
 *
 * Demo convenience: the very first account ever created becomes admin —
 * same rule as before, just triggered on first Firebase sign-in instead
 * of first registration. A real deployment should manage admin status
 * explicitly instead.
 */
export function getOrCreateUserByFirebaseUid({ uid, email, name }) {
  const existing = db.prepare(`SELECT * FROM users WHERE firebase_uid = ?`).get(uid);
  if (existing) return existing;

  const userCount = db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;
  const isAdmin = userCount === 0 ? 1 : 0;

  const info = db
    .prepare(
      `INSERT INTO users (firebase_uid, email, display_name, is_admin, balance) VALUES (?, ?, ?, ?, ?)`
    )
    .run(uid, email || null, name || null, isAdmin, 0);

  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(Number(info.lastInsertRowid));
}

// Convenience for display: prefer a display name, fall back to the email's
// local part, fall back to "player<id>" if we have neither.
export function displayNameFor(userRow) {
  if (userRow.display_name) return userRow.display_name;
  if (userRow.email) return userRow.email.split("@")[0];
  return `player${userRow.id}`;
}

export function getOrCreateDemoUser() {
  const existing = db.prepare(`SELECT * FROM users WHERE firebase_uid = ?`).get("demo");
  if (existing) return existing;

  const info = db
    .prepare(
      `INSERT INTO users (firebase_uid, email, display_name, is_admin, balance) VALUES (?, ?, ?, ?, ?)`
    )
    .run("demo", null, "Demo Player", 0, 1000000);

  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(Number(info.lastInsertRowid));
}
