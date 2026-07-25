// backend/src/game/botPlayers.js
//
// Simulated "bot" players for the ALL BETS panel.
//
// WHY THIS EXISTS
// A brand-new / low-traffic round looks dead with an empty bet list, which can
// discourage real players. This module fills that panel with clearly-labeled
// simulated activity.
//
// GUARDRAILS (do not remove these)
//   1. Bots NEVER touch the database. No rows in `users` or `bets` are ever
//      created or modified for a bot.
//   2. Bots NEVER touch real money / wallet balances. No `wallet:update`
//      events are ever emitted for a bot.
//   3. Bots use negative, out-of-range userIds (BOT_ID_BASE - index) so they
//      can never collide with a real user id.
//   4. Every bot event carries `isBot: true` so the frontend can label it.
//      Do not strip this flag before emitting.
//
// If you're tempted to make bots "more realistic" by giving them real-looking
// positive user ids or removing the isBot flag, don't — that turns this from
// a transparent liveliness feature into a deceptive one.

const BOT_ID_BASE = -1000; // bot userIds are BOT_ID_BASE, BOT_ID_BASE - 1, ...

// First names + last initials are combined to generate enough unique display
// names for up to a few hundred concurrent bots without visible repeats
// within a single round (30 x 26 = 780 possible combinations).
const BOT_FIRST_NAMES = [
  "Mwangi", "Achieng", "Kiptoo", "Wanjiru", "Otieno", "Njeri", "Barasa",
  "Cherono", "Mutua", "Adhiambo", "Kamau", "Wafula", "Nyambura", "Kiplagat",
  "Auma", "Omondi", "Chebet", "Njoroge", "Akinyi", "Rotich", "Muthoni",
  "Odhiambo", "Wambui", "Kimani", "Nekesa", "Maina", "Atieno", "Kariuki",
  "Naliaka", "Gathoni",
];
const BOT_LAST_INITIALS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function buildNamePool() {
  const pool = [];
  for (const first of BOT_FIRST_NAMES) {
    for (const initial of BOT_LAST_INITIALS) {
      pool.push(`${first} ${initial}.`);
    }
  }
  return pool;
}
const BOT_NAME_POOL = buildNamePool();

// Stake distribution SHAPE: relative weight of each tier (how big a slice of
// the round's bots bet at roughly this stake). Actual per-round counts are
// scaled proportionally from these weights to whatever total is picked for
// that round (see BOT_ROUND_TOTALS below) — so the shape holds whether the
// round has 70 bots or 250 bots, instead of these being fixed floors.
//
// `base` is in KES cents (100 cents = KES 1); `jitter` is the +/- fraction
// applied to `base` so amounts never repeat exactly round to round.
const BOT_STAKE_TIERS = [
  { weight: 2, base: 1000000, jitter: 0.12 },  // ~KES 10,000
  { weight: 1, base: 800000, jitter: 0.12 },   // ~KES 8,000
  { weight: 2, base: 650000, jitter: 0.12 },   // ~KES 6,500
  { weight: 3, base: 500000, jitter: 0.12 },   // ~KES 5,000
  { weight: 10, base: 100000, jitter: 0.15 },  // ~KES 1,000
  { weight: 7, base: 50000, jitter: 0.15 },    // ~KES 500
  { weight: 10, base: 20000, jitter: 0.2 },    // ~KES 200
  { weight: 70, base: 10000, jitter: 0.2 },    // ~KES 100
  { weight: 15, base: 5000, jitter: 0.25 },    // ~KES 50
  { weight: 10, base: 2000, jitter: 0.25 },    // ~KES 20
  { weight: 8, base: 1000, jitter: 0.3 },      // ~KES 10
];
const BOT_TOTAL_WEIGHT = BOT_STAKE_TIERS.reduce((sum, t) => sum + t.weight, 0);

// How many bots place a bet this round is picked from this pool each round
// (with a little jitter so it's not always exactly one of these numbers),
// so the panel visibly swings between quiet and busy-looking rounds instead
// of hovering in one narrow band.
const BOT_ROUND_TOTALS = [70, 90, 110, 130, 160, 190, 220, 250];

function jitteredAmount(baseCents, jitterPct) {
  const factor = 1 + (Math.random() * 2 - 1) * jitterPct;
  const raw = baseCents * factor;
  // round to the nearest whole KES (100 cents) so amounts look natural
  return Math.max(1000, Math.round(raw / 100) * 100);
}

function pickRoundTotal() {
  const base = BOT_ROUND_TOTALS[Math.floor(Math.random() * BOT_ROUND_TOTALS.length)];
  const jittered = Math.round(base * (1 + (Math.random() * 2 - 1) * 0.1)); // +/-10%
  return Math.max(10, jittered);
}

// Proportionally allocates `total` bots across BOT_STAKE_TIERS using the
// largest-remainder method, so counts always sum to exactly `total` — this
// is what lets the same tier "shape" work whether total is 70 or 250.
function allocateTierCounts(total) {
  const raw = BOT_STAKE_TIERS.map((tier) => (tier.weight / BOT_TOTAL_WEIGHT) * total);
  const counts = raw.map((n) => Math.floor(n));
  let allocated = counts.reduce((sum, n) => sum + n, 0);
  let remaining = total - allocated;

  // Distribute leftover bots (from rounding down) to the tiers with the
  // largest fractional remainder first.
  const remainders = raw
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; k < remainders.length && remaining > 0; k++) {
    counts[remainders[k].i] += 1;
    remaining--;
  }

  return counts;
}

// Builds the full list of bot bet amounts for one round, matching the tier
// shape proportionally to `total`.
function buildBotAmounts(total) {
  const counts = allocateTierCounts(total);
  const amounts = [];
  BOT_STAKE_TIERS.forEach((tier, i) => {
    for (let n = 0; n < counts[i]; n++) {
      amounts.push(jitteredAmount(tier.base, tier.jitter));
    }
  });

  // Shuffle so the panel doesn't render in tier order (big stakes first, etc).
  return amounts.sort(() => Math.random() - 0.5);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Attaches the bot engine to a live RoundManager instance.
 * @param {import("socket.io").Server} io
 * @param {import("./roundManager.js").RoundManager} roundManager
 * @param {object} [opts]
 * @param {number} [opts.minBots=150] minimum number of bots that place a bet each round
 * @param {number} [opts.maxBots=200] maximum number of bots that place a bet each round
 * @param {number} [opts.loseFraction=0.35] fraction of bots that ride the bet down (no cashout)
 */
export function attachBotPlayers(io, roundManager, opts = {}) {
  const {
    minBots = 150,
    maxBots = 200,
    loseFraction = 0.35,
  } = opts;

  let pendingTimers = [];
  // bots that placed a bet this round and haven't cashed out yet:
  // Map<botUserId, { username, amount, slot, cashedOut }>
  let roundBots = new Map();

  function clearTimers() {
    for (const t of pendingTimers) clearTimeout(t);
    pendingTimers = [];
  }

  function scheduleBotBets(waitMs) {
    roundBots = new Map();
    const targetTotal = Math.floor(randomBetween(minBots, maxBots + 1));
    const amounts = buildBotAmounts(targetTotal);
    const shuffledNames = [...BOT_NAME_POOL].sort(() => Math.random() - 0.5);
    const botCount = Math.min(amounts.length, shuffledNames.length);

    for (let i = 0; i < botCount; i++) {
      const username = shuffledNames[i];
      const botUserId = BOT_ID_BASE - i;
      const amount = amounts[i];
      const slot = 1; // bots always bet in the primary slot
      // Spread bot bets across the betting window so they trickle in,
      // rather than dumping hundreds of rows in at once.
      const placeAt = randomBetween(100, Math.max(300, waitMs - 300));

      const timer = setTimeout(() => {
        const bet = { userId: botUserId, username, amount, slot, cashedOut: false, isBot: true };
        roundBots.set(botUserId, bet);
        io.emit("bet:new", {
          betId: `bot-${roundManager.roundId}-${botUserId}`,
          userId: botUserId,
          username,
          amount,
          slot,
          autoCashoutAt: null,
          createdAt: new Date().toISOString(),
          isBot: true,
        });
      }, placeAt);

      pendingTimers.push(timer);
    }
  }

  function scheduleBotCashouts(flyStart, crashPoint) {
    // Give each bot a target cashout multiplier below the (server-only) crash
    // point. A fraction of bots deliberately never cash out, so it also looks
    // like some bots "lose" — matching how a real crowd behaves.
    for (const bot of roundBots.values()) {
      if (Math.random() < loseFraction) continue; // this bot rides it down and loses

      // Pick a target somewhere in the lower~mid range of the round's actual
      // ceiling, so bot cashouts never appear to "predict" the crash.
      const ceiling = Math.max(101, Math.floor(crashPoint * 0.9));
      const target = Math.floor(randomBetween(101, ceiling));
      const elapsedMs = Math.log(target / 100) / 0.00012; // inverse of multiplierAtElapsed's growth curve

      const timer = setTimeout(() => {
        if (bot.cashedOut) return;
        bot.cashedOut = true;
        const payout = Math.floor((bot.amount * target) / 100);
        io.emit("bet:cashed_out", {
          userId: bot.userId,
          slot: bot.slot,
          auto: false,
          multiplier: target,
          payout,
          balance: null, // bots have no real wallet — frontend must not read this for bots
          isBot: true,
        });
      }, Math.max(0, elapsedMs - (Date.now() - flyStart)));

      pendingTimers.push(timer);
    }
  }

  roundManager.onEvent((eventName, payload) => {
    if (eventName === "waiting") {
      clearTimers();
      scheduleBotBets(payload.waitMs);
    } else if (eventName === "flying") {
      scheduleBotCashouts(payload.flyStart, payload.crashPoint);
    } else if (eventName === "crashed") {
      clearTimers();
    }
  });
}