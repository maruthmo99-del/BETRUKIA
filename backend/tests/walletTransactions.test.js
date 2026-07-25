import test from "node:test";
import assert from "node:assert/strict";
import { getInitialBalanceCents, recordWalletTransaction, getWalletTransactionsForUser } from "../src/db/walletTransactions.js";
import { db } from "../src/db/index.js";

test("real accounts start with zero balance until a deposit is recorded", () => {
  assert.equal(getInitialBalanceCents(), 0);
});

test("deposit transactions are recorded and update balance", () => {
  const userId = Number(
    db
      .prepare(`INSERT INTO users (firebase_uid, email, display_name, balance) VALUES (?, ?, ?, ?) RETURNING id`)
      .run(`wallet-test-${Date.now()}`, "wallet@test.com", "Wallet Test", 0).lastInsertRowid
  );

  try {
    const tx = recordWalletTransaction({ userId, kind: "deposit", amountCents: 2500, meta: { source: "test" } });
    assert.equal(tx.kind, "deposit");
    assert.equal(tx.amount_cents, 2500);

    const balance = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(userId).balance;
    assert.equal(balance, 3750);

    const history = getWalletTransactionsForUser(userId);
    assert.equal(history.length, 1);
    assert.equal(history[0].amount_cents, 2500);
  } finally {
    db.prepare(`DELETE FROM wallet_transactions WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
  }
});
