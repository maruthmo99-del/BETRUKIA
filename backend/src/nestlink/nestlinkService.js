import { db } from "../db/index.js";
import { creditReferralBonus } from "../referrals/referralService.js";

/**
 * Creates a Nestlink payment prompt / invoice for deposits
 */
export async function createNestlinkPrompt({ phone, amount, localId, transactionDesc }) {
  // Use Nestlink STK Push API
  const NESTLINK_BASE_URL = "https://api.nestlink.co.ke/v1";
  const NESTLINK_API_KEY = process.env.NESTLINK_API_KEY || process.env.NESTLINK_SECRET_KEY || "7fa32d4a03b8fd852af7b78f";
  if (!NESTLINK_API_KEY) throw new Error("NESTLINK_API_KEY is not configured in environment");

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

  export async function createNestlinkPrompt({
  phone,
  amount,
  localId,
  transactionDesc,
}) {
  const API = "https://api.nestlink.co.ke/v1";

  const API_KEY =
    process.env.NESTLINK_API_KEY ||
    process.env.NESTLINK_SECRET_KEY;

  if (!API_KEY) {
    throw new Error("NESTLINK_API_KEY missing");
  }

  const response = await fetch(`${API}/stk-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: API_KEY,
      phone_number: phone,
      amount,
      local_id: localId,
      desc: transactionDesc,
    }),
  });

  const body = await response.text();

  console.log("========== NESTLINK ==========");
  console.log("Status:", response.status);
  console.log(body);
  console.log("==============================");

  let data;

  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(body);
  }

  if (!response.ok) {
    throw new Error(data.msg || body);
  }

  if (!data.status) {
    throw new Error(data.msg || "NestLink rejected request");
  }

  return {
    msg: data.msg,
    ldId: data.ld_id,
    confirmationLink: data.confirmation_link,
  };
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
  const NESTLINK_API_KEY = process.env.NESTLINK_API_KEY || process.env.NESTLINK_SECRET_KEY || "7fa32d4a03b8fd852af7b78f";
  if (!NESTLINK_API_KEY) throw new Error("NESTLINK_API_KEY is not configured in environment");

  const response = await fetch(`${NESTLINK_API_BASE}/check-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: NESTLINK_API_KEY,
      ld_id: ldId,
      local_id: localId
    }),
  });

  const body = await response.text();  console.log(body);  const data = JSON.parse(body);
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
