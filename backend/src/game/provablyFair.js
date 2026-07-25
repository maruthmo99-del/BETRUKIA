import crypto from "crypto";

const MAX_HEX_INT = Math.pow(2, 52);

export function generateServerSeed() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSeed(serverSeed) {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}

/**
 * Computes a crash point based on explicit probability distributions:
 * - 30% chance: Randomly between 1.00x and 1.99x
 * - 50% chance: Randomly between 2.10x and 45.00x
 * - 20% chance: Randomly from 45.10x climbing out towards infinity
 */
export function computeCrashPoint(serverSeed, roundId, clientSeed = "rukia") {
  const combined = `${serverSeed}:${roundId}:${clientSeed}`;
  const hash = crypto.createHash("sha256").update(combined).digest("hex");
  
  const h = parseInt(hash.slice(0, 13), 16);
  const X = h / MAX_HEX_INT; // Uniformly distributed float between 0 and 1

  let crashMultiplierHundredths = 100;

  if (X < 0.30) {
    // 1. Bracket 1 (30% weight): 1.00x to 1.99x
    // Scale X from [0, 0.30) to [0, 1)
    const normalized = X / 0.30;
    crashMultiplierHundredths = 100 + Math.floor(normalized * 100);
  } else if (X < 0.80) {
    // 2. Bracket 2 (50% weight): 2.10x to 45.00x
    // Scale X from [0.30, 0.80) to [0, 1)
    const normalized = (X - 0.30) / 0.50;
    const minRange = 210;
    const maxRange = 4500;
    crashMultiplierHundredths = minRange + Math.floor(normalized * (maxRange - minRange + 1));
  } else {
    // 3. Bracket 3 (20% weight): 45.10x to Infinity
    // Scale X from [0.80, 1.00) to [0, 1)
    const normalized = (X - 0.80) / 0.20;
    const minRange = 4510;
    
    // Utilize an inverse Pareto distribution layout to map smoothly towards infinity
    // As normalized approaches 1, this curve grows exponentially
    const factor = 1 / (1 - normalized * 0.999); 
    crashMultiplierHundredths = Math.floor(minRange * factor);
  }

  // Final fallback validation clamp check
  const safe = Number.isFinite(crashMultiplierHundredths) ? crashMultiplierHundredths : 4510;
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
