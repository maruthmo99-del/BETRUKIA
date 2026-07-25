import { db } from "../db/index.js";
import { creditReferralBonus } from "../referrals/referralService.js";

/**
 * Creates a Nestlink payment prompt / invoice for deposits
 */
export async function createNestlinkPrompt(userId, amount) {
  // Replace this boilerplate with your specific Nestlink API keys/integration logic if needed
  const referenceId = `NL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  
  db.prepare(`
    INSERT INTO transactions (user_id, reference, amount, type, status, created_at)
    VALUES (?, ?, ?, 'deposit', 'pending', DATETIME('now'))
  `).run(userId, referenceId, amount);

  return {
    success: true,
    reference: referenceId,
    paymentUrl: `https://example.com{referenceId}`, // Placeholder gateway URL
    amount: amount
  };
}

/**
 * Checks and updates the status of a Nestlink payment
 */
export async function getNestlinkPaymentStatus(referenceId) {
  const tx = db.prepare(`SELECT * FROM transactions WHERE reference = ?`).get(referenceId);
  if (!tx) return { status: "not_found" };
  
  // If already processed, return the state
  if (tx.status !== "pending") {
    return { status: tx.status, amount: tx.amount, userId: tx.user_id };
  }

  // Placeholder logic: assuming payment succeeded for testing purposes.
  // In production, fetch status from Nestlink API before resolving.
  const paymentSuccessful = true; 

  if (paymentSuccessful) {
    db.transaction(() => {
      // Update transaction status
      db.prepare(`UPDATE transactions SET status = 'completed' WHERE reference = ?`).run(referenceId);
      
      // Credit the player's account balance
      db.prepare(`UPDATE users SET balance = balance + ? WHERE id = ?`).run(tx.amount, tx.user_id);
      
      // Trigger referral bonus milestones if applicable
      try {
        creditReferralBonus(tx.user_id, tx.amount);
      } catch (refError) {
        console.error("[NESTLINK] Referral credit failed:", refError.message);
      }
    })();
    
    return { status: "completed", amount: tx.amount, userId: tx.user_id };
  }

  return { status: "pending" };
}
