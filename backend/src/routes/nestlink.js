import { Router } from "express";
import { requireAuth } from "./middleware.js";
import { createNestlinkPrompt, getNestlinkPaymentStatus } from "../nestlink/nestlinkService.js";
import { db } from "../db/index.js";
import { recordWalletTransaction } from "../db/walletTransactions.js";
import { getFirestore } from "../db/firestore.js";
import { creditReferralBonus } from "../referrals/referralService.js";


const router = Router();

// Cache to track which transactions we've already processed
const processedTransactions = new Set();

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("254")) return cleaned;
  if (cleaned.startsWith("0")) return `254${cleaned.slice(1)}`;
  return cleaned;
}

/**
 * POST /api/nestlink/deposit
 * Initiate M-Pesa STK Push payment per API docs
 * Returns ConfirmationLink for frontend to poll every 3 seconds
 */
router.post("/deposit", requireAuth, async (req, res) => {
  try {
    const { amount, phone } = req.body || {};
    const amountValue = Number(amount);
    const normalizedPhone = normalizePhone(phone);

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).json({
        status: false,
        msg: "Amount must be a positive number",
        error: "Amount must be a positive number",
      });
    }

    if (!normalizedPhone) {
      return res.status(400).json({
        status: false,
        msg: "Valid phone number is required",
        error: "Valid phone number is required",
      });
    }

    const uniqueLocalId = `nestlink_${req.userId}_${Date.now()}`;
    
    try {
      const result = await createNestlinkPrompt({
        phone: normalizedPhone,
        amount: Math.round(amountValue),
        localId: uniqueLocalId,
        transactionDesc: `Deposit for user ${req.userId}`,
      });

      // Return per API docs: include link for client polling
      res.json({
        status: true,
        msg: result.msg,
        data: {
          localId: uniqueLocalId,
          ldId: result.ldId,
          confirmationLink: result.confirmationLink,
          amount: amountValue,
          phone: normalizedPhone,
        },
      });
    } catch (nestlinkErr) {
      // Return error with proper status code per API docs
      const msg = nestlinkErr.message || "Failed to initiate M-Pesa payment";
      
      if (msg.includes("0 credits")) {
        return res.status(402).json({
          status: false,
          msg,
          data: { credit_empty: true },
        });
      }
      
      if (msg.includes("Rate limited")) {
        return res.status(429).json({
          status: false,
          msg,
        });
      }

      return res.status(502).json({
        status: false,
        msg,
      });
    }
  } catch (error) {
    console.error("NestLink deposit error:", error);
    res.status(500).json({
      status: false,
      msg: "Deposit request failed",
      error: error.message,
    });
  }
});

/**
 * GET /api/nestlink/checkPayment
 * Poll payment status every 3 seconds per API docs
 * Returns payment status and updates balance on success
 */
router.get("/checkPayment", requireAuth, async (req, res) => {
  try {
    const { ldId, localId } = req.query;

    if (!ldId || !localId) {
      return res.status(400).json({
        status: false,
        msg: "ldId and localId are required",
      });
    }

    // Verify this transaction belongs to the current user
    if (!localId.startsWith(`nestlink_${req.userId}_`)) {
      return res.status(403).json({
        status: false,
        msg: "Unauthorized transaction",
      });
    }

    const paymentStatus = await getNestlinkPaymentStatus(ldId, localId);

    // If payment succeeded, update user balance and record transaction
    if (paymentStatus.status === "success" && paymentStatus.paid) {
      const transactionKey = `${localId}_${paymentStatus.mpesaRef}`;
      
      // Process only once per transaction
      if (!processedTransactions.has(transactionKey)) {
        processedTransactions.add(transactionKey);

        const amountCents = Math.round(paymentStatus.amount * 100);
        const bonusCents = Math.round(amountCents * 0.5); // 50% bonus
        console.log("=== PAYMENT SUCCESS ===");
        // Record wallet transaction in database (bonus is applied automatically)
        recordWalletTransaction({
          
          userId: req.userId,
          kind: "deposit",
          amountCents,
          meta: {
            source: "nestlink",
            mpesaRef: paymentStatus.mpesaRef,
            phone: paymentStatus.phone,
            timestamp: new Date().toISOString(),
            bonus: bonusCents,
          },
        });

        // Credit referral bonus (50% to inviter)
        creditReferralBonus(req.userId, amountCents);

       

        // Save to Firestore
        try {
          console.log("Saving to Firestore...");
          const firestore = await getFirestore();
          if (firestore) {
            await firestore.collection("payment_transactions").add({
              userId: req.userId,
              amount: paymentStatus.amount,
              bonus: paymentStatus.amount * 0.5,
              total: paymentStatus.amount * 1.5,
              mpesaRef: paymentStatus.mpesaRef,
              phone: paymentStatus.phone,
              status: "success",
              source: "nestlink_checkPayment",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[NestLink] Firestore saved: Transaction ${paymentStatus.mpesaRef}`);
          }
        } catch (firestoreErr) {
          console.error(`[NestLink] Firestore save failed:`, firestoreErr.message);
        }

        // Get updated balance
        const balanceRow = db
          .prepare(`SELECT balance FROM users WHERE id = ?`)
          .get(req.userId);
        const newBalance = balanceRow?.balance ?? 0;

        // Emit socket event for real-time UI update
        const io = req.app?.locals?.io;
        if (io) {
          io.emit("wallet:update", {
            userId: req.userId,
            balance: newBalance,
            kind: "deposit",
            amount: amountCents,
            bonus: bonusCents,
          });
        }

        console.log(`[NestLink] Deposit successful: User ${req.userId}, Deposit KES${paymentStatus.amount}, Bonus KES${bonusCents / 100}, Total KES${newBalance / 100}, MPesa Ref: ${paymentStatus.mpesaRef}`);
      }
    }

    // Return payment status with user's new balance
    const balanceRow = db
      .prepare(`SELECT balance FROM users WHERE id = ?`)
      .get(req.userId);
    const currentBalance = balanceRow?.balance ?? 0;

    res.json({
      status: paymentStatus.status === "success",
      msg: paymentStatus.msg,
      data: {
        paymentStatus: paymentStatus.status,
        paid: paymentStatus.paid,
        amount: paymentStatus.amount,
        mpesaRef: paymentStatus.mpesaRef,
        currentBalance,
      },
    });
  } catch (error) {
    console.error("NestLink checkPayment error:", error);
    res.status(502).json({
      status: false,
      msg: error.message || "Failed to check payment status",
    });
  }
});

/**
 * POST /api/nestlink/callback
 * Webhook callback from NestLink (per API docs)
 * Payload: { api_key, local_id, paid, result_code, result: { amount, ref_code, phone_number, msg }, createdat }
 */
router.post("/callback", async (req, res) => {
  const payload = req.body || {};
  const localId = String(payload?.local_id || "");
  const userIdMatch = localId.match(/^nestlink_(\d+)_/);
  const userId = userIdMatch?.[1] ? Number(userIdMatch[1]) : null;

  console.log("[NestLink Callback]", { localId, userId, paid: payload?.paid, resultCode: payload?.result_code });

  // Process successful payments
  if (payload?.paid && userId && payload?.result?.result_code === 0) {
    const transactionKey = `${localId}_${payload?.result?.ref_code}`;
    
    if (!processedTransactions.has(transactionKey)) {
      processedTransactions.add(transactionKey);

      const amountCents = Math.round(Number(payload?.result?.amount || 0) * 100);
      const bonusCents = Math.round(amountCents * 0.5); // 50% bonus
      
      if (amountCents > 0) {
        recordWalletTransaction({
          userId,
          kind: "deposit",
          amountCents,
          meta: {
            source: "nestlink_callback",
            refCode: payload?.result?.ref_code,
            phone: payload?.result?.phone_number,
            timestamp: payload?.createdat,
            bonus: bonusCents,
          },
        });

        // Credit referral bonus (50% to inviter)
        creditReferralBonus(userId, amountCents);

        // Save to Firestore
        try {
          const firestore = await getFirestore();
          if (firestore) {
            await firestore.collection("payment_transactions").add({
              userId,
              amount: payload?.result?.amount,
              bonus: payload?.result?.amount * 0.5,
              total: payload?.result?.amount * 1.5,
              mpesaRef: payload?.result?.ref_code,
              phone: payload?.result?.phone_number,
              status: "success",
              source: "nestlink_callback",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[NestLink Callback] Firestore saved: Transaction ${payload?.result?.ref_code}`);
            console.log("Saved to Firestore successfully");
          }
        } catch (firestoreErr) {
          console.error(`[NestLink Callback] Firestore save failed:`, firestoreErr.message);
        }

        const balanceRow = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(userId);
        const newBalance = balanceRow?.balance ?? 0;

        const io = req.app?.locals?.io;
        if (io) {
          io.emit("wallet:update", {
            userId,
            balance: newBalance,
            kind: "deposit",
            amount: amountCents,
            bonus: bonusCents,
          });
        }

        console.log(`[NestLink Callback] Deposit processed: User ${userId}, Deposit KES${payload?.result?.amount}, Bonus KES${bonusCents / 100}, Total KES${newBalance / 100}`);
      }
    }
  } else if (!payload?.paid && userId) {
    console.warn(`[NestLink Callback] Payment failed for user ${userId}:`, payload?.result?.msg || "Unknown error");
  } else if (!userId) {
    console.warn("[NestLink Callback] Received callback without valid user mapping:", { localId });
  }

  // Always return 200 per API docs to acknowledge receipt
  res.status(200).json({ ok: true });
});

export default router;
