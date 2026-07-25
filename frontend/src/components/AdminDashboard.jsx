import { useEffect, useState } from "react";
import { API_URL } from "../config/api.js";

export default function AdminDashboard({ getToken }) {
  const [stats, setStats] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [s, r, u] = await Promise.all([
          fetch(`${API_URL}/api/admin/stats`, { headers }).then((res) => res.json()),
          fetch(`${API_URL}/api/admin/rounds?limit=20`, { headers }).then((res) => res.json()),
          fetch(`${API_URL}/api/admin/users?limit=20`, { headers }).then((res) => res.json()),
        ]);
        if (s.error) throw new Error(s.error);
        setStats(s);
        setRounds(r.rounds || []);
        setUsers(u.users || []);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [getToken]);

  if (error) return <div className="panel"><div className="bet-msg">{error}</div></div>;
  if (!stats) return <div className="panel muted">Loading admin data…</div>;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Admin Dashboard</h2>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-label">Users</div>
          <div className="stat-value">{stats.userCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rounds played</div>
          <div className="stat-value">{stats.roundCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total wagered</div>
          <div className="stat-value">KES {(stats.totalWageredCents / 100).toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total paid out</div>
          <div className="stat-value">KES {(stats.totalPaidOutCents / 100).toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">House profit</div>
          <div className={`stat-value ${stats.houseProfitCents >= 0 ? "positive" : "negative"}`}>
            KES {(stats.houseProfitCents / 100).toFixed(2)}
          </div>
        </div>
      </div>

      <h3 className="section-title">Recent rounds</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Round</th>
            <th>Crash</th>
            <th>Bets</th>
            <th>Wagered</th>
            <th>Paid out</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r.id}>
              <td>#{r.id}</td>
              <td>{(r.crash_point / 100).toFixed(2)}x</td>
              <td>{r.betCount}</td>
              <td>KES {(r.wagered / 100).toFixed(2)}</td>
              <td>KES {(r.paidOut / 100).toFixed(2)}</td>
              <td className="muted">{new Date(r.created_at + "Z").toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="section-title">Users</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Balance</th>
            <th>Wagered</th>
            <th>Won</th>
            <th>Admin</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>KES {(u.balance / 100).toFixed(2)}</td>
              <td>KES {(u.totalWagered / 100).toFixed(2)}</td>
              <td>KES {(u.totalWon / 100).toFixed(2)}</td>
              <td>{u.is_admin ? "✓" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
