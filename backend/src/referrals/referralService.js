import { db } from "../db/index.js";

/**
 * Generates or retrieves a 4-character alpha-numeric referral code for a user.
 */
export function codeForUserId(userId) {
  let row = db.prepare(`SELECT code FROM referral_codes WHERE user_id = ?`).get(userId);
  if (!row) {
    // Generate a short 4-character alpha-numeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let uniqueCode = '';
    let isUnique = false;
    
    while (!isUnique) {
      uniqueCode = '';
      for (let i = 0; i < 4; i++) {
        uniqueCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = db.prepare(`SELECT code FROM referral_codes WHERE code = ?`).get(uniqueCode);
      if (!existing) isUnique = true;
    }

    db.prepare(`INSERT INTO referral_codes (user_id, code) VALUES (?, ?)`).run(userId, uniqueCode);
    return uniqueCode;
  }
  return row.code;
}

/**
 * Links a newly registered user to an inviter using the code.
 */
export function attachReferral(userId, code) {
  if (!code) return { attached: false };

  const inviterRow = db.prepare(`SELECT user_id FROM referral_codes WHERE code = ?`).get(code);
  if (!inviterRow || inviterRow.user_id === userId) {
    return { attached: false };
  }

  // Ensure this user has not already been referred before
  const existing = db.prepare(`SELECT id FROM referrals WHERE invitee_user_id = ?`).get(userId);
  if (existing) return { attached: false };

  // Update user's referred_by_user_id
  db.prepare(`UPDATE users SET referred_by_user_id = ? WHERE id = ?`).run(inviterRow.user_id, userId);

  // Record in referrals table
  db.prepare(`INSERT INTO referrals (inviter_user_id, invitee_user_id, status) VALUES (?, ?, 'converted')`)
    .run(inviterRow.user_id, userId);

  return { attached: true };
}

/**
 * Credits 50% of the deposit amount to the inviter.
 */
export function creditReferralBonus(userId, depositAmountCents) {
  const user = db.prepare(`SELECT referred_by_user_id FROM users WHERE id = ?`).get(userId);
  if (!user || !user.referred_by_user_id) return;

  const inviterId = user.referred_by_user_id;
  const bonusAmountCents = Math.round(depositAmountCents * 0.50);

  db.transaction(() => {
    // Update inviter's referral balance
    db.prepare(`UPDATE users SET referral_balance = referral_balance + ? WHERE id = ?`)
      .run(bonusAmountCents, inviterId);
    
    // Log the event
    db.prepare(`
      INSERT INTO referral_events (user_id, referral_code, event_type, amount, created_at) 
      VALUES (?, (SELECT code FROM referral_codes WHERE user_id = ?), 'deposit_commission', ?, DATETIME('now'))
    `).run(userId, inviterId, bonusAmountCents);
  })();
}

/**
 * Get comprehensive referral stats for a user.
 */
export function getReferralStats(userId) {
  const user = db.prepare(`SELECT referral_balance FROM users WHERE id = ?`).get(userId);
  const code = codeForUserId(userId);
  
  const lifetimeEarnings = db.prepare(`
    SELECT SUM(amount) as total FROM referral_events 
    WHERE event_type = 'deposit_commission' 
    AND referral_code = ?
  `).get(code)?.total || 0;

  const withdrawals = db.prepare(`
    SELECT SUM(amount) as total FROM referral_events 
    WHERE event_type = 'withdrawal' 
    AND user_id = ?
  `).get(userId)?.total || 0;

  const referralCount = db.prepare(`
    SELECT COUNT(*) as count FROM referrals WHERE inviter_user_id = ?
  `).get(userId)?.count || 0;

  const activities = db.prepare(`
    SELECT e.event_type, e.amount, e.created_at, u.display_name as friend_name
    FROM referral_events e
    LEFT JOIN users u ON e.user_id = u.id
    WHERE e.referral_code = ? OR (e.user_id = ? AND e.event_type = 'withdrawal')
    ORDER BY e.created_at DESC
    LIMIT 100
  `).all(code, userId);

  return {
    code,
    referralLink: `https://kuomoka.co.ke/?ref=${code}`,
    currentBalance: Number(user?.referral_balance || 0),
    lifetimeEarnings: Number(lifetimeEarnings || 0),
    withdrawnEarnings: Number(withdrawals || 0),
    referralCount: Number(referralCount || 0),
    pendingEarnings: 0,
    activities: activities.map(a => ({
      ...a,
      amount: Number(a.amount || 0)
    }))
  };
}

/**
 * Handle referral withdrawal.
 */
export function withdrawReferralEarnings(userId, amountCents, mpesaNumber, mpesaName) {
  const user = db.prepare(`SELECT referral_balance FROM users WHERE id = ?`).get(userId);
  
  if (amountCents < 10000) { // 100 KES
    throw new Error("Minimum withdrawal is KES 100");
  }
  
  if (user.referral_balance < amountCents) {
    throw new Error("Insufficient referral balance");
  }

  const withdrawalCode = `REF-WD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  db.transaction(() => {
    db.prepare(`UPDATE users SET referral_balance = referral_balance - ? WHERE id = ?`)
      .run(amountCents, userId);
    
    db.prepare(`
      INSERT INTO referral_events (user_id, event_type, amount, meta, created_at) 
      VALUES (?, 'withdrawal', ?, ?, DATETIME('now'))
    `).run(userId, amountCents, JSON.stringify({
      mpesaNumber,
      mpesaName,
      withdrawalCode,
      status: 'pending'
    }));
  })();

  return {
    success: true,
    withdrawalCode,
    amount: amountCents / 100
  };
}
