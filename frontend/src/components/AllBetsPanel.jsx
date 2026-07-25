import { useMemo, useState } from "react";

function maskUsername(username = "") {
  const trimmed = username.trim();
  if (!trimmed) return "Player";
  if (trimmed.length <= 2) return trimmed;
  return `${trimmed[0]}***${trimmed[trimmed.length - 1]}`;
}

function avatarColor(seed) {
  const palette = ["#7c3aed", "#0ea5e9", "#f59e0b", "#ef4444", "#10b981", "#f43f5e", "#6366f1"];
  const index = seed % palette.length;
  return palette[index];
}

export default function AllBetsPanel({ allBets = [] }) {
  const [view, setView] = useState("all");

  const visibleBets = useMemo(() => {
    if (view === "top") {
      return [...allBets].sort((a, b) => b.amount - a.amount).slice(0, 25);
    }
    if (view === "previous") {
      return [...allBets].filter((bet) => bet.cashedOut).slice(0, 25);
    }
    // Default "All Bets" view: highest stake first.
    return [...allBets].sort((a, b) => b.amount - a.amount);
  }, [allBets, view]);

  return (
    <aside className="all-bets-panel">
      <div className="all-bets-header">
        <div>
          <div className="live-count">{allBets.length} live</div>
          <h2>ALL BETS</h2>
        </div>
      </div>

      <div className="all-bets-tabs">
        <button className={view === "all" ? "active" : ""} onClick={() => setView("all")}>
          All Bets
        </button>
        <button className={view === "previous" ? "active" : ""} onClick={() => setView("previous")}>
          Previous
        </button>
        <button className={view === "top" ? "active" : ""} onClick={() => setView("top")}>
          Top
        </button>
      </div>

      <div className="all-bets-list">
        {visibleBets.length === 0 ? (
          <div className="all-bets-empty">No bets yet for this round.</div>
        ) : (
          visibleBets.map((bet, index) => (
            <div className={`all-bet-row${bet.isBot ? " is-bot" : ""}`} key={`${bet.userId}-${bet.slot}-${index}`}>
              <div className="avatar-circle" style={{ background: avatarColor(index + (bet.userId ?? 0)) }}>
                {(bet.username || "P").charAt(0).toUpperCase()}
              </div>
              <div className="bet-meta">
                <div className="bet-user">
                  {maskUsername(bet.username)}
                  
                </div>
                <div className="bet-amount">KES {(bet.amount / 100).toFixed(2)}</div>
              </div>
              <div className={`bet-win ${bet.cashedOut ? "won" : ""}`}>
                {bet.cashedOut ? `KES ${(bet.payout / 100).toFixed(2)}` : ""}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}