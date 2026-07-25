import { db } from "./index.js";

export function getInitialBalanceCents() {
  return 0;
}

export function recordWalletTransaction({ userId, kind, amountCents, meta = null }) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("userId is required");
  }

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be a positive integer");
  }

  const tx = db
    .prepare(
      `INSERT INTO wallet_transactions (user_id, kind, amount_cents, meta, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .run(userId, kind, amountCents, meta ? JSON.stringify(meta) : null);

  const transactionId = Number(tx.lastInsertRowid);
  if (kind === "deposit") {
    const bonusCents = Math.round(amountCents * 0.5);
    db.prepare(`UPDATE users SET balance = balance + ? WHERE id = ?`).run(amountCents + bonusCents, userId);
  } else if (kind === "withdrawal") {
    db.prepare(`UPDATE users SET balance = balance - ? WHERE id = ?`).run(amountCents, userId);
  }

  return db.prepare(`SELECT * FROM wallet_transactions WHERE id = ?`).get(transactionId);
}

export function getWalletTransactionsForUser(userId) {
  return db
    .prepare(
      `SELECT id, user_id, kind, amount_cents, meta, created_at
       FROM wallet_transactions
       WHERE user_id = ?
       ORDER BY id DESC`
    )
    .all(userId);
}
