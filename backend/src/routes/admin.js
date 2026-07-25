import { Router } from "express";
import { db } from "../db/index.js";
import { requireAdmin } from "./middleware.js";

const router = Router();
router.use(requireAdmin);

// Headline numbers: how many users/rounds/bets, total money in motion,
// and the house's position (wagered - paid out).
router.get("/stats", (_req, res) => {
  const userCount = db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;
  const roundCount = db.prepare(`SELECT COUNT(*) AS n FROM rounds WHERE status = 'crashed'`).get().n;
  const betStats = db
    .prepare(
      `SELECT
         COUNT(*) AS betCount,
         COALESCE(SUM(amount), 0) AS totalWagered,
         COALESCE(SUM(CASE WHEN status = 'cashed_out' THEN payout ELSE 0 END), 0) AS totalPaidOut
       FROM bets`
    )
    .get();

  res.json({
    userCount,
    roundCount,
    betCount: betStats.betCount,
    totalWageredCents: betStats.totalWagered,
    totalPaidOutCents: betStats.totalPaidOut,
    houseProfitCents: betStats.totalWagered - betStats.totalPaidOut,
  });
});

router.get("/rounds", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const rounds = db
    .prepare(
      `SELECT r.id, r.crash_point, r.created_at,
              (SELECT COUNT(*) FROM bets b WHERE b.round_id = r.id) AS betCount,
              (SELECT COALESCE(SUM(amount),0) FROM bets b WHERE b.round_id = r.id) AS wagered,
              (SELECT COALESCE(SUM(payout),0) FROM bets b WHERE b.round_id = r.id AND b.status='cashed_out') AS paidOut
       FROM rounds r
       WHERE r.status = 'crashed'
       ORDER BY r.id DESC LIMIT ?`
    )
    .all(limit);
  res.json({ rounds });
});

router.get("/users", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const users = db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.balance, u.is_admin, u.created_at,
              COALESCE((SELECT SUM(amount) FROM bets b WHERE b.user_id = u.id), 0) AS totalWagered,
              COALESCE((SELECT SUM(payout) FROM bets b WHERE b.user_id = u.id AND b.status = 'cashed_out'), 0) AS totalWon
       FROM users u
       ORDER BY u.id DESC LIMIT ?`
    )
    .all(limit);
  res.json({
    users: users.map((u) => ({
      ...u,
      username: u.display_name || (u.email ? u.email.split("@")[0] : `player${u.id}`),
    })),
  });
});

export default router;
