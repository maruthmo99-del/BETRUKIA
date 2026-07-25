import { db } from "../db/index.js";
import { creditReferralBonus } from "../referrals/referralService.js";

/**
 * Creates a Nestlink payment prompt / invoice for deposits
 */
export async function createNestlinkPrompt({ phone, amount, localId, transactionDesc }) {
  // Use Nestlink STK Push API
  const NESTLINK_API_BASE = "https://api.nestlink.co.ke/v1";
  const NESTLINK_API_KEY = process.env.NESTLINK_API_KEY || "your_actual_api_key_here";

  const response = await fetch(`${NESTLINK_API_BASE}/stk-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: NESTLINK_API_KEY,
      phone_number: phone,
      amount: amount,
      local_id: localId,
      desc: transactionDesc
    }),
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(data.msg || "NestLink API request failed");
  }

  return {
    msg: data.msg,
    ldId: data.ld_id,
    confirmationLink: data.confirmation_link
  };
}

/**
 * Checks and updates the status of a Nestlink payment
 */
export async function getNestlinkPaymentStatus(ldId, localId) {
  const NESTLINK_API_BASE = "https://api.nestlink.co.ke/v1";
  const NESTLINK_API_KEY = process.env.NESTLINK_API_KEY || "your_actual_api_key_here";

  const response = await fetch(`${NESTLINK_API_BASE}/check-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: NESTLINK_API_KEY,
      ld_id: ldId,
      local_id: localId
    }),
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(data.msg || "NestLink check-status failed");
  }

  return {
    status: data.paid ? "success" : "pending",
    paid: data.paid,
    amount: data.result?.amount,
    mpesaRef: data.result?.ref_code,
    phone: data.result?.phone_number,
    msg: data.msg
  };
}
