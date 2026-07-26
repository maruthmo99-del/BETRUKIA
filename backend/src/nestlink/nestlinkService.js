/**
 * backend/src/nestlink/nestlinkService.js
 */

const API =
  process.env.NESTLINK_BASE_URL || "https://api.nestlink.co.ke/v1";

const API_KEY =
  process.env.NESTLINK_API_KEY ||
  process.env.NESTLINK_SECRET_KEY;

if (!API_KEY) {
  console.warn("NESTLINK_API_KEY not configured");
}

export async function createNestlinkPrompt({
  phone,
  amount,
  localId,
  transactionDesc,
}) {

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

  const text = await response.text();

  console.log("========== STK PUSH ==========");
  console.log("HTTP:", response.status);
  console.log(text);
  console.log("==============================");

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text);
  }

  if (!response.ok) {
    throw new Error(data.msg || text);
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

export async function getNestlinkPaymentStatus(ldId, localId) {

  const response = await fetch(`${API}/check-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: API_KEY,
      ld_id: ldId,
      local_id: localId,
    }),
  });

  const text = await response.text();

  console.log("======= CHECK STATUS =======");
  console.log(text);
  console.log("============================");

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text);
  }

  if (!response.ok) {
    throw new Error(data.msg || text);
  }

  if (!data.status) {
    throw new Error(data.msg || "Status request failed");
  }

  return {
    status: data.paid ? "success" : "pending",
    paid: data.paid,
    amount: data.result?.amount,
    mpesaRef: data.result?.ref_code,
    phone: data.result?.phone_number,
    msg: data.msg,
  };
}
