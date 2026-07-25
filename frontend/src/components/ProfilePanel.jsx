import { useEffect, useState, useCallback } from "react";
import { API_URL } from "../config/api.js";
import NestlinkDeposit from "../components/NestlinkDeposit.jsx";

const quickAmounts = [100, 200, 500, 1000];
const BASE_WITHDRAW_KES = 1000;
const WITHDRAW_STEP_KES = 2000;
const MAX_WITHDRAW_KES = 10000;

export default function ProfilePanel({ open, onClose, onOpenHelpFAQ, onOpenResponsibleGaming, onOpenTermsConditions, onOpenPrivacyPolicy, appUser, balance, logout, getFreshIdToken, refreshBalance }) {
  const balanceKes = balance / 100;
  const minWithdrawKes = Math.min(MAX_WITHDRAW_KES, BASE_WITHDRAW_KES + Math.floor(Math.max(0, balanceKes - BASE_WITHDRAW_KES) / WITHDRAW_STEP_KES) * WITHDRAW_STEP_KES);
  const [withdrawAmount, setWithdrawAmount] = useState(minWithdrawKes);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState("dark");

  // Referral state
  const [referralStats, setReferralStats] = useState(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [refWithdrawAmount, setRefWithdrawAmount] = useState(100);
  const [mpesaName, setMpesaName] = useState("");
  const [mpesaNumber, setMpesaNumber] = useState(appUser?.phone || "");

  const fetchReferralStats = useCallback(async () => {
    try {
      const token = await getFreshIdToken();
      const res = await fetch(`${API_URL}/api/referrals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setReferralStats({
          code: data.code || "----",
          referralLink: data.referralLink || `https://kuomoka.co.ke/?ref=${data.code || ""}`,
          currentBalance: data.currentBalance || 0,
          lifetimeEarnings: data.lifetimeEarnings || 0,
          withdrawnEarnings: data.withdrawnEarnings || 0,
          pendingEarnings: data.pendingEarnings || 0,
          activities: data.activities || []
        });
      }
    } catch (e) {
      console.error("Failed to fetch referral stats:", e);
    }
  }, [getFreshIdToken]);

  useEffect(() => {
    if (open) {
      fetchReferralStats();
      if (appUser?.phone && !mpesaNumber) {
        setMpesaNumber(appUser.phone);
      }
    }
  }, [open, fetchReferralStats, appUser]);

  useEffect(() => {
    if (!open) return;
    document.body.classList.toggle("theme-dark", theme === "dark");
  }, [open, theme]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast, open]);

  function updateAmount(value, setter) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setter(Math.max(0, Math.floor(numeric)));
  }

  function changePreset(amount, setter) {
    setter(amount);
  }

  async function handleWithdraw() {
    const requestedAmount = Number(withdrawAmount);
    const currentBalanceKes = balance / 100;
    const minimumAllowed = Math.min(MAX_WITHDRAW_KES, BASE_WITHDRAW_KES + Math.floor(Math.max(0, currentBalanceKes - BASE_WITHDRAW_KES) / WITHDRAW_STEP_KES) * WITHDRAW_STEP_KES);

    if (Number.isNaN(requestedAmount) || requestedAmount < minimumAllowed) {
      showMockToast(`Minimum withdrawal is KES ${minimumAllowed}.`);
      return;
    }

    if (requestedAmount > MAX_WITHDRAW_KES) {
      showMockToast(`Maximum withdrawal is KES ${MAX_WITHDRAW_KES}.`);
      return;
    }

    if (currentBalanceKes < minimumAllowed) {
      showMockToast(`You need at least KES ${minimumAllowed} to withdraw.`);
      return;
    }

    if (currentBalanceKes < requestedAmount) {
      showMockToast(`Insufficient balance. You only have KES ${currentBalanceKes.toFixed(2)}.`);
      return;
    }

    showMockToast(`Withdrawal request received for KES ${requestedAmount}.`);
  }

  async function handleReferralWithdraw() {
    if (refWithdrawAmount < 100) {
      showMockToast("Minimum withdrawal is KES 100");
      return;
    }
    if (!mpesaName || !mpesaNumber) {
      showMockToast("Please provide M-Pesa name and number");
      return;
    }

    setWithdrawLoading(true);
    try {
      const token = await getFreshIdToken();
      const res = await fetch(`${API_URL}/api/referrals/withdraw`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: refWithdrawAmount,
          mpesaNumber,
          mpesaName
        })
      });
      const data = await res.json();
      if (res.ok) {
        showMockToast(`Withdrawal successful! Code: ${data.withdrawalCode}`);
        fetchReferralStats();
      } else {
        showMockToast(data.error || "Withdrawal failed");
      }
    } catch (e) {
      showMockToast("Failed to process withdrawal");
    } finally {
      setWithdrawLoading(false);
    }
  }

  async function fetchHistory() {
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const token = await getFreshIdToken();
      const res = await fetch(`${API_URL}/api/wallet/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(data.bets || []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  const showMockToast = (message) => {
    setToast(message);
  };

  if (!open) return null;

  return (
    <div className="about-panel-overlay" onClick={onClose}>
      <div className="about-panel" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="about-panel-header">
          <div>
            <div className="about-panel-title">Account & Support</div>
            <div className="about-panel-subtitle">Manage funds, view transactions, and get help.</div>
          </div>
          <button className="about-panel-close" onClick={onClose} aria-label="Close profile panel">
            ×
          </button>
        </div>

        <div className="about-section user-row">
          <div className="avatar-circle">{appUser?.username?.[0] || "U"}</div>
          <div>
            <div className="user-name">{appUser?.username || "Player"}</div>
            <div className="user-phone">{appUser?.phone ? `+${appUser.phone}` : null}</div>
            <div className="user-balance">KES {(balance / 100).toFixed(2)}</div>
          </div>
        </div>

        <div className="about-card">
          <div className="section-heading">Deposit</div>
          <NestlinkDeposit
            token={getFreshIdToken}
            presets={[100, 150, 200]}
            userPhone={appUser?.phone}
            onSuccess={async (result) => {
              await refreshBalance?.();
            }}
            onBalanceUpdate={async (newBalance) => {
              await refreshBalance?.();
            }}
          />
        </div>

        <div className="about-card">
          <div className="section-heading">Withdraw</div>
          <div className="stepper-row">
            <button className="stepper-btn" onClick={() => changePreset(Math.max(0, withdrawAmount - 100), setWithdrawAmount)}>-</button>
            <input
              type="number"
              min="0"
              value={withdrawAmount}
              onChange={(e) => updateAmount(e.target.value, setWithdrawAmount)}
            />
            <button className="stepper-btn" onClick={() => changePreset(withdrawAmount + 100, setWithdrawAmount)}>+</button>
          </div>
          <button className="primary-action withdraw-btn" onClick={handleWithdraw}>Withdraw with M-Pesa</button>
        </div>

        <div className="about-card">
          <div className="section-heading">Referral Ambassador Program</div>
          {referralStats ? (
            <div className="referral-dashboard">
              <div className="promo-deposit" style={{ padding: 12, borderRadius: 10, marginBottom: 12 }}>
                <div className="promo-title">Earn 50% Commission!</div>
                <div className="promo-sub">Betrukia is giving 50% bonus for every friend's deposit.</div>
              </div>

              <div className="referral-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div className="stat-item" style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
                  <div className="stats-label">Balance</div>
                  <div className="user-balance" style={{ fontSize: 18 }}>KES {(Number(referralStats.currentBalance || 0) / 100).toFixed(2)}</div>
                </div>
                <div className="stat-item" style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
                  <div className="stats-label">Lifetime</div>
                  <div className="user-balance" style={{ fontSize: 18, color: '#4ade80' }}>KES {(Number(referralStats.lifetimeEarnings || 0) / 100).toFixed(2)}</div>
                </div>
              </div>

              <div className="referral-link-box" style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <div className="stats-label">Your Referral Link</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input readOnly value={referralStats.referralLink} style={{ flex: 1, background: 'transparent', border: 'none', color: '#60a5fa', fontSize: 12 }} />
                  <button className="link-btn" onClick={() => { navigator.clipboard.writeText(referralStats.referralLink); showMockToast("Link copied!"); }}>Copy</button>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <div className="stats-label">Code: <span style={{ color: '#fff' }}>{referralStats.code}</span></div>
                  <button className="link-btn" onClick={() => { navigator.clipboard.writeText(referralStats.code); showMockToast("Code copied!"); }}>Copy Code</button>
                </div>
              </div>

              <div className="referral-withdraw-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                <div className="section-heading" style={{ fontSize: 14 }}>Withdraw Earnings (Min KES 100)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input type="number" placeholder="Amount" value={refWithdrawAmount} onChange={(e) => setRefWithdrawAmount(e.target.value)} className="wallet-input" style={{ marginBottom: 0 }} />
                  <input type="text" placeholder="M-Pesa Name" value={mpesaName} onChange={(e) => setMpesaName(e.target.value)} className="wallet-input" style={{ marginBottom: 0 }} />
                  <input type="tel" placeholder="M-Pesa Number" value={mpesaNumber} onChange={(e) => setMpesaNumber(e.target.value)} className="wallet-input" style={{ marginBottom: 0 }} />
                  <button className="wallet-action-btn withdraw-btn" onClick={handleReferralWithdraw} disabled={withdrawLoading}>
                    {withdrawLoading ? "Processing..." : "Withdraw to M-Pesa"}
                  </button>
                </div>
              </div>

              <div className="social-links" style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <a href={`https://wa.me/?text=Join%20Betrukia%20and%20get%2050%25%20bonus%20on%20your%20first%20deposit!%20Use%20my%20link:%20${encodeURIComponent(referralStats.referralLink)}`} target="_blank" rel="noreferrer" className="secondary-action" style={{ flex: 1, textAlign: 'center', background: '#25D366', color: '#fff' }}>WhatsApp</a>
                <a href={`https://t.me/share/url?url=${encodeURIComponent(referralStats.referralLink)}&text=Join%20Betrukia!`} target="_blank" rel="noreferrer" className="secondary-action" style={{ flex: 1, textAlign: 'center', background: '#0088cc', color: '#fff' }}>Telegram</a>
              </div>

              <div className="activities-list" style={{ marginTop: 16 }}>
                <div className="section-heading" style={{ fontSize: 14 }}>Recent Activity</div>
                {referralStats.activities?.length > 0 ? (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {referralStats.activities.map((act, i) => (
                      <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: act.event_type === 'withdrawal' ? '#fb7185' : '#4ade80' }}>
                            {act.event_type === 'withdrawal' ? 'Withdrawal' : `Deposit from ${act.friend_name || 'Friend'}`}
                          </span>
                          <span>KES {(Number(act.amount || 0) / 100).toFixed(2)}</span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: 10 }}>{new Date(act.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>No activity yet. Share your link to start earning!</div>
                )}
              </div>
            </div>
          ) : (
            <div className="muted">Loading referral dashboard...</div>
          )}
        </div>

        <div className="about-card">
          <div className="section-heading">My Transactions</div>
          <button className="secondary-action" onClick={fetchHistory}>
            {historyOpen ? "Refresh transactions" : "View transaction history"}
          </button>
          {historyOpen && (
            <div className="transactions-table-wrapper">
              {loadingHistory ? (
                <div className="muted">Loading…</div>
              ) : history.length === 0 ? (
                <div className="muted">No transaction history yet.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Multiplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 12).map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.created_at + "Z").toLocaleDateString()}</td>
                        <td>KES {(item.amount / 100).toFixed(2)}</td>
                        <td>{item.status}</td>
                        <td>{item.crash_point ? `${(item.crash_point / 100).toFixed(2)}x` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="about-card">
          <div className="section-heading">Preferences</div>
          <div className="toggle-row">
            <span>Theme</span>
            <button className="secondary-action" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </div>

        <div className="about-card">
          <div className="section-heading">Support</div>
          <button className="secondary-action" onClick={onOpenHelpFAQ}>Help / FAQ</button>
          <button className="secondary-action" onClick={onOpenResponsibleGaming}>Responsible Gaming</button>
          <button className="secondary-action" onClick={() => showMockToast("Delete account requests: Call 0722989898 or email rugendo49@gmail.com")}>Delete Account</button>
          <button className="primary-action signout-btn" onClick={logout}>Sign Out</button>
        </div>

        <div className="about-footer">
          <button className="footer-link" onClick={onOpenTermsConditions}>Terms & Conditions</button>
          <button className="footer-link" onClick={onOpenPrivacyPolicy}>Privacy Policy</button>
          <div className="footer-note">18+ — Gambling may have adverse effects if not done with moderation. [License info pending]</div>
        </div>

        {toast && <div className="toast-banner">{toast}</div>}
      </div>
    </div>
  );
}
