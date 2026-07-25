import { Router } from "express";
import { db, GAME_CONFIG } from "../db/index.js";
import { requireAuth } from "./middleware.js";

const router = Router();

router.get("/config", (_req, res) => {
  res.json({
    minBetCents: GAME_CONFIG.MIN_BET_CENTS,
    maxBetCents: GAME_CONFIG.MAX_BET_CENTS,
    maxBetsPerRound: GAME_CONFIG.MAX_BETS_PER_ROUND,
    maxAutoCashout: GAME_CONFIG.MAX_AUTO_CASHOUT,
  });
});

router.get("/balance", requireAuth, (req, res) => {
  const user = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(req.userId);
  res.json({ balance: user?.balance ?? 0 });
});

router.get("/history", requireAuth, (req, res) => {
  const bets = db
    .prepare(
      `SELECT b.id, b.round_id, b.slot, b.amount, b.auto_cashout_multiplier, b.cashout_multiplier,
              b.payout, b.status, b.created_at, r.crash_point
       FROM bets b JOIN rounds r ON r.id = b.round_id
       WHERE b.user_id = ?
       ORDER BY b.id DESC LIMIT 50`
    )
    .all(req.userId);

  const walletTransactions = db
    .prepare(
      `SELECT id, kind, amount_cents, meta, created_at
       FROM wallet_transactions
       WHERE user_id = ?
       ORDER BY id DESC`
    )
    .all(req.userId);

  res.json({ bets, walletTransactions });
});

router.get("/rounds/recent", (_req, res) => {
  const rounds = db
    .prepare(
      `SELECT id, crash_point, created_at FROM rounds WHERE status = 'crashed' ORDER BY id DESC LIMIT 30`
    )
    .all();
  res.json({ rounds });
});

// Fairness verification endpoint — anyone can check a past round
router.get("/rounds/:id/verify", (req, res) => {
  const round = db.prepare(`SELECT * FROM rounds WHERE id = ?`).get(req.params.id);
  if (!round) return res.status(404).json({ error: "Round not found" });
  if (round.status !== "crashed") return res.status(400).json({ error: "Round not finished yet" });
  res.json({
    roundId: round.id,
    serverSeed: round.server_seed,
    seedHash: round.seed_hash,
    clientSeed: round.client_seed,
    crashPoint: round.crash_point,
  });
});

export default router;
