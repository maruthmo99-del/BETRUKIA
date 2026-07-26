const NESTLINK_API_BASE =
  process.env.NESTLINK_BASE_URL || "https://api.nestlink.co.ke";

const NESTLINK_API_KEY =
  process.env.NESTLINK_API_KEY || process.env.NESTLINK_SECRET_KEY;

/**
 * Send STK Push
 */
export async function createNestlinkPrompt({
  phone,
  amount,
  localId,
  transactionDesc,
}) {
  if (!NESTLINK_API_KEY) {
    throw new Error("NESTLINK_API_KEY is missing");
  }

  const response = await fetch(`${NESTLINK_API_BASE}/runPrompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Secret": NESTLINK_API_KEY,
    },
    body: JSON.stringify({
      phone,
      amount,
      local_id: localId,
      transaction_desc: transactionDesc,
    }),
  });

  const text = await response.text();

  console.log("===== NestLink runPrompt =====");
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
    ldId: data.data.ld_id,
    confirmationLink: data.data.ConfirmationLink,
  };
}

/**
 * Check payment status
 */
export async function getNestlinkPaymentStatus(ldId, localId) {
  if (!NESTLINK_API_KEY) {
    throw new Error("NESTLINK_API_KEY is missing");
  }

  const url =
    `${NESTLINK_API_BASE}/paymentStatus` +
    `?ld_id=${encodeURIComponent(ldId)}` +
    `&local_id=${encodeURIComponent(localId)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Api-Secret": NESTLINK_API_KEY,
    },
  });

  const text = await response.text();

  console.log("===== NestLink paymentStatus =====");
  console.log("HTTP:", response.status);
  console.log(text);
  console.log("==================================");

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
    return {
      status: "pending",
      paid: false,
      msg: data.msg,
    };
  }

  return {
    status: data.data.paid ? "success" : "pending",
    paid: data.data.paid,
    amount: data.data.amount,
    mpesaRef: data.data.result?.mpesa_ref,
    phone: String(data.data.result?.phone || ""),
    msg: data.msg,
  };
}
