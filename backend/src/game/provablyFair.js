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
 * - 35% chance: Randomly between 1.00x and 10.99x
 * - 20% chance: Randomly between 11.00x and 35.00x
 * - 15% chance: Randomly between 35.10x and 50.00x
 * - 10% chance: Randomly between 50.10x and 75.00x
 * - 9% chance: Randomly between 75.10x and 90.00x
 * - 7% chance: Randomly between 90.10x and 110.00x
 * - 4% chance: Randomly from 110.10x climbing out towards infinity (capped at 20,000x)
 */
export function computeCrashPoint(serverSeed, roundId, clientSeed = "rukia") {
  const combined = `${serverSeed}:${roundId}:${clientSeed}`;
  const hash = crypto.createHash("sha256").update(combined).digest("hex");

  const h = parseInt(hash.slice(0, 13), 16);
  const X = h / MAX_HEX_INT; // Uniformly distributed float between 0 and 1

  let crashMultiplierHundredths = 100;

  if (X < 0.35) {
    // 1. Bracket 1 (35% weight): 1.00x to 10.99x
    const normalized = X / 0.35;
    const minRange = 100;
    const maxRange = 1099;
    crashMultiplierHundredths = minRange + Math.floor(normalized * (maxRange - minRange + 1));
  } else if (X < 0.55) {
    // 2. Bracket 2 (20% weight): 11.00x to 35.00x
    const normalized = (X - 0.35) / 0.20;
    const minRange = 1100;
    const maxRange = 3500;
    crashMultiplierHundredths = minRange + Math.floor(normalized * (maxRange - minRange + 1));
  } else if (X < 0.70) {
    // 3. Bracket 3 (15% weight): 35.10x to 50.00x
    const normalized = (X - 0.55) / 0.15;
    const minRange = 3510;
    const maxRange = 5000;
    crashMultiplierHundredths = minRange + Math.floor(normalized * (maxRange - minRange + 1));
  } else if (X < 0.80) {
    // 4. Bracket 4 (10% weight): 50.10x to 75.00x
    const normalized = (X - 0.70) / 0.10;
    const minRange = 5010;
    const maxRange = 7500;
    crashMultiplierHundredths = minRange + Math.floor(normalized * (maxRange - minRange + 1));
  } else if (X < 0.89) {
    // 5. Bracket 5 (9% weight): 75.10x to 90.00x
    const normalized = (X - 0.80) / 0.09;
    const minRange = 7510;
    const maxRange = 9000;
    crashMultiplierHundredths = minRange + Math.floor(normalized * (maxRange - minRange + 1));
  } else if (X < 0.96) {
    // 6. Bracket 6 (7% weight): 90.10x to 110.00x
    const normalized = (X - 0.89) / 0.07;
    const minRange = 9010;
    const maxRange = 11000;
    crashMultiplierHundredths = minRange + Math.floor(normalized * (maxRange - minRange + 1));
  } else {
    // 7. Bracket 7 (4% weight): 110.10x climbing out towards infinity, capped at 20,000x
    const normalized = (X - 0.96) / 0.04;
    const minRange = 11010;
    const maxCap = 2000000; // 20,000.00x hard ceiling

    const factor = 1 / (1 - normalized * 0.999);
    crashMultiplierHundredths = Math.min(maxCap, Math.floor(minRange * factor));
  }

  // Final fallback validation clamp check
  const safe = Number.isFinite(crashMultiplierHundredths) ? crashMultiplierHundredths : 11010;
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
