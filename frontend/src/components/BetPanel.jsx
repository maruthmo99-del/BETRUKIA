import { useState } from "react";

function formatMultiplier(value) {
  // Cap at 20,000x maximum and format with 2 decimal places
  const capped = Math.min(value, 20000);
  return capped.toFixed(2);
}

function SlotPanel({ slotNum, phase, slotState, config, placeBet, cashOut, cancelBet, multiplier }) {
  const [amount, setAmount] = useState("10.00");
  const [autoTarget, setAutoTarget] = useState("");
  const [msg, setMsg] = useState(null);
  const [mode, setMode] = useState("bet");
  const [cancelling, setCancelling] = useState(false);

  const minAmt = (config.minBetCents / 100).toFixed(2);
  const maxAmt = (config.maxBetCents / 100).toFixed(2);
  const { bet, cashoutResult } = slotState;
  const canInteract = phase === "waiting" && !bet;
  const canCashOut = !!bet && phase === "flying";
  // A placed bet can only be withdrawn while the round is still accepting bets,
  // i.e. before the plane takes off.
  const canCancel = !!bet && phase === "waiting";

  function updateAmount(nextValue) {
    if (phase !== "waiting" || !!bet) return;
    const numeric = Number(nextValue);
    if (Number.isNaN(numeric)) return;
    setAmount(numeric.toFixed(2));
  }

  function applyPreset(value) {
    updateAmount(value);
  }

  async function handleBet() {
    setMsg(null);
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents < config.minBetCents) return setMsg(`Min bet is KES ${minAmt}`);
    if (cents > config.maxBetCents) return setMsg(`Max bet is KES ${maxAmt}`);

    let autoCashoutAt = null;
    if (mode === "auto" && autoTarget.trim() !== "") {
      const parsed = Math.round(parseFloat(autoTarget) * 100);
      if (!parsed || parsed < 101) return setMsg("Auto-cashout target must be at least 1.01x");
      autoCashoutAt = parsed;
    }

    const res = await placeBet(cents, slotNum, autoCashoutAt);
    if (res?.error) setMsg(res.error);
  }

  async function handleCashOut() {
    setMsg(null);
    const res = await cashOut(slotNum);
    if (res?.error) setMsg(res.error);
  }

  async function handleCancel() {
    setMsg(null);
    setCancelling(true);
    const res = await cancelBet(slotNum);
    setCancelling(false);
    if (res?.error) setMsg(res.error);
  }

  return (
    <div className="bet-slot">
      <div className="bet-slot-header">
        <span className="bet-slot-title">Slot {slotNum}</span>
        <span className="bet-slot-state">{bet ? "Active" : "Ready"}</span>
      </div>

      <div className="bet-mode-toggle">
        <button className={mode === "bet" ? "active" : ""} onClick={() => setMode("bet")}>
          Bet
        </button>
        <button className={mode === "auto" ? "active" : ""} onClick={() => setMode("auto")}>
          Auto
        </button>
      </div>

      <div className="bet-slot-body">
        <div className="bet-controls-left">
          <div className="stake-stepper">
            <button className="stepper-btn" onClick={() => updateAmount(Number(amount) - 10)} disabled={!canInteract}>
              –
            </button>
            <input
              className="stake-input"
              type="number"
              aria-label={`Stake amount for slot ${slotNum}`}
              min={minAmt}
              max={maxAmt}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={phase !== "waiting" || !!bet}
            />
            <button className="stepper-btn" onClick={() => updateAmount(Number(amount) + 10)} disabled={!canInteract}>
              +
            </button>
          </div>

          <div className="quick-presets">
            {[100, 200, 500, 3000].map((preset) => (
              <button key={preset} className="quick-preset" onClick={() => applyPreset(preset)} disabled={!canInteract}>
                {preset.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {!bet && (
          <button className="primary-action bet" onClick={handleBet} disabled={phase !== "waiting"}>
            <span className="primary-action-label">Bet</span>
            <span className="primary-action-amount">{Number(parseFloat(amount || 0)).toFixed(2)} KES</span>
          </button>
        )}
        {canCashOut && (
          (() => {
            const stakeKes = bet ? bet.amount / 100 : 0;
            const potential = stakeKes * multiplier;
            return (
              <button className="primary-action cashout" onClick={handleCashOut}>
                <span className="primary-action-label">Cash Out</span>
                <span className="primary-action-amount">{potential.toFixed(2)} KES</span>
              </button>
            );
          })()
        )}
        {canCancel && (
          <button className="primary-action cancel" onClick={handleCancel} disabled={cancelling} style={{ backgroundColor: "#ff4d4d" }}>
            <span className="primary-action-label">{cancelling ? "Cancelling…" : "Cancel"}</span>
            <span className="primary-action-amount">{(bet.amount / 100).toFixed(2)} KES</span>
          </button>
        )}
      </div>

      {mode === "auto" && (
        <div className="auto-cashout-row">
          <input
            type="number"
            aria-label={`Auto cashout target for slot ${slotNum}`}
            min="1.01"
            step="0.01"
            placeholder="1.50"
            value={autoTarget}
            onChange={(e) => setAutoTarget(e.target.value)}
            disabled={phase !== "waiting" || !!bet}
          />
          <span>x</span>
        </div>
      )}

      {bet?.autoCashoutAt && <div className="auto-cashout-active">Auto: {(bet.autoCashoutAt / 100).toFixed(2)}x</div>}

      {cashoutResult && (
        <div className="cashout-banner">
          {cashoutResult.auto ? "Auto-" : ""}Cashed out at {(cashoutResult.multiplier / 100).toFixed(2)}x — won
          KES {(cashoutResult.payout / 100).toFixed(2)}
        </div>
      )}
      {msg && <div className="bet-msg">{msg}</div>}
    </div>
  );
}

export default function BetPanel({ phase, balance, config, slots, placeBet, cashOut, cancelBet, multiplier }) {
  return (
    <div className="bet-panel">
      <div className="balance-line">
        <span>Balance</span>
        <span className="balance-pill">KES {(balance / 100).toFixed(2)}</span>
      </div>
      <div className="bet-slots-grid">
        {Array.from({ length: config.maxBetsPerRound }, (_, i) => i + 1).map((slotNum) => (
          <SlotPanel
            key={slotNum}
            slotNum={slotNum}
            phase={phase}
            slotState={slots[slotNum] || { bet: null, cashoutResult: null }}
            config={config}
            placeBet={placeBet}
            cashOut={cashOut}
            cancelBet={cancelBet}
            multiplier={multiplier}
          />
        ))}
      </div>
    </div>
  );
}