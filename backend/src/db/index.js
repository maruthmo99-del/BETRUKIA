import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const db = new DatabaseSync(path.join(__dirname, "omoka.sqlite"));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT,
  display_name TEXT,
  phone TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  referral_balance INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  meta TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reference TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_seed TEXT NOT NULL,
  seed_hash TEXT NOT NULL,
  client_seed TEXT NOT NULL,
  crash_point INTEGER, -- hundredths, e.g. 235 = 2.35x
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting | flying | crashed
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  slot INTEGER NOT NULL DEFAULT 1, -- 1 or 2 — players may run two concurrent bets per round
  amount INTEGER NOT NULL, -- cents
  auto_cashout_multiplier INTEGER, -- hundredths; null = manual cashout only
  cashout_multiplier INTEGER, -- hundredths, null if not cashed out
  payout INTEGER, -- cents
  status TEXT NOT NULL DEFAULT 'active', -- active | cashed_out | lost
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (round_id) REFERENCES rounds(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  text TEXT NOT NULL,
  reply_to INTEGER,
  from_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, -- the user who triggered the event (could be the referred user)
  referral_code TEXT, -- optional code used
  event_type TEXT NOT NULL, -- impression | click | signup | deposit | conversion
  amount INTEGER, -- cents when relevant
  meta TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_user_id INTEGER NOT NULL,
  invitee_email TEXT,
  invitee_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | converted
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Config: kept here so both the round manager and the REST config
// endpoint read the same source of truth.
export const GAME_CONFIG = {
  MIN_BET_CENTS: 1000, // KES 10.00
  MAX_BET_CENTS: 5_000_000, // KES 50,000.00
  MAX_BETS_PER_ROUND: 2, // number of concurrent bet slots per player
  MAX_AUTO_CASHOUT: 2_000_000, // 20,000.00x ceiling — matches MAX_CRASH_MULTIPLIER in provablyFair.js
};

export default db;

// Ensure older databases get the `phone` column added if missing.
try {
  const info = db.prepare("PRAGMA table_info(users)").all();
  const hasPhone = info.some((c) => c.name === "phone");
  if (!hasPhone) {
    try {
      db.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
    } catch (e) {
      // ignore; if it fails, it's non-fatal for older installs
    }
  }
  // Tracks which user's referral link/code this account signed up through.
  // Set once, on first login, and never overwritten afterwards.
  const hasReferredBy = info.some((c) => c.name === "referred_by_user_id");
  if (!hasReferredBy) {
    try {
      db.prepare("ALTER TABLE users ADD COLUMN referred_by_user_id INTEGER").run();
    } catch (e) {
      // ignore; if it fails, it's non-fatal for older installs
    }
  }
  const hasReferralBalance = info.some((c) => c.name === "referral_balance");
  if (!hasReferralBalance) {
    try {
      db.prepare("ALTER TABLE users ADD COLUMN referral_balance INTEGER DEFAULT 0").run();
    } catch (e) {
      // ignore
    }
  }
} catch (e) {
  // ignore any introspection errors
}