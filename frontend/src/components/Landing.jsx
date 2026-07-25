import PromoBanner from "./PromoBanner.jsx";

const STEPS = [
  {
    n: "01",
    title: "Bet before takeoff",
    body: "Place your stake during the short boarding window, before the plane leaves the ground.",
  },
  {
    n: "02",
    title: "Watch the multiplier climb",
    body: "Once it's airborne, your potential payout grows with every second it stays in the air.",
  },
  {
    n: "03",
    title: "Cash out before it crashes",
    body: "Tap cash out any time. Wait too long and the plane crashes — your stake goes with it.",
  },
];

export default function Landing({ children, onDemo, onPlaceBet }) {
  function scrollToAuth() {
    document.querySelector(".auth-top-right")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const handlePlaceBet = () => {
    if (onPlaceBet) {
      onPlaceBet();
      return;
    }
    scrollToAuth();
  };

  const handleDemo = () => {
    if (onDemo) {
      onDemo();
    }
  };

  return (
    <div className="landing">
      <div className="aviator-banner" role="link" tabIndex={0} onClick={handlePlaceBet} onKeyDown={(e) => e.key === 'Enter' && handlePlaceBet()}>
        <div className="aviator-banner-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 12L22 2L13 22L11 13L2 12Z" fill="#F59E0B" />
            </svg>
            <div>
              <div className="aviator-banner-title">Rukia Aviator</div>
              <div className="aviator-banner-sub">Win big — up to 10 million weekly, up to 100 million monthly</div>
            </div>
          </div>
          <div className="aviator-banner-cta">Place Your Bet</div>
        </div>
      </div>
        
        {/* Promo banner for deposit and referral offers */}
        <PromoBanner />
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">RUKIA NA AVIATOR</div>
          <h1 className="hero-headline">
            Bet before
            <br />
            it flies away.
          </h1>
          <p className="hero-sub">
            A multiplier climbs from the moment the round takes off. Cash out whenever you like —
            just don't wait too long, because it can crash at any second.
          </p>
          <div className="hero-ctas">
            <button className="hero-btn hero-btn--primary" onClick={scrollToAuth}>
              Create free account
            </button>
            <button className="hero-btn hero-btn--ghost" onClick={scrollToAuth}>
              Log in
            </button>
            <button className="hero-btn hero-btn--secondary" onClick={handleDemo}>
              Try demo mode
            </button>
          </div>
          <div className="hero-fineprint">Every round is provably fair — verify any result yourself.</div>
          <div className="hero-badges" aria-label="Platform highlights">
            <span className="hero-badge">⚡ Live rounds</span>
            <span className="hero-badge">🎯 Fair by design</span>
            <span className="hero-badge">🛡️ Demo practice</span>
          </div>
        </div>

        <div className="hero-auth-panel">
          <div className="auth-top-right">{children}</div>
        </div>
      </section>

      <section className="about-intro">
        <h2 className="section-heading">About RUKIA</h2>
        <h3>What is RUKIA?</h3>
        <p>
          RUKIA is a provably fair crash-game platform built on transparent, verifiable randomness. Every round's outcome is predetermined using cryptographic hashing and can be verified by players at any time.
        </p>

        <h3>How It Works</h3>
        <p>
          In each round, an airplane takes flight and climbs toward a multiplier peak, starting at 1.00x and potentially reaching up to 20,000x. Players place bets before takeoff and cash out at any multiplier to secure their winnings. The round crashes at a random point determined by our provably fair algorithm.
        </p>

        <h3>Fair Play</h3>
        <p>
          Every crash point is predetermined using a combination of a server seed (kept secret until round end) and your client seed. This cryptographic approach ensures that neither RUKIA nor any player can manipulate the outcome during play. Verify any round's fairness by checking the seed hash.
        </p>

        <h3>Responsible Gaming</h3>
        <p>
          RUKIA is intended for entertainment. Set limits on your deposits and play responsibly. Never wager more than you can afford to lose.
        </p>

        <h3>Contact Us</h3>
        <p>
          Have questions or need support? Visit our <a href="#" className="link">Help &amp; Support</a> page or reach out directly at <a href="mailto:rukia@gmail.com" className="link">rukia@gmail.com</a>.
        </p>
      </section>

      <section className="steps-section">
        <h2 className="section-heading">How a round works</h2>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div className="step-card" key={s.n}>
              <div className="step-number">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-body">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="fairness-section">
        <h2 className="section-heading">Provably fair, not just promised</h2>
        <p className="fairness-body">
          Before each round starts, RUKIA publishes a cryptographic hash of that round's outcome —
          locked in before anyone bets. Once the round ends, the underlying value is revealed so you
          can recompute the hash yourself and confirm the result was set in advance, not adjusted
          after you placed your bet.
        </p>
      </section>

      
    </div>
  );
}
