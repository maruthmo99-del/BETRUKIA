import { Router } from "express";
import { db } from "../db/index.js";

const router = Router();

// Net profit per player = total payouts (cashed_out bets) - total wagered
// (all settled bets: cashed_out or lost). "window" controls the lookback:
// '24h' for a rolling daily leaderboard, 'all' for all-time.
router.get("/", (req, res) => {
  const window = req.query.window === "all" ? "all" : "24h";
  const cutoffClause = window === "24h" ? `AND b.created_at >= datetime('now', '-1 day')` : "";

  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.display_name,
              COALESCE(SUM(CASE WHEN b.status = 'cashed_out' THEN b.payout ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN b.status IN ('cashed_out','lost') THEN b.amount ELSE 0 END), 0)
                AS netProfit,
              COUNT(CASE WHEN b.status IN ('cashed_out','lost') THEN 1 END) AS betsPlayed,
              MAX(CASE WHEN b.status = 'cashed_out' THEN b.cashout_multiplier ELSE NULL END) AS bestMultiplier
       FROM bets b
       JOIN users u ON u.id = b.user_id
       WHERE b.status IN ('cashed_out', 'lost') ${cutoffClause}
       GROUP BY u.id
       HAVING betsPlayed > 0
       ORDER BY netProfit DESC
       LIMIT 10`
    )
    .all()
    .map((r) => ({
      username: r.display_name || (r.email ? r.email.split("@")[0] : `player${r.id}`),
      netProfit: r.netProfit,
      betsPlayed: r.betsPlayed,
      bestMultiplier: r.bestMultiplier,
    }));

  res.json({ window, leaderboard: rows });
});

export default router;
