import React from "react";

export default function AviatorLanding({ onBack, onPlace }) {
  function handlePlace() {
    if (onPlace) return onPlace();
    window.location.hash = "";
    setTimeout(() => document.querySelector('.auth-top-right')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  return (
    <div className="aviator-landing">
      <header className="aviator-hero">
        <div className="aviator-hero-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 12L22 2L13 22L11 13L2 12Z" fill="#F59E0B" />
            </svg>
            <div>
              <h1 className="aviator-headline">Rukia Aviator</h1>
              <p className="aviator-subheadline">Win big — up to 10 million weekly, up to 100 million monthly</p>
            </div>
          </div>

          <div className="aviator-ctas">
            <button className="hero-btn hero-btn--primary" onClick={handlePlace}>Place Your Bet</button>
            <button className="hero-btn hero-btn--ghost" onClick={onBack}>Back</button>
          </div>
          <p className="aviator-support">Track your betting record and grow your winnings over time — review history, refine your strategy, and play responsibly.</p>
        </div>
      </header>

      <section className="aviator-features">
        <div className="feature">Provably fair rounds</div>
        <div className="feature">Secure wallets & fast payouts</div>
        <div className="feature">Demo mode for practice</div>
      </section>
    </div>
  );
}
