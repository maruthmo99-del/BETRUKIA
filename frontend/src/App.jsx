import { useEffect, useState, useCallback } from "react";
import AuthForm from "./components/AuthForm.jsx";
import Landing from "./components/Landing.jsx";
import AviatorLanding from "./components/AviatorLanding.jsx";
import MultiplierDisplay from "./components/MultiplierDisplay.jsx";
import BetPanel from "./components/BetPanel.jsx";
import AllBetsPanel from "./components/AllBetsPanel.jsx";
import History from "./components/History.jsx";
import AdminDashboard from "./components/AdminDashboard.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import CashoutPopup from "./components/CashoutPopup.jsx";
import HelpFAQ from "./components/HelpFAQ.jsx";
import ResponsibleGaming from "./components/ResponsibleGaming.jsx";
import TermsConditions from "./components/TermsConditions.jsx";
import PrivacyPolicy from "./components/PrivacyPolicy.jsx";
import { useGameSocket } from "./hooks/useGameSocket.js";
import { useAuth } from "./hooks/useAuth.js";
import { API_URL } from "./config/api.js";

export default function App() {
  const { appUser, loading, authError, signUp, signIn, logout, getFreshIdToken, refreshBalance } = useAuth();
  const [tab, setTab] = useState("play"); // play | leaderboard | stats | admin | wallet | about | contact | help

  const [demoMode, setDemoMode] = useState(false);
  const [demoBalance, setDemoBalance] = useState(() => {
    const saved = window.localStorage.getItem("omoka-demo-balance");
    return saved !== null ? Number(saved) : 1000000;
  });

  useEffect(() => {
    if (demoMode) {
      window.localStorage.setItem("omoka-demo-balance", String(demoBalance));
    }
  }, [demoBalance, demoMode]);

  const startDemoMode = useCallback(async () => {
    // Request server-side demo account (creates it if missing) and use its balance
    try {
      const res = await fetch(`${API_URL}/api/auth/demo`, { method: "POST" });
      const json = await res.json();
      const bal = json?.user?.balance ?? 1000000;
      window.localStorage.setItem("omoka-demo-balance", String(bal));
      setDemoBalance(bal);
    } catch (err) {
      // fallback to local demo balance
      window.localStorage.setItem("omoka-demo-balance", String(1000000));
      setDemoBalance(1000000);
    }
    setDemoMode(true);
    setTab("play");
  }, []);

  const stopDemoMode = useCallback(() => {
    setDemoMode(false);
    setTab("play");
  }, []);

  // Use a demo pseudo-user when in demo mode so the UI looks "logged in"
  const displayUser = demoMode
    ? { id: "demo", username: "Player", balance: demoBalance, isAdmin: false }
    : appUser;

  const userId = demoMode ? displayUser.id : appUser?.id ?? null;

  // Wrap the token getter so demo mode can authenticate using the literal "demo" token
  const getToken = useCallback(async () => {
    if (demoMode) return "demo";
    return await getFreshIdToken();
  }, [demoMode, getFreshIdToken]);

  const { phase, multiplier, seedHash, lastCrash, history, config, slots, waitMs, waitStartedAt, flightStartTime, finalCrashMultiplier, allBets, connected, countdownSeconds, watchdogStatus, placeBet, cashOut, cancelBet, cashoutEvent, chatMessages, onlineUsers, sendChat } =
    useGameSocket(getToken, userId, demoMode, demoBalance, setDemoBalance, refreshBalance);

  const balance = displayUser ? displayUser.balance : 0;
  const [aboutOpen, setAboutOpen] = useState(false);
  const [route, setRoute] = useState(() => window.location.hash || "");

  const goToAuth = useCallback(() => {
    window.location.hash = "";
    setRoute("");
    setTimeout(() => {
      const authTarget = document.querySelector(".auth-top-right");
      if (authTarget) {
        authTarget.scrollIntoView({ behavior: "smooth", block: "nearest" });
        authTarget.querySelector("input[type='email'], input[type='password']")?.focus();
      }
    }, 80);
  }, []);

  const showAbout = useCallback(() => {
    if (demoMode || appUser) {
      setAboutOpen(true);
      return;
    }
    window.location.hash = "";
    setTimeout(() => document.querySelector(".about-intro")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
  }, [appUser, demoMode]);

  const openHelpFAQ = useCallback(() => {
    setTab("help");
  }, []);

  const openResponsibleGaming = useCallback(() => {
    setTab("responsible");
  }, []);

  const openTermsConditions = useCallback(() => {
    setTab("terms");
  }, []);

  const openPrivacyPolicy = useCallback(() => {
    setTab("privacy");
  }, []);

  const openAboutSection = useCallback((section) => {
    if (demoMode || appUser) {
      setAboutOpen(true);
      setRoute(`#/${section}`);
      window.location.hash = `#/${section}`;
      setTimeout(() => {
        if (section === "deposit") {
          const depositInput = document.querySelector('.about-card .wallet-input[type="number"]');
          if (depositInput) depositInput.focus();
        }
        if (section === "withdraw") {
          const withdrawInput = document.querySelector('.about-card .stepper-row input[type="number"]');
          if (withdrawInput) withdrawInput.focus();
        }
      }, 180);
      return;
    }

    showAbout();
  }, [appUser, demoMode, showAbout]);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // react to deposit/referrals routes when authenticated
  useEffect(() => {
    if (route === "#/deposit") {
      if (demoMode || appUser) {
        setAboutOpen(true);
        setTimeout(() => {
          const input = document.querySelector('.about-card .wallet-input[type="number"]');
          if (input) input.focus();
        }, 150);
      } else {
        window.location.hash = "";
        setTimeout(() => document.querySelector('.auth-top-right')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
      }
    }

    if (route === "#/withdraw") {
      if (demoMode || appUser) {
        setAboutOpen(true);
        setTimeout(() => {
          const input = document.querySelector('.about-card .stepper-row input[type="number"]');
          if (input) input.focus();
        }, 150);
      } else {
        window.location.hash = "";
        setTimeout(() => document.querySelector('.auth-top-right')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
      }
    }

    if (route === "#/referrals") {
      if (demoMode || appUser) {
        // open profile panel and show a toast or referral area (not implemented)
        setAboutOpen(true);
        setTimeout(() => {
          // optionally focus referral UI when implemented
        }, 150);
      } else {
        window.location.hash = "";
        setTimeout(() => document.querySelector('.auth-top-right')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
      }
    }
  }, [route, demoMode, appUser]);
  

  async function handleDeposit(amountCents) {
    // Placeholder - would integrate with payment gateway
    try {
      // Simulate deposit
      await refreshBalance();
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  async function handleWithdraw(amountCents) {
    // Placeholder - would integrate with payment gateway
    try {
      // Simulate withdrawal
      await refreshBalance();
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  if (loading) {
    return <div className="app-shell centered muted">Loading…</div>;
  }

  if (!appUser && !demoMode) {
    if (route === "#/aviator") {
      return <AviatorLanding onBack={goToAuth} onPlace={goToAuth} />;
    }

    return (
      <Landing onDemo={startDemoMode} onPlaceBet={goToAuth}>
        <AuthForm signUp={signUp} signIn={signIn} authError={authError} />
      </Landing>
    );
  }

  return (
    <div className="app-shell">
      <CashoutPopup event={cashoutEvent} />
      {!connected && !demoMode && (
        <div className="connection-banner" role="status">
          Reconnecting to the live game server for the latest rounds.
        </div>
      )}
      <header className="topbar">
        <h1 className="brand-mark">RUKIA</h1>
        <div className="topbar-right">
          <span className={`live-status ${connected ? "online" : "connecting"}`}>
            <span className="live-dot" />
            {connected ? "Live" : "Connecting"}
          </span>
          <span className="topbar-balance">KES {(balance / 100).toFixed(2)}</span>
          <button className="topbar-pill" onClick={() => openAboutSection("deposit")}>
            Deposit
          </button>
          <button className="topbar-pill" onClick={() => openAboutSection("withdraw")}>
            Withdraw
          </button>
          <button className="topbar-pill" onClick={showAbout}>
            About
          </button>

          {demoMode ? (
            <>
              <div className="user-badge">
                <span className="username-label">{displayUser.username}</span>
                <span className="user-phone">Demo Account</span>
              </div>
              <button className="link-btn" onClick={stopDemoMode}>
                Exit demo
              </button>
            </>
          ) : (
            <>
              <div className="user-badge">
                <span className="username-label">{appUser?.username || "User"}</span>
                {appUser?.phone ? <span className="user-phone">+{appUser.phone}</span> : null}
              </div>
              <button className="link-btn" onClick={logout}>
                Log out
              </button>
            </>
          )}
        </div>
        {/* Mobile-only top actions: username, logout, about (visible only on small screens) */}
        <div className="mobile-top-actions">
          {demoMode ? (
            <>
              <div className="mobile-username">{displayUser.username}</div>
              <button className="link-btn" onClick={stopDemoMode}>Exit demo</button>
            </>
          ) : (
            <>
              <div className="mobile-username">{appUser?.username}</div>
              <button className="link-btn" onClick={logout}>Log out</button>
              <button className="topbar-pill" onClick={() => openAboutSection("deposit")}>Deposit</button>
              <button className="topbar-pill" onClick={() => openAboutSection("withdraw")}>Withdraw</button>
              <button className="topbar-pill" onClick={showAbout}>About</button>
            </>
          )}
        </div>
      </header>
      <nav className="tab-nav">
        <div className="mobile-balance">KES {(balance / 100).toFixed(2)}</div>
        <button className={tab === "play" ? "active" : ""} onClick={() => setTab("play")}>Play</button>
        <button className={tab === "aviator" ? "active" : ""} onClick={() => {
          if (demoMode || appUser) {
            setTab('play');
          } else {
            window.location.hash = '#/aviator';
          }
        }}>Aviator</button>
        {appUser?.isAdmin && (
          <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
            Admin
          </button>
        )}
      </nav>

      

      {tab === "play" && (
        <div className="play-tab-content">
          <History history={history} />
          <div className="play-layout">
            <AllBetsPanel allBets={allBets} />
            <div className="play-main">
              <MultiplierDisplay
                phase={phase}
                multiplier={multiplier}
                lastCrash={lastCrash}
                seedHash={seedHash}
                waitMs={waitMs}
                waitStartedAt={waitStartedAt}
                flightStartTime={flightStartTime}
                finalCrashMultiplier={finalCrashMultiplier}
              />
              <BetPanel
                phase={phase}
                balance={balance}
                config={config}
                slots={slots}
                placeBet={async (...args) => {
                  const res = await placeBet(...args);
                  if (res?.ok) refreshBalance();
                  return res;
                }}
                cashOut={async (...args) => {
                  const res = await cashOut(...args);
                  if (res?.ok) refreshBalance();
                  return res;
                }}
                cancelBet={async (...args) => {
                  const res = await cancelBet(...args);
                  if (res?.ok) refreshBalance();
                  return res;
                }}
                multiplier={multiplier}
              />
            </div>
            <ChatPanel chatMessages={chatMessages} onlineUsers={onlineUsers} sendChat={sendChat} isAdmin={!!appUser?.isAdmin} />
          </div>
        </div>
      )}

      {tab === "admin" && appUser?.isAdmin && <AdminDashboard getToken={getFreshIdToken} />}
      {tab === "help" && <HelpFAQ />}
      {tab === "responsible" && <ResponsibleGaming />}
      {tab === "terms" && <TermsConditions />}
      {tab === "privacy" && <PrivacyPolicy />}

      <ProfilePanel
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onOpenHelpFAQ={openHelpFAQ}
        onOpenResponsibleGaming={openResponsibleGaming}
        onOpenTermsConditions={openTermsConditions}
        onOpenPrivacyPolicy={openPrivacyPolicy}
        appUser={appUser}
        balance={balance}
        logout={logout}
        getFreshIdToken={getFreshIdToken}
        refreshBalance={refreshBalance}
      />
      <div className="provably-fair-footer" style={{ marginTop: 18, padding: '12px 18px', fontSize: 13, color: '#9aa8b8' }}>
        <strong>🔒 Provably Fair:</strong> Each crash point is cryptographically random using server seed + round ID. Results are <em>unpredictable</em> until revealed.
      </div>
      
    </div>
  );
}