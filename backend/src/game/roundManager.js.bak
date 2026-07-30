import { db, GAME_CONFIG } from "../db/index.js";
import { generateServerSeed, hashSeed, computeCrashPoint } from "./provablyFair.js";

const WAITING_MS = 10000; // 10-second betting window for players to place/adjust bets
const TICK_MS = 100; // multiplier update interval
const MAX_ROUND_DURATION_MS = 25000; // hard watchdog cap to force crash if a round hangs
const GROWTH = 0.00012; // controls curve steepness

const { MIN_BET_CENTS, MAX_BET_CENTS, MAX_BETS_PER_ROUND, MAX_AUTO_CASHOUT } = GAME_CONFIG;

function multiplierAtElapsed(elapsedMs) {
  const m = Math.exp(GROWTH * elapsedMs);
  return Math.max(100, Math.floor(m * 100));
}

function elapsedForMultiplier(targetHundredths) {
  const m = targetHundredths / 100;
  return Math.log(m) / GROWTH;
}

function slotKey(userId, slot) {
  return `${userId}:${slot}`;
}

export class RoundManager {
  constructor(io) {
    this.io = io;
    this.roundId = null;
    this.state = "idle";
    this.crashPoint = null;
    this.serverSeed = null;
    this.seedHash = null;
    this.clientSeed = "rukia-public-seed";
    this.flyStart = null;
    this.activeBets = new Map();
    this.tickTimer = null;
    this.countdownTimer = null;
    this.countdownStart = null;
    this._listeners = [];
  }

  onEvent(fn) {
    if (typeof fn === "function") this._listeners.push(fn);
  }

  _notify(eventName, payload) {
    for (const fn of this._listeners) {
      try {
        fn(eventName, payload);
      } catch (err) {
        console.error(`[roundManager] listener error on "${eventName}":`, err);
      }
    }
  }

  start() {
    this.newRound();
  }

  currentMultiplier() {
    if (this.state !== "flying" || this.flyStart === null) return 100;
    return multiplierAtElapsed(Date.now() - this.flyStart);
  }

  newRound() {
    try {
      this.serverSeed = generateServerSeed();
      this.seedHash = hashSeed(this.serverSeed);

      const info = db
        .prepare(
          `INSERT INTO rounds (server_seed, seed_hash, client_seed, status) VALUES (?, ?, ?, 'waiting')`
        )
        .run(this.serverSeed, this.seedHash, this.clientSeed);
      this.roundId = Number(info.lastInsertRowid);

      this.crashPoint = computeCrashPoint(this.serverSeed, this.roundId, this.clientSeed);
      this.state = "waiting";
      this.activeBets.clear();
      this.countdownStart = Date.now();

      this.io.emit("round:waiting", {
        roundId: this.roundId,
        seedHash: this.seedHash,
        waitMs: WAITING_MS,
        config: { minBetCents: MIN_BET_CENTS, maxBetCents: MAX_BET_CENTS, maxBetsPerRound: MAX_BETS_PER_ROUND },
      });
      this._notify("waiting", { roundId: this.roundId, waitMs: WAITING_MS });

      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.countdownTimer = setInterval(() => {
        try {
          const elapsed = Date.now() - this.countdownStart;
          const remaining = Math.max(0, WAITING_MS - elapsed);
          const secondsLeft = Math.ceil(remaining / 1000);
          this.io.emit("round:countdown", { roundId: this.roundId, secondsLeft });

          if (remaining <= 0) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
            this.startFlying();
          }
        } catch (err) {
          console.error("[roundManager] countdown error:", err);
        }
      }, 1000);
    } catch (err) {
      console.error("Failed to start new round:", err);
      setTimeout(() => this.newRound(), 1000);
    }
  }

  startFlying() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    this.state = "flying";
    this.flyStart = Date.now();
    db.prepare(`UPDATE rounds SET status = 'flying' WHERE id = ?`).run(this.roundId);
    const initialMultiplier = this.currentMultiplier();
    this.io.emit("round:flying", { roundId: this.roundId, startedAt: this.flyStart, multiplier: initialMultiplier });
    this._notify("flying", { roundId: this.roundId, flyStart: this.flyStart, crashPoint: this.crashPoint });

    const crashElapsed = elapsedForMultiplier(this.crashPoint);

    this.tickTimer = setInterval(() => {
      try {
        const elapsed = Date.now() - this.flyStart;
        if (elapsed >= MAX_ROUND_DURATION_MS) {
          console.log("[roundManager] watchdog triggered, forcing crash after max round duration", {
            roundId: this.roundId,
            elapsed,
            maxDuration: MAX_ROUND_DURATION_MS,
            crashPoint: this.crashPoint,
          });
          this.crash();
          return;
        }

        const current = multiplierAtElapsed(elapsed);

        if (elapsed >= crashElapsed) {
          if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
          }
          this.crash();
          return;
        }

        this.io.emit("round:tick", { roundId: this.roundId, multiplier: current });
        this.processAutoCashouts(current);
      } catch (err) {
        console.error("[roundManager] tick error, forcing crash:", err);
        if (this.tickTimer) {
          clearInterval(this.tickTimer);
          this.tickTimer = null;
        }
        this.crash();
      }
    }, TICK_MS);
  }

  processAutoCashouts(currentMultiplier) {
    if (currentMultiplier >= this.crashPoint) return;
    for (const bet of this.activeBets.values()) {
      if (bet.cashedOut) continue;
      if (bet.autoCashoutAt && currentMultiplier >= bet.autoCashoutAt) {
        const result = this.settleCashOut(bet, bet.autoCashoutAt);
        this.io.emit("bet:cashed_out", {
          userId: bet.userId,
          slot: bet.slot,
          auto: true,
          ...result,
        });
      }
    }
  }

  crash() {
    console.log("[roundManager] crash() called, crashPoint:", this.crashPoint);
    this.state = "crashed";

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    try {
      if (!Number.isFinite(this.crashPoint) || this.crashPoint < 100) {
        const cp = computeCrashPoint(this.serverSeed, this.roundId, this.clientSeed);
        this.crashPoint = Number.isFinite(cp) ? cp : 100;
      }
    } catch (e) {
      console.error("[roundManager] error computing fallback crashPoint:", e);
      this.crashPoint = this.crashPoint || 100;
    }

    for (const bet of this.activeBets.values()) {
      try {
        if (!bet.cashedOut) {
          db.prepare(`UPDATE bets SET status = 'lost', payout = 0 WHERE id = ?`).run(bet.betId);
        }
      } catch (e) {
        console.error("[roundManager] error settling bet during crash:", e, bet);
      }
    }

    try {
      db.prepare(`UPDATE rounds SET status = 'crashed', crash_point = ? WHERE id = ?`).run(this.crashPoint, this.roundId);
    } catch (e) {
      console.error("[roundManager] failed to persist crash to DB:", e, { roundId: this.roundId, crashPoint: this.crashPoint });
    }

    try {
      this.io.emit("round:crashed", {
        roundId: this.roundId,
        crashPoint: this.crashPoint,
        serverSeed: this.serverSeed,
        seedHash: this.seedHash,
        clientSeed: this.clientSeed,
      });
    } catch (e) {
      console.error("[roundManager] failed to emit round:crashed:", e, { roundId: this.roundId });
    }

    this._notify("crashed", { roundId: this.roundId, crashPoint: this.crashPoint });

    setTimeout(() => {
      try {
        this.newRound();
      } catch (err) {
        console.error("[roundManager] newRound error after crash:", err);
        setTimeout(() => this.newRound(), 1000);
      }
    }, 3000);
  }

  placeBet(userId, amountCents, slot = 1, autoCashoutAt = null) {
    if (this.state !== "waiting") throw new Error("Betting is closed for this round");
    if (!Number.isInteger(slot) || slot < 1 || slot > MAX_BETS_PER_ROUND) {
      throw new Error(`Invalid bet slot (must be 1-${MAX_BETS_PER_ROUND})`);
    }
    if (this.activeBets.has(slotKey(userId, slot))) {
      throw new Error("You already have a bet in that slot this round");
    }
    if (!Number.isInteger(amountCents) || amountCents < MIN_BET_CENTS) {
      throw new Error(`Minimum bet is KES ${(MIN_BET_CENTS / 100).toFixed(2)}`);
    }
    if (amountCents > MAX_BET_CENTS) {
      throw new Error(`Maximum bet is KES ${(MAX_BET_CENTS / 100).toFixed(2)}`);
    }
    if (autoCashoutAt !== null) {
      if (!Number.isInteger(autoCashoutAt) || autoCashoutAt < 101 || autoCashoutAt > MAX_AUTO_CASHOUT) {
        throw new Error("Auto-cashout target must be between 1.01x and " + (MAX_AUTO_CASHOUT / 100) + "x");
      }
    }

    const user = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(userId);
    if (!user || user.balance < amountCents) throw new Error("Insufficient balance");

    db.prepare(`UPDATE users SET balance = balance - ? WHERE id = ?`).run(amountCents, userId);
    const info = db
      .prepare(
        `INSERT INTO bets (round_id, user_id, slot, amount, auto_cashout_multiplier, status) VALUES (?, ?, ?, ?, ?, 'active')`
      )
      .run(this.roundId, userId, slot, amountCents, autoCashoutAt);

    const bet = {
      userId,
      slot,
      amount: amountCents,
      betId: Number(info.lastInsertRowid),
      cashedOut: false,
      autoCashoutAt,
    };
    this.activeBets.set(slotKey(userId, slot), bet);

    const updatedBalance = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(userId).balance;
    this.io.emit("wallet:update", { userId, balance: updatedBalance, kind: "bet-placed" });

    return { betId: bet.betId, roundId: this.roundId, slot, autoCashoutAt };
  }

  settleCashOut(bet, multiplier) {
    const payout = Math.floor((bet.amount * multiplier) / 100);
    bet.cashedOut = true;

    db.prepare(
      `UPDATE bets SET status = 'cashed_out', cashout_multiplier = ?, payout = ? WHERE id = ?`
    ).run(multiplier, payout, bet.betId);
    db.prepare(`UPDATE users SET balance = balance + ? WHERE id = ?`).run(payout, bet.userId);

    const balance = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(bet.userId).balance;
    this.io.emit("wallet:update", { userId: bet.userId, balance, kind: "cashout", payout });
    return { multiplier, payout, balance, slot: bet.slot };
  }

  cashOut(userId, slot = 1) {
    if (this.state !== "flying") throw new Error("Round is not active");
    const bet = this.activeBets.get(slotKey(userId, slot));
    if (!bet || bet.cashedOut) throw new Error("No active bet to cash out in that slot");

    const elapsed = Date.now() - this.flyStart;
    const multiplier = multiplierAtElapsed(elapsed);
    if (multiplier >= this.crashPoint) throw new Error("Too late — round already crashed");

    return this.settleCashOut(bet, multiplier);
  }
}