import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { API_URL } from "../config/api.js";

export default function MyStatsChart({ getToken }) {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/wallet/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (!cancelled) setBets(d.bets || []);
      } catch {
        if (!cancelled) setBets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  // History comes back newest-first; reverse to chronological order and
  // build a running cumulative profit line.
  const chronological = [...bets].reverse();
  let cumulative = 0;
  const chartData = chronological.map((b, i) => {
    const profit = b.status === "cashed_out" ? b.payout - b.amount : -b.amount;
    cumulative += profit;
    return { index: i + 1, cumulative: cumulative / 100, profit: profit / 100 };
  });

  const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
  const totalWon = bets.filter((b) => b.status === "cashed_out").reduce((s, b) => s + b.payout, 0);
  const netProfit = totalWon - totalWagered;
  const winRate = bets.length ? (bets.filter((b) => b.status === "cashed_out").length / bets.length) * 100 : 0;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>My Stats</h2>
      </div>

      {loading && <div className="muted">Loading…</div>}
      {!loading && bets.length === 0 && <div className="muted">No bets placed yet — go play a round!</div>}

      {!loading && bets.length > 0 && (
        <>
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-label">Net profit</div>
              <div className={`stat-value ${netProfit >= 0 ? "positive" : "negative"}`}>
                KES {(netProfit / 100).toFixed(2)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Bets placed</div>
              <div className="stat-value">{bets.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Win rate</div>
              <div className="stat-value">{winRate.toFixed(0)}%</div>
            </div>
          </div>

          <div style={{ width: "100%", height: 200, marginTop: 12 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <XAxis dataKey="index" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#334155" />
                <Tooltip
                  formatter={(v) => `KES ${v.toFixed(2)}`}
                  labelFormatter={(l) => `Bet #${l}`}
                  contentStyle={{ background: "#131a2b", border: "1px solid #263149", borderRadius: 8 }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Line type="monotone" dataKey="cumulative" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Round</th>
                <th>Slot</th>
                <th>Bet</th>
                <th>Result</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {bets.slice(0, 15).map((b) => {
                const profit = b.status === "cashed_out" ? b.payout - b.amount : -b.amount;
                return (
                  <tr key={b.id}>
                    <td>#{b.round_id}</td>
                    <td>{b.slot}</td>
                    <td>KES {(b.amount / 100).toFixed(2)}</td>
                    <td>
                      {b.status === "cashed_out"
                        ? `Cashed ${(b.cashout_multiplier / 100).toFixed(2)}x`
                        : `Crashed ${(b.crash_point / 100).toFixed(2)}x`}
                    </td>
                    <td className={profit >= 0 ? "positive" : "negative"}>
                      {profit >= 0 ? "+" : ""}
                      {(profit / 100).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
