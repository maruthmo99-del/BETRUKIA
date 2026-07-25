import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { API_URL, SERVER_URL } from "../config/api.js";

const emptySlot = () => ({ bet: null, cashoutResult: null });
const GAME_STATE_KEY = "rukia-game-state";

const toMultiplierDecimal = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric / 100 : 1;
};

const loadPersistedGameState = () => {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(GAME_STATE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
};

// `getToken` is an async function returning a fresh Firebase ID token (or
// null if signed out). It's called fresh on every connect/reconnect
// attempt via socket.io's function-form `auth` option, so a token that
// expired while the tab was idle gets renewed automatically on reconnect.
export function useGameSocket(getToken, userId, demoMode = false, demoBalance = 0, setDemoBalance = () => {}, onBalanceRefresh = () => {}) {
  const socketRef = useRef(null);
  const persistedGameState = loadPersistedGameState();
  const flyStartRef = useRef(persistedGameState.flightStartTime ?? null);
  const curvePointsRef = useRef(persistedGameState.curvePoints ?? []);
  const [phase, setPhase] = useState(persistedGameState.phase || "connecting"); // waiting | flying | crashed
  const [multiplier, setMultiplier] = useState(persistedGameState.multiplier ?? 1.0);
  const [finalCrashMultiplier, setFinalCrashMultiplier] = useState(persistedGameState.finalCrashMultiplier ?? null);
  const [seedHash, setSeedHash] = useState(persistedGameState.seedHash ?? null);
  const [lastCrash, setLastCrash] = useState(persistedGameState.lastCrash ?? null); // { crashPoint, serverSeed, ... }
  const [history, setHistory] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem("rukia-round-history");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
    } catch (e) {
      return [];
    }
  });
  const [config, setConfig] = useState({ minBetCents: 1000, maxBetCents: 5000000, maxBetsPerRound: 2 });
  const [waitMs, setWaitMs] = useState(persistedGameState.waitMs ?? null);
  const [waitStart, setWaitStart] = useState(persistedGameState.waitStart ?? null);
  const [curvePoints, setCurvePoints] = useState(persistedGameState.curvePoints ?? []);
  const [flightStartTime, setFlightStartTime] = useState(persistedGameState.flightStartTime ?? null);

  useEffect(() => {
    curvePointsRef.current = curvePoints;
  }, [curvePoints]);

  useEffect(() => {
    if (flightStartTime !== null) {
      flyStartRef.current = flightStartTime;
    }
  }, [flightStartTime]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("rukia-round-history", JSON.stringify(history));
      const state = {
        phase,
        multiplier,
        finalCrashMultiplier,
        seedHash,
        lastCrash,
        waitMs,
        waitStart,
        curvePoints,
        flightStartTime,
      };
      window.localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore storage failures
    }
  }, [history, phase, multiplier, finalCrashMultiplier, seedHash, lastCrash, waitMs, waitStart, curvePoints, flightStartTime]);

  const [allBets, setAllBets] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [countdownSeconds, setCountdownSeconds] = useState(null); // countdown timer during waiting phase
  const [connected, setConnected] = useState(false);
  const [watchdogStatus, setWatchdogStatus] = useState(null);
  const lastTickRef = useRef(Date.now());
  const lastReconnectAttemptRef = useRef(0);
  const autoCashoutHandledRef = useRef(new Set());
  // slots keyed by slot number: { [slot]: { bet: {betId, amount, autoCashoutAt} | null, cashoutResult } }
  const [slots, setSlots] = useState({ 1: emptySlot(), 2: emptySlot() });
  // Fires (with a fresh id each time) whenever the current user's own bet
  // successfully cashes out — manually or via auto-cashout — so the UI can
  // show an on-screen popup. Consumers should key off `id`, not equality of
  // the whole object, since two cashouts can otherwise look identical.
  const [cashoutEvent, setCashoutEvent] = useState(null);
  const cashoutEventIdRef = useRef(0);
  const emitCashoutEvent = useCallback((payload) => {
    cashoutEventIdRef.current += 1;
    setCashoutEvent({ id: cashoutEventIdRef.current, ...payload });
  }, []);

  useEffect(() => {
    let socket;
    let cancelled = false;

    const connectSocket = async () => {
      const token = await getToken?.();
      if (cancelled) return;

      socket = io(SERVER_URL, {
        auth: token ? { token } : {},
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      const setRoundState = (state, data) => {
        setPhase(state);
        setSeedHash(data.seedHash);
        if (data.config) setConfig((c) => ({ ...c, ...data.config }));

        if (state === "waiting") {
          setMultiplier(1.0);
          setFinalCrashMultiplier(null);
          setAllBets([]);
          curvePointsRef.current = [];
          setCurvePoints([]);
          flyStartRef.current = null;
          setWaitMs(data.waitMs ?? 10000);
          setWaitStart(Date.now());
          setFlightStartTime(null);
          autoCashoutHandledRef.current.clear();
          setSlots({ 1: emptySlot(), 2: emptySlot() });
          setCountdownSeconds(Math.ceil((data.waitMs ?? 10000) / 1000));
        }

        if (state === "flying") {
          if (data?.multiplier !== undefined) {
            const current = toMultiplierDecimal(data.multiplier);
            setMultiplier(current);
            if (!flyStartRef.current) {
              const elapsedMs = Math.log(current) / 0.00012;
              const startedAt = Date.now() - elapsedMs;
              flyStartRef.current = startedAt;
              setFlightStartTime(startedAt);
            }
          }
        }

        if (state === "crashed") {
          const crashMultiplier = toMultiplierDecimal(data.crashPoint ?? data.multiplier);
          setFinalCrashMultiplier(crashMultiplier);
          setMultiplier(crashMultiplier);
          setLastCrash(data);
        }
      };

      socket.on("round:state", (data) => {
        setRoundState(data.state, data);
      });

      socket.on("round:crashed", (data) => {
        const crashMultiplier = toMultiplierDecimal(data.crashPoint);
        setPhase("crashed");
        setFinalCrashMultiplier(crashMultiplier);
        setMultiplier(crashMultiplier);
        setLastCrash(data);
        setHistory((h) => [{ crashPoint: data.crashPoint, roundId: data.roundId }, ...h].slice(0, 20));
      });

      socket.on("round:waiting", (data) => {
        setPhase("waiting");
        setSeedHash(data.seedHash);
        setMultiplier(1.0);
        setFinalCrashMultiplier(null);
        setAllBets([]);
        curvePointsRef.current = [];
        setCurvePoints([]);
        flyStartRef.current = null;
        setWaitMs(data.waitMs ?? 10000);
        setWaitStart(Date.now());
        setFlightStartTime(null);
        autoCashoutHandledRef.current.clear();
        setSlots({ 1: emptySlot(), 2: emptySlot() });
        setCountdownSeconds(Math.ceil((data.waitMs ?? 10000) / 1000));
        if (data.config) setConfig((c) => ({ ...c, ...data.config }));
      });

      socket.on("round:flying", (data) => {
        setPhase("flying");
        setCountdownSeconds(null);
        setWaitMs(null);
        setFinalCrashMultiplier(null);
        setWaitStart(null);
        setWatchdogStatus(null);
        curvePointsRef.current = [];
        setCurvePoints([]);
        const startedAt = Number.isFinite(Number(data?.startedAt)) ? Number(data.startedAt) : Date.now();
        flyStartRef.current = startedAt;
        setFlightStartTime(startedAt);
        lastTickRef.current = Date.now();
        if (data?.multiplier !== undefined) {
          setMultiplier(data.multiplier / 100);
        }
      });

      socket.on("round:tick", (data) => {
        lastTickRef.current = Date.now();
        setWatchdogStatus(null);
        const nextMultiplier = toMultiplierDecimal(data.multiplier);
        const safeMultiplier = Number.isFinite(nextMultiplier) ? Math.max(nextMultiplier, 1) : 1;
        setMultiplier(safeMultiplier);
        if (flyStartRef.current !== null) {
          const elapsedMs = Date.now() - flyStartRef.current;
          const nextPoints = curvePointsRef.current.length === 0
            ? [{ t: 0, multiplier: 1.0 }, { t: elapsedMs, multiplier: safeMultiplier }]
            : [...curvePointsRef.current, { t: elapsedMs, multiplier: safeMultiplier }];
          // Keep a fixed t=0 anchor if present in the original points so the visual curve
          // always has its true origin even when we trim older samples for performance.
          let kept = nextPoints.slice(-140);
          if (nextPoints.length > 0 && Number.isFinite(nextPoints[0].t) && nextPoints[0].t === 0) {
            if (kept.length === 0 || kept[0].t !== 0) {
              // prepend the original t=0 point if it was dropped by slice
              kept = [nextPoints[0], ...kept];
              // ensure we don't grow indefinitely; trim from the end if necessary
              if (kept.length > 140) kept = kept.slice(kept.length - 140);
            }
          }
          curvePointsRef.current = kept;
          setCurvePoints(curvePointsRef.current);
        }
      });

      socket.on("bet:new", (data) => {
        setAllBets((prev) => {
          if (data.betId) {
            if (prev.some((b) => b.betId === data.betId)) return prev;
          } else {
            if (prev.some((b) => b.userId === data.userId && b.slot === data.slot && b.amount === data.amount)) return prev;
          }

          return [
            {
              betId: data.betId,
              userId: data.userId,
              username: data.username || "Player",
              amount: data.amount,
              slot: data.slot,
              cashedOut: false,
              autoCashoutAt: data.autoCashoutAt ?? null,
              createdAt: data.createdAt || null,
              isBot: !!data.isBot,
            },
            ...prev,
          ].slice(0, 250);
        });
      });

      socket.on("bet:cancelled", (data) => {
        // Remove the cancelled bet from the live "all bets" feed
        setAllBets((prev) =>
          prev.filter((bet) => {
            if (data.betId != null && bet.betId != null) return bet.betId !== data.betId;
            return !(String(bet.userId) === String(data.userId) && bet.slot === data.slot);
          })
        );

        // Only clear local slot state and refresh balance when this affects the current user
        if (userId && String(data.userId) === String(userId)) {
          onBalanceRefresh?.();
          setSlots((s) => ({ ...s, [data.slot]: { bet: null, cashoutResult: null } }));
        }
      });

      socket.on("bet:cashed_out", (data) => {
        // Normalize ID types when matching bets so strings/numbers don't block updates
        setAllBets((prev) =>
          prev.map((bet) => {
            if (bet.cashedOut) return bet;
            if (String(bet.userId) !== String(data.userId) || bet.slot !== data.slot) return bet;
            return {
              ...bet,
              cashedOut: true,
              cashoutMultiplier: data.multiplier,
              payout: data.payout,
            };
          })
        );

        // Only update local slot state and refresh balance when the event affects the current user
        if (userId && String(data.userId) === String(userId)) {
          onBalanceRefresh?.();
          setSlots((s) => ({
            ...s,
            [data.slot]: { bet: null, cashoutResult: data },
          }));
          emitCashoutEvent({
            slot: data.slot,
            multiplier: data.multiplier,
            payout: data.payout,
            auto: !!data.auto,
          });
        }
      });

      socket.on("round:crashed", (data) => {
        const crashMultiplier = toMultiplierDecimal(data.crashPoint);
        setPhase("crashed");
        setFinalCrashMultiplier(crashMultiplier);
        setMultiplier(crashMultiplier);
        setLastCrash(data);
        setHistory((h) => {
          const next = [{ crashPoint: data.crashPoint, roundId: data.roundId }, ...h]
            .filter((item, index, self) => self.findIndex((r) => r.roundId === item.roundId) === index)
            .slice(0, 20);
          window.localStorage.setItem("rukia-round-history", JSON.stringify(next));
          return next;
        });

        if (demoMode) {
          setSlots((prev) => {
            const next = { ...prev };
            for (const slotId of Object.keys(next)) {
              const slotState = next[slotId];
              if (slotState.bet && !slotState.cashoutResult) {
                next[slotId] = { bet: null, cashoutResult: { lost: true, amount: slotState.bet.amount } };
              }
            }
            return next;
          });
        }
      });

      socket.on("round:countdown", (data) => {
        setCountdownSeconds(data.secondsLeft);
      });

      socket.on("wallet:update", (data) => {
        if (demoMode) return;
        if (data?.userId && userId && String(data.userId) === String(userId)) {
          onBalanceRefresh?.();
        }
      });

      socket.on("connect", async () => {
        setConnected(true);
        try {
          const res = await fetch(`${API_URL}/api/wallet/rounds/recent`);
          if (res.ok) {
            const json = await res.json();
            const recent = Array.isArray(json.rounds) ? json.rounds : [];
            if (recent.length > 0) {
              setHistory((h) => [
                ...recent.map((round) => ({ crashPoint: round.crash_point, roundId: round.id })),
                ...h,
              ]
                .filter((item, index, self) => self.findIndex((r) => r.roundId === item.roundId) === index)
                .slice(0, 20)
              );
            }
          }
        } catch (err) {
          // ignore fetch failures
        }
      });
      socket.on("disconnect", () => setConnected(false));
      socket.on("connect_error", (err) => {
        // console.warn("[useGameSocket] connect_error", err);
        setConnected(false);
      });

      socket.on("chat:message", (msg) => {
        setChatMessages((m) => [msg, ...m].slice(0, 200));
      });

      socket.on("chat:users", (list) => {
        setOnlineUsers(list || []);
      });
    };

    connectSocket();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [getToken, userId, demoMode]);

  const sendChat = useCallback((text, replyTo = null) => {
    if (!socketRef.current) return;
    try {
      socketRef.current.emit("chat:send", { text, replyTo });
    } catch (err) {
      // ignore
    }
  }, []);

  const placeBet = useCallback(
    (amountCents, slot = 1, autoCashoutAt = null) => {
      if (demoMode) {
        const slotState = slots[slot];
        if (slotState?.bet) {
          return Promise.resolve({ error: "You already have a bet in that slot." });
        }
        if (amountCents > demoBalance) {
          return Promise.resolve({ error: "Insufficient demo balance." });
        }

        const betId = `demo-${Date.now()}`;
        setDemoBalance((prev) => prev - amountCents);
        setSlots((s) => ({
          ...s,
          [slot]: { bet: { betId, amount: amountCents, autoCashoutAt }, cashoutResult: null },
        }));
        setAllBets((prev) => [
          {
            userId: "demo",
            username: "Player",
            amount: amountCents,
            slot,
            cashedOut: false,
            autoCashoutAt,
          },
          ...prev,
        ].slice(0, 50));
        return Promise.resolve({ ok: true, betId, slot, amount: amountCents });
      }

      if (!connected) {
        return Promise.resolve({ error: "Not connected to the game server. Please refresh or try again." });
      }

      return new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket || socket.disconnected) {
          return resolve({ error: "Not connected to the game server. Please refresh or try again." });
        }

        socket.emit("bet:place", { amountCents, slot, autoCashoutAt }, (res) => {
          if (res?.ok) {
            onBalanceRefresh?.();
            // Optimistic update for local slot state
            setSlots((s) => ({
              ...s,
              [slot]: { bet: { betId: res.betId, amount: amountCents, autoCashoutAt }, cashoutResult: null },
            }));
            // Optimistic update for allBets display (show immediately, don't wait for server broadcast)
            setAllBets((prev) => [
              {
                userId,
                username: res.username || "You",
                amount: amountCents,
                slot,
                cashedOut: false,
                autoCashoutAt,
              },
              ...prev,
            ].slice(0, 50));
          }
          resolve(res);
        });
      });
    },
    [connected, demoMode, demoBalance, slots, userId, onBalanceRefresh]
  );

  const cancelBet = useCallback(
    (slot = 1) => {
      if (demoMode) {
        const slotState = slots[slot];
        if (!slotState?.bet) {
          return Promise.resolve({ error: "No active bet to cancel in that slot." });
        }
        const refund = slotState.bet.amount;
        setDemoBalance((prev) => prev + refund);
        setSlots((s) => ({ ...s, [slot]: { bet: null, cashoutResult: null } }));
        setAllBets((prev) => prev.filter((b) => !(b.userId === "demo" && b.slot === slot && !b.cashedOut)));
        return Promise.resolve({ ok: true, slot, amount: refund });
      }

      if (!connected) {
        return Promise.resolve({ error: "Not connected to the game server. Please refresh or try again." });
      }

      return new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket || socket.disconnected) {
          return resolve({ error: "Not connected to the game server. Please refresh or try again." });
        }

        socket.emit("bet:cancel", { slot }, (res) => {
          if (res?.ok) {
            onBalanceRefresh?.();
            setSlots((s) => ({ ...s, [slot]: { bet: null, cashoutResult: null } }));
            setAllBets((prev) => prev.filter((b) => !(String(b.userId) === String(userId) && b.slot === slot && !b.cashedOut)));
          }
          resolve(res);
        });
      });
    },
    [connected, demoMode, slots, userId, onBalanceRefresh]
  );

  const cashOut = useCallback(
    (slot = 1) => {
      if (demoMode) {
        const slotState = slots[slot];
        if (!slotState?.bet) {
          return Promise.resolve({ error: "No active bet to cash out in that slot." });
        }
        if (phase !== "flying") {
          return Promise.resolve({ error: "Round is not active." });
        }
        const multiplierHundredths = Math.round(multiplier * 100);
        const payout = Math.floor((slotState.bet.amount * multiplierHundredths) / 100);
        setDemoBalance((prev) => prev + payout);
        setSlots((s) => ({
          ...s,
          [slot]: {
            bet: null,
            cashoutResult: { multiplier: multiplierHundredths, payout, auto: false },
          },
        }));
        setAllBets((prev) =>
          prev.map((bet) => {
            if (bet.userId !== "demo" || bet.slot !== slot || bet.cashedOut) return bet;
            return { ...bet, cashedOut: true, cashoutMultiplier: Math.round(multiplier * 100), payout };
          })
        );
        emitCashoutEvent({ slot, multiplier: multiplierHundredths, payout, auto: false });
        return Promise.resolve({ ok: true, multiplier: Math.round(multiplier * 100), payout, slot });
      }

      return new Promise((resolve) => {
        socketRef.current.emit("bet:cashout", { slot }, (res) => {
          if (res?.ok) {
            onBalanceRefresh?.();
            setSlots((s) => ({ ...s, [slot]: { bet: null, cashoutResult: res } }));
            emitCashoutEvent({ slot, multiplier: res.multiplier, payout: res.payout, auto: false });
          }
          resolve(res);
        });
      });
    },
    [demoMode, slots, phase, multiplier, emitCashoutEvent]
  );

  useEffect(() => {
    if (phase !== "flying") return;

    const triggered = [];
    const handled = autoCashoutHandledRef.current;
    const ownerId = demoMode ? "demo" : userId;

    setSlots((prev) => {
      const next = { ...prev };
      Object.entries(prev).forEach(([slotKey, slotState]) => {
        const bet = slotState?.bet;
        if (!bet || slotState.cashoutResult || !bet.autoCashoutAt) return;

        const key = bet.betId ? `bet:${bet.betId}` : `slot:${slotKey}`;
        if (handled.has(key)) return;

        const multiplierHundredths = Math.round(multiplier * 100);
        if (multiplierHundredths < bet.autoCashoutAt) return;

        handled.add(key);
        const payout = Math.floor((bet.amount * multiplierHundredths) / 100);
        triggered.push({ slot: Number(slotKey), payout, multiplier: multiplierHundredths });
        next[slotKey] = {
          bet: null,
          cashoutResult: { multiplier: multiplierHundredths, payout, auto: true },
        };
      });

      if (triggered.length > 0) {
        if (demoMode) {
          setDemoBalance((prevBalance) => prevBalance + triggered.reduce((sum, item) => sum + item.payout, 0));
        } else {
          onBalanceRefresh?.();
        }

        setAllBets((prevBets) =>
          prevBets.map((bet) => {
            const match = triggered.find((item) => item.slot === bet.slot && bet.userId === ownerId);
            if (!match || bet.cashedOut) return bet;
            return { ...bet, cashedOut: true, cashoutMultiplier: match.multiplier, payout: match.payout };
          })
        );
      }

      return next;
    });
  }, [demoMode, phase, multiplier, setDemoBalance, userId, onBalanceRefresh]);

  useEffect(() => {
    const watchdog = setInterval(() => {
      if (phase !== "flying") {
        setWatchdogStatus(null);
        return;
      }

      const ageMs = Date.now() - lastTickRef.current;
      if (ageMs >= 6000) {
        setWatchdogStatus("No tick from server in 6s. Reconnecting...");
        if (socketRef.current && Date.now() - lastReconnectAttemptRef.current > 10000) {
          lastReconnectAttemptRef.current = Date.now();
          // console.warn("[useGameSocket] watchdog reconnect attempt due to stale ticks", { ageMs });
          socketRef.current.disconnect();
          socketRef.current.connect();
        }
      } else {
        setWatchdogStatus(null);
      }
    }, 1000);

    return () => clearInterval(watchdog);
  }, [phase]);

  return {
    phase,
    multiplier,
    curvePoints,
    flightStartTime,
    seedHash,
    lastCrash,
    finalCrashMultiplier,
    history,
    config,
    slots,
    cashoutEvent,
    allBets,
    chatMessages,
    onlineUsers,
    connected,
    sendChat,
    countdownSeconds,
    watchdogStatus,
    placeBet,
    cashOut,
    cancelBet,
    waitMs,
    waitStart,
    // alias for older/newer callers that use the name waitStartedAt
    waitStartedAt: waitStart,
  };
}