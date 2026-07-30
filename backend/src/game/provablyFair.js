import crypto from "crypto";

const MAX_HEX_INT = Math.pow(2, 52);

export function generateServerSeed() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSeed(serverSeed) {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}

// House edge: the fraction of rounds that instantly crash at 1.00x, and also
// the fraction shaved off the payout curve for every other round. 0.02 = 2%.
const HOUSE_EDGE = 0.02;

/**
 * Computes a crash point using a continuous provably-fair curve (the same
 * approach used by standard crash games like Aviator/Spribe-style titles),
 * rather than fixed brackets. This naturally produces a smooth, unpredictable
 * spread: most rounds cluster low (roughly half crash under ~2x), it gets
 * steadily rarer to reach higher multipliers, and there is no fixed pattern
 * or relationship between one round's result and the next.
 *
 * Formula: crashPoint = floor(100 * (1 - HOUSE_EDGE) / (1 - X)) / 100
 * where X is a uniform random float in [0, 1) derived from the round hash.
 * A HOUSE_EDGE-sized slice of rounds instantly resolve at 1.00x — this is
 * what gives the house its edge; every other multiplier is unpredictable
 * and can fall anywhere from just above 1.00x up to the cap below.
 */
export function computeCrashPoint(serverSeed, roundId, clientSeed = "rukia") {
  const combined = `${serverSeed}:${roundId}:${clientSeed}`;
  const hash = crypto.createHash("sha256").update(combined).digest("hex");

  const h = parseInt(hash.slice(0, 13), 16);
  const X = h / MAX_HEX_INT; // Uniformly distributed float between 0 and 1

  const maxCap = 2000000; // 20,000.00x hard ceiling

  if (X < HOUSE_EDGE) {
    return 100; // instant 1.00x crash — this is the house edge portion
  }

  const raw = Math.floor((100 * (1 - HOUSE_EDGE)) / (1 - X));
  const crashMultiplierHundredths = Math.min(maxCap, raw);

  const safe = Number.isFinite(crashMultiplierHundredths) ? crashMultiplierHundredths : 100;
  return Math.max(100, safe);
}

export function verifyRound(serverSeed, roundId, clientSeed, claimedCrashPoint, claimedHash) {
  const recomputedHash = hashSeed(serverSeed);
  const recomputedCrash = computeCrashPoint(serverSeed, roundId, clientSeed);
  return {
    hashMatches: recomputedHash === claimedHash,
    crashMatches: recomputedCrash === claimedCrashPoint,
    recomputedHash,
    recomputedCrash,
  };
}
