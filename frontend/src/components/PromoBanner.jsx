import React, { useEffect } from "react";
import { trackEvent } from "../utils/analytics.js";

export default function PromoBanner() {
  const onDepositClick = () => {
    trackEvent('promo_click', { promo: 'first_deposit', label: 'Deposit Now' });
    // navigate to deposit route; App will open deposit panel if signed-in
    window.location.hash = "#/deposit";
  };

  const onReferralClick = () => {
    trackEvent('promo_click', { promo: 'referral', label: 'Refer a Friend' });
    window.location.hash = "#/referrals";
  };

  useEffect(() => {
    trackEvent('promo_impression', { promo: 'deposit_referral_banner' });
  }, []);

  return (
    <div className="promo-banner">
      <div className="promo-inner">
        <div className="promo-card promo-deposit">
          <div className="promo-content">
            <div className="promo-title">Get 50% Bonus on Your First Deposit</div>
            <div className="promo-sub">Make your first deposit and we'll add a 50% bonus to boost your play.</div>
          </div>
          <div className="promo-cta">
            <button className="hero-btn hero-btn--primary" onClick={onDepositClick}>Deposit Now</button>
          </div>
        </div>

        <div className="promo-card promo-referral">
          <div className="promo-content">
            <div className="promo-title">Become an Ambassador: 50% Commission</div>
            <div className="promo-sub">Earn 50% of every friend's deposit for a lifetime. Share your link and earn now!</div>
          </div>
          <div className="promo-cta">
            <button className="hero-btn hero-btn--ghost" onClick={onReferralClick}>Earn Now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
