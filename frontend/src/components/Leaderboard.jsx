import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { API_URL } from "../config/api.js";

export default function Leaderboard() {
  const [window_, setWindow] = useState("24h");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/leaderboard?window=${window_}`)
      .then((r) => r.json())
      .then((d) => setRows(d.leaderboard))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [window_]);

  const chartData = rows.map((r) => ({
    name: r.username,
    profit: r.netProfit / 100,
  }));

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Leaderboard</h2>
        <div className="tab-toggle">
          <button className={window_ === "24h" ? "active" : ""} onClick={() => setWindow("24h")}>
            24h
          </button>
          <button className={window_ === "all" ? "active" : ""} onClick={() => setWindow("all")}>
            All-time
          </button>
        </div>
      </div>

      {loading && <div className="muted">Loading…</div>}
      {!loading && rows.length === 0 && <div className="muted">No settled bets in this window yet.</div>}

      {!loading && rows.length > 0 && (
        <>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fill: "#e2e8f0", fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => `KES ${v.toFixed(2)}`}
                  contentStyle={{ background: "#131a2b", border: "1px solid #263149", borderRadius: 8 }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Bar dataKey="profit" radius={[0, 6, 6, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.profit >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Net profit</th>
                <th>Bets</th>
                <th>Best multiplier</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.username}>
                  <td>{i + 1}</td>
                  <td>{r.username}</td>
                  <td className={r.netProfit >= 0 ? "positive" : "negative"}>
                    KES {(r.netProfit / 100).toFixed(2)}
                  </td>
                  <td>{r.betsPlayed}</td>
                  <td>{r.bestMultiplier ? (r.bestMultiplier / 100).toFixed(2) + "x" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
