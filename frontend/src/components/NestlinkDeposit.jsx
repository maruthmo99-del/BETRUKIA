import { useMemo, useState, useCallback, useEffect } from "react";
import { createNestlinkDeposit, pollNestlinkPayment } from "../nestlink/nestlinkApi.js";


export default function NestlinkDeposit({ token, onSuccess, onBalanceUpdate, userPhone, presets = [100, 150, 200] }) {
  const [amount, setAmount] = useState(String(presets[0] ?? 100));
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [polling, setPolling] = useState(false);
  const [pollProgress, setPollProgress] = useState(0); // 0-100 for animation
  const [pollData, setPollData] = useState(null); // Store data to retry if needed

  // Sync phone with userPhone prop when it becomes available
  useEffect(() => {
    if (userPhone && !phone) {
      let formatted = userPhone;
      if (formatted.startsWith("0")) {
        formatted = "254" + formatted.substring(1);
      } else if (!formatted.startsWith("254") && formatted.length === 9) {
        formatted = "254" + formatted;
      }
      setPhone(formatted);
    }
  }, [userPhone, phone]);

  const canSubmit = useMemo(() => Number(amount) > 0 && phone.trim().length >= 10 && !loading && !polling, [amount, phone, loading, polling]);

  const handleRetry = useCallback(async () => {
    if (!pollData) return;
    
    const resolvedToken = typeof token === "function" ? await token() : token;
    if (!resolvedToken) {
      setMessageType("error");
      setMessage("Authenticate first to continue.");
      return;
    }

    setMessageType("info");
    setMessage("🔄 Retrying payment status check...");
    setPolling(true);
    setPollProgress(0);

    try {
      const pollResult = await pollNestlinkPayment({
        ldId: pollData.ldId,
        localId: pollData.localId,
        token: resolvedToken,
        maxAttempts: 20, // 1 minute for retry
        intervalMs: 3000,
      });

      if (pollResult.success) {
        setMessageType("success");
        setMessage(pollResult.msg);
        onBalanceUpdate?.(pollResult.currentBalance);
        onSuccess?.(pollResult);
        // Don't reset phone, just clear other states
        setAmount(String(presets[0] ?? 100));
        setPollData(null);
      } else {
        setMessageType("error");
        setMessage(
          `${pollResult.msg}\n\n⟳ Payment still not confirmed. Try again or check with support.`
        );
      }
    } catch (error) {
      setMessageType("error");
      setMessage(`Retry failed: ${error.message}\n\n⟳ Please try again.`);
    } finally {
      setPolling(false);
      setPollProgress(0);
    }
  }, [token, pollData, presets, onSuccess, onBalanceUpdate]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const resolvedToken = typeof token === "function" ? await token() : token;

    if (!resolvedToken) {
      setMessageType("error");
      setMessage("Authenticate first to continue.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // Step 1: Initiate M-Pesa STK Push
      const depositData = await createNestlinkDeposit({
        amount: Number(amount),
        phone: phone.trim(),
        token: resolvedToken,
      });

      setMessageType("success");
      setMessage(`✓ STK Push sent to ${phone}. Check your phone and enter your M-Pesa PIN.`);
      setLoading(false);

      // Step 2: Start polling for payment confirmation every 3 seconds
      setPolling(true);
      setPollProgress(0);
      setPollData({ ldId: depositData.ldId, localId: depositData.localId });

      const pollResult = await pollNestlinkPayment({
        ldId: depositData.ldId,
        localId: depositData.localId,
        token: resolvedToken,
        maxAttempts: 40, // 2 minutes (40 * 3 seconds)
        intervalMs: 3000,
        onProgress: (attempt, maxAttempts) => {
          setPollProgress(Math.round((attempt / maxAttempts) * 100));
        },
      });

      if (pollResult.success) {
        // Payment succeeded!
        setPollProgress(100);
        setMessageType("success");
        setMessage(pollResult.msg);
        
        // Update parent component with new balance
        onBalanceUpdate?.(pollResult.currentBalance);
        onSuccess?.(pollResult);
        
        // Reset form
        setAmount(String(presets[0] ?? 100));
        setPollData(null);
      } else {
        // Payment failed
        setMessageType("error");
        if (pollResult.status === "timeout") {
          setMessage(
            `⏱ Payment check timed out after 2 minutes.\n\nYour payment may still be processing.\n\n⟳ Would you like to check again?`
          );
        } else {
          setMessage(
            `❌ ${pollResult.msg}\n\n⟳ Would you like to try again?`
          );
        }
        if (pollResult.currentBalance !== undefined) {
          onBalanceUpdate?.(pollResult.currentBalance);
        }
      }
    } catch (error) {
      setMessageType("error");
      
      // Strict error handling per API docs
      const msg = error.message || "Deposit request failed";
      if (msg.includes("0 credits")) {
        setMessage("⚠ NestLink service has no credits. Contact administrator.");
      } else if (msg.includes("Rate limited")) {
        setMessage("⚠ Too many requests. Please wait a moment and try again.");
      } else if (msg.includes("under maintenance")) {
        setMessage("⚠ M-Pesa service is temporarily unavailable. Please try again later.");
      } else {
        setMessage(msg);
      }
    } finally {
      setLoading(false);
      setPolling(false);
      setPollProgress(0);
    }
  }, [token, amount, phone, presets, onSuccess, onBalanceUpdate]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>NestLink M-Pesa Deposit</h2>
      </div>
      <form onSubmit={handleSubmit} className="wallet-content">
        <div className="quick-amounts" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`quick-amt-btn ${Number(amount) === preset ? "active" : ""}`}
              onClick={() => setAmount(String(preset))}
              disabled={loading || polling}
            >
              KES {preset}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="1"
          step="1"
          placeholder="Amount in KES"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="wallet-input"
          disabled={loading || polling}
        />
        <input
          type="tel"
          placeholder="Phone e.g. 254712345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="wallet-input"
          disabled={loading || polling}
        />
        <button className="wallet-action-btn deposit-btn" disabled={!canSubmit} type="submit">
          {polling
            ? "Processing payment..."
            : loading
              ? "Sending M-Pesa prompt..."
              : "Pay with M-Pesa"}
        </button>
      </form>

      {/* Polling Animation Progress Bar */}
      {polling && (
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <div
            style={{
              width: "100%",
              height: 4,
              backgroundColor: "rgba(100, 200, 100, 0.2)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pollProgress}%`,
                backgroundColor: "#64c864",
                transition: "width 0.3s ease",
                borderRadius: 2,
              }}
            />
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#888",
              marginTop: 6,
              textAlign: "center",
            }}
          >
            ⏳ Waiting for payment confirmation... {Math.ceil((100 - pollProgress) / 2.5)}s
          </div>
        </div>
      )}

      {/* Message Display */}
      {message ? (
        <div>
          <div className={`wallet-msg ${messageType}`} style={{ whiteSpace: "pre-wrap" }}>
            {message}
          </div>

          {/* Retry Button for Failed Payments */}
          {messageType === "error" && pollData && !polling && (
            <button
              type="button"
              className="wallet-action-btn deposit-btn"
              onClick={handleRetry}
              style={{ marginTop: 8 }}
            >
              🔄 Check Payment Status Again
            </button>
          )}
        </div>
      ) : null}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .wallet-msg {
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.5;
        }
        .wallet-msg.success {
          background-color: rgba(100, 200, 100, 0.15);
          color: #4a9d4a;
          border: 1px solid rgba(100, 200, 100, 0.3);
        }
        .wallet-msg.error {
          background-color: rgba(200, 100, 100, 0.15);
          color: #c86464;
          border: 1px solid rgba(200, 100, 100, 0.3);
        }
        .wallet-msg.info {
          background-color: rgba(100, 150, 200, 0.15);
          color: #4a7da4;
          border: 1px solid rgba(100, 150, 200, 0.3);
        }
      `}</style>
    </div>
  );
}
