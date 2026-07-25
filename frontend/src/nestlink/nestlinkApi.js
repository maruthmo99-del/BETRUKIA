import { API_URL } from "../config/api.js";

/**
 * Initiate M-Pesa STK Push deposit per NestLink API docs
 * Returns { status, msg, data: { localId, ldId, confirmationLink, amount, phone } }
 */
export async function createNestlinkDeposit({ amount, phone, token }) {
  console.log("[NestLink API] createNestlinkDeposit called with:", { amount, phone, tokenLength: token?.length });
  const response = await fetch(`${API_URL}/api/nestlink/deposit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount, phone }),
  });

  const data = await response.json().catch(() => ({}));
  
  if (!response.ok || !data?.status) {
    throw new Error(data?.msg || "Failed to initiate M-Pesa payment");
  }

  return data.data;
}

/**
 * Poll payment status every 3 seconds per API docs
 * Returns { status: "success"|"pending"|"failed", paid, amount, mpesaRef, currentBalance, msg }
 */
export async function checkNestlinkPaymentStatus({ ldId, localId, token }) {
  const response = await fetch(`${API_URL}/api/nestlink/checkPayment?ldId=${encodeURIComponent(ldId)}&localId=${encodeURIComponent(localId)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    throw new Error(data?.msg || "Failed to check payment status");
  }

  return {
    status: data.data?.paymentStatus || "pending",
    paid: data.data?.paid || false,
    amount: data.data?.amount,
    mpesaRef: data.data?.mpesaRef,
    currentBalance: data.data?.currentBalance,
    msg: data.msg,
  };
}

/**
 * Poll payment with retry logic
 * Polls every 3 seconds up to maxAttempts times
 * Returns the final status or throws on error
 * Includes 50% bonus calculation
 * Calls onProgress callback with (attempt, maxAttempts) for animation
 */
export async function pollNestlinkPayment({ ldId, localId, token, maxAttempts = 40, intervalMs = 3000, onProgress }) {
  let lastError = null;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Report progress to caller for animation
      onProgress?.(attempt, maxAttempts);

      const status = await checkNestlinkPaymentStatus({ ldId, localId, token });
      
      // Success
      if (status.status === "success" && status.paid) {
        console.log(`[NestLink Poll] Payment successful on attempt ${attempt + 1}:`, status);
        const depositAmount = status.amount;
        const bonusAmount = depositAmount * 0.5; // 50% bonus
        const totalReceived = depositAmount + bonusAmount;
        
        // Report 100% completion on success
        onProgress?.(maxAttempts, maxAttempts);
        
        return {
          success: true,
          status: "success",
          depositAmount,
          bonusAmount,
          totalReceived,
          mpesaRef: status.mpesaRef,
          currentBalance: status.currentBalance,
          msg: `✓ Payment successful! MPesa Reference: ${status.mpesaRef}\n\nDeposit: KES ${depositAmount.toFixed(2)}\n50% Bonus: KES ${bonusAmount.toFixed(2)}\nTotal Received: KES ${totalReceived.toFixed(2)}\n\nYour new balance: KES ${(status.currentBalance / 100).toFixed(2)}`,
        };
      }
      
      // Failed
      if (status.status === "failed") {
        console.log(`[NestLink Poll] Payment failed on attempt ${attempt + 1}:`, status);
        return {
          success: false,
          status: status.status || "failed",
          msg: status.msg || "Payment was not completed. Please try again.",
          currentBalance: status.currentBalance,
        };
      }
      
      // Still pending, wait before next attempt
      if (attempt < maxAttempts - 1) {
        console.log(`[NestLink Poll] Payment pending on attempt ${attempt + 1}. Retrying in ${intervalMs / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    } catch (err) {
      lastError = err;
      console.error(`[NestLink Poll] Attempt ${attempt + 1} failed:`, err.message);
      
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }

  // Max attempts reached
  return {
    success: false,
    status: "timeout",
    msg: "Payment check timed out after 2 minutes. Your payment may still be processing. Please check your account balance or contact support.",
    error: lastError?.message,
  };
}
