import { Router } from "express";
import { requireAuth } from "./middleware.js";
import { 
  codeForUserId, 
  attachReferral, 
  getReferralStats, 
  withdrawReferralEarnings 
} from "../referrals/referralService.js";

const router = Router();

// Get referral info and dashboard stats for the current user
router.get("/", requireAuth, (req, res) => {
  try {
    const stats = getReferralStats(req.userId);
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ties incoming referral code to a user
router.post("/attach", requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.json({ attached: false });
  const result = attachReferral(req.userId, code);
  res.json(result);
});

// Referral withdrawal request
router.post("/withdraw", requireAuth, (req, res) => {
  try {
    const { amount, mpesaNumber, mpesaName } = req.body;
    const amountCents = Math.round(Number(amount) * 100);
    
    const result = withdrawReferralEarnings(req.userId, amountCents, mpesaNumber, mpesaName);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
