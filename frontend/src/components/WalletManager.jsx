import { useState } from "react";

export default function WalletManager({ balance, onDeposit, onWithdraw }) {
  const [tab, setTab] = useState("balance"); // balance | deposit | withdraw
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [msg, setMsg] = useState(null);
  const [msgType, setMsgType] = useState("info");

  async function handleDeposit() {
    setMsg(null);
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      setMsgType("error");
      setMsg("Please enter a valid amount");
      return;
    }
    try {
      const res = await onDeposit(Math.round(amount * 100));
      if (res?.ok) {
        setMsgType("success");
        setMsg(`Successfully deposited KES ${amount.toFixed(2)}`);
        setDepositAmount("");
      } else {
        setMsgType("error");
        setMsg(res?.error || "Deposit failed");
      }
    } catch (err) {
      setMsgType("error");
      setMsg("Error processing deposit");
    }
  }

  async function handleWithdraw() {
    setMsg(null);
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setMsgType("error");
      setMsg("Please enter a valid amount");
      return;
    }
    if (amount * 100 > balance) {
      setMsgType("error");
      setMsg(`Insufficient balance. Max: KES ${(balance / 100).toFixed(2)}`);
      return;
    }
    try {
      const res = await onWithdraw(Math.round(amount * 100));
      if (res?.ok) {
        setMsgType("success");
        setMsg(`Successfully withdrew KES ${amount.toFixed(2)}`);
        setWithdrawAmount("");
      } else {
        setMsgType("error");
        setMsg(res?.error || "Withdrawal failed");
      }
    } catch (err) {
      setMsgType("error");
      setMsg("Error processing withdrawal");
    }
  }

  return (
    <div className="panel wallet-panel">
      <div className="panel-header">
        <h2>Wallet</h2>
      </div>

      <div className="wallet-tabs">
        <button className={tab === "balance" ? "active" : ""} onClick={() => setTab("balance")}>
          Balance
        </button>
        <button className={tab === "deposit" ? "active" : ""} onClick={() => setTab("deposit")}>
          Deposit
        </button>
        <button className={tab === "withdraw" ? "active" : ""} onClick={() => setTab("withdraw")}>
          Withdraw
        </button>
      </div>

      {tab === "balance" && (
        <div className="wallet-content">
          <div className="balance-display">
            <span className="balance-label">Current Balance</span>
            <span className="balance-amount">KES {(balance / 100).toFixed(2)}</span>
          </div>
        </div>
      )}

      {tab === "deposit" && (
        <div className="wallet-content">
          <input
            type="number"
            min="1"
            step="0.01"
            placeholder="Amount in KES"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="wallet-input"
          />
          <button className="wallet-action-btn deposit-btn" onClick={handleDeposit}>
            Deposit
          </button>
          <div className="deposit-info">
            <p className="section-title">Quick Amounts</p>
            <div className="quick-amounts">
              {[100, 500, 1000, 5000].map((amt) => (
                <button key={amt} className="quick-amt-btn" onClick={() => setDepositAmount(amt.toFixed(2))}>
                  {amt.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "withdraw" && (
        <div className="wallet-content">
          <input
            type="number"
            min="1"
            step="0.01"
            max={(balance / 100).toFixed(2)}
            placeholder="Amount in KES"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="wallet-input"
          />
          <button className="wallet-action-btn withdraw-btn" onClick={handleWithdraw}>
            Withdraw
          </button>
        </div>
      )}

      {msg && <div className={`wallet-msg ${msgType}`}>{msg}</div>}
    </div>
  );
}
