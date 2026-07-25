export default function History({ history }) {
  return (
    <div className="history-container">
      <div className="history-bar">
        {history.length === 0 ? (
          <div className="history-empty">No rounds yet</div>
        ) : (
          history.map((h, idx) => {
            const crashPoint = Number.isFinite(Number(h?.crashPoint)) ? Number(h.crashPoint) : 0;
            const val = crashPoint / 100;
            const cls = val < 2 ? "low" : val < 10 ? "mid" : "high";
            return (
              <div
                key={`${h.roundId}-${idx}`}
                className={`history-pill ${cls}`}
                title={`Round ${h.roundId}: Crashed at ${val.toFixed(2)}x (Position: ${idx + 1} of ${history.length})`}
              >
                <span className="pill-value">{val.toFixed(2)}x</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}