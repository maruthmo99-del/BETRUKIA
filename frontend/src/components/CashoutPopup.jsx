import { useEffect, useState } from "react";

const AUTO_DISMISS_MS = 3800;

// Small on-screen popup that celebrates a successful cash-out (manual or
// auto). `event` should change identity (via a fresh `id`) every time a
// new cashout happens, even if the multiplier/payout are identical to the
// previous one, so the popup re-triggers its entrance animation.
export default function CashoutPopup({ event }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (!event) return;
    setCurrent(event);
    setVisible(true);

    const hideTimer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(hideTimer);
  }, [event?.id]);

  if (!current) return null;

  const multiplierX = (current.multiplier / 100).toFixed(2);
  const payoutKes = (current.payout / 100).toFixed(2);

  return (
    <div className={`cashout-popup-layer ${visible ? "is-visible" : ""}`} aria-live="polite">
      <div className="cashout-popup">
        <button
          type="button"
          className="cashout-popup-close"
          aria-label="Dismiss"
          onClick={() => setVisible(false)}
        >
          ×
        </button>
        <div className="cashout-popup-icon">🎉</div>
        <div className="cashout-popup-title">
          {current.auto ? "Auto Cashed Out!" : "Cashed Out!"}
        </div>
        <div className="cashout-popup-multiplier">{multiplierX}x</div>
        <div className="cashout-popup-amount">+KES {payoutKes}</div>
      </div>
    </div>
  );
}