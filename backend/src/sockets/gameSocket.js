import { verifySocketAuth } from "../routes/middleware.js";
import { db, GAME_CONFIG } from "../db/index.js";

const maskToken = (t) => {
  if (!t) return "";
  if (t === "demo") return "demo";
  try {
    return t.length > 10 ? `${t.slice(0, 6)}...${t.slice(-4)}` : t;
  } catch {
    return "<tok>";
  }
};

export function attachGameSocket(io, roundManager) {
  // track online users per socket.id -> { userId, display_name }
  const onlineUsers = new Map();
  // expose a helper on the io instance so external routes can report online counts
  try {
    io.getOnlineUsersCount = () => onlineUsers.size;
    io.getOnlineUsersList = () => Array.from(onlineUsers.values());
  } catch (e) {
    // ignore if io is readonly for some reason
  }
  // Enhanced handshake/auth middleware with logging for diagnostics
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const origin = socket.handshake.headers?.origin || "<no-origin>";
    const addr = socket.handshake.address || "<no-addr>";
    console.log(`[socket] handshake from ${addr} origin=${origin} tokenProvided=${!!token}`);

    if (!token) return next(); // allow anonymous viewers (read-only)

    try {
      const identity = await verifySocketAuth(token);
      if (!identity) {
        console.warn(`[socket] auth failed token=${maskToken(token)} peer=${addr} origin=${origin}`);
        // Reject the handshake with a connection error so clients receive `connect_error`
        return next(new Error("auth_failed"));
      }
      socket.userId = identity.userId;
      socket.isAdmin = identity.isAdmin;
      return next();
    } catch (err) {
      console.error(`[socket] verifySocketAuth error token=${maskToken(token)} peer=${addr}`, err?.message || err);
      return next(err || new Error("auth_error"));
    }
  });

  // Log connection-level handshake errors
  io.on("connection_error", (err) => {
    console.warn("[socket] connection_error:", err && err.message ? err.message : err);
  });

  io.on("connection", (socket) => {
    // register online user (if authenticated)
    const addr = socket.handshake.address || "<no-addr>";
    const origin = socket.handshake.headers?.origin || "<no-origin>";
    console.log(`[socket] connected id=${socket.id} peer=${addr} origin=${origin} user=${socket.userId ?? 'anon'}`);
    if (socket.userId) {
      try {
        const u = db.prepare(`SELECT id, display_name FROM users WHERE id = ?`).get(socket.userId);
        onlineUsers.set(socket.id, { userId: socket.userId, username: u?.display_name || `player${u?.id}` });
      } catch (err) {
        // ignore
      }
    }

    // broadcast current online users list
    io.emit("chat:users", Array.from(onlineUsers.values()));

    // send recent chat history to the connecting socket
    try {
      const recent = db.prepare(`SELECT id, user_id, username, text, reply_to, from_admin, created_at FROM chat ORDER BY id DESC LIMIT 200`).all();
      socket.emit("chat:history", recent.reverse());
    } catch (e) {
      // ignore
    }

    // Chat message handler
    // Users may send messages; only admins may send replies (include `replyTo`)
    socket.on("chat:send", (payload) => {
      try {
        const text = String(payload?.text || "").slice(0, 1000);
        const replyTo = payload?.replyTo ?? null;
        const sender = onlineUsers.get(socket.id) || { userId: socket.userId || null, username: socket.user?.display_name || "Guest" };

        // If this is a reply (replyTo provided), only allow admins to send replies
        if (replyTo && !socket.isAdmin) {
          // send error ack back to sender if callback provided (no ack here), and ignore
          return;
        }

        const createdAt = new Date().toISOString();
        // persist to database
        try {
          const info = db.prepare(`INSERT INTO chat (user_id, username, text, reply_to, from_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(sender.userId || null, sender.username || "Guest", text, replyTo, socket.isAdmin ? 1 : 0, createdAt);
          const row = db.prepare(`SELECT id, user_id, username, text, reply_to, from_admin, created_at FROM chat WHERE id = ?`).get(info.lastInsertRowid);
          io.emit("chat:message", row);
        } catch (e) {
          // fallback to in-memory emit if DB write fails
          const msg = { id: Date.now(), userId: sender.userId, username: sender.username, text, replyTo, createdAt, fromAdmin: !!socket.isAdmin };
          io.emit("chat:message", msg);
        }
      } catch (err) {
        // ignore
      }
    });

    const roundState = {
      roundId: roundManager.roundId,
      state: roundManager.state,
      seedHash: roundManager.seedHash,
      config: {
        minBetCents: GAME_CONFIG.MIN_BET_CENTS,
        maxBetCents: GAME_CONFIG.MAX_BET_CENTS,
        maxBetsPerRound: GAME_CONFIG.MAX_BETS_PER_ROUND,
      },
    };
    roundState.multiplier = roundManager.currentMultiplier();

    socket.emit("round:state", roundState);

    // payload: { amountCents, slot (1..maxBetsPerRound, default 1), autoCashoutAt (hundredths, optional) }
    socket.on("bet:place", (payload, ack) => {
      if (!socket.userId) return ack?.({ error: "Login required" });
      try {
        const slot = payload.slot ?? 1;
        const autoCashoutAt = payload.autoCashoutAt ?? null;
        const result = roundManager.placeBet(socket.userId, payload.amountCents, slot, autoCashoutAt);
        const balance = db.prepare(`SELECT balance FROM users WHERE id = ?`).get(socket.userId).balance;
        const user = db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(socket.userId);
        ack?.({ ok: true, ...result, balance });
        io.emit("bet:new", {
          betId: result.betId,
          userId: socket.userId,
          username: user?.display_name ?? "Player",
          amount: payload.amountCents,
          slot,
          autoCashoutAt: result.autoCashoutAt ?? null,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    // payload: { slot (default 1) }
    socket.on("bet:cashout", (payload, ack) => {
      if (!socket.userId) return ack?.({ error: "Login required" });
      try {
        const slot = payload?.slot ?? 1;
        const result = roundManager.cashOut(socket.userId, slot);
        const user = db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(socket.userId);
        ack?.({ ok: true, ...result });
        io.emit("bet:cashed_out", { userId: socket.userId, username: user?.display_name ?? "Player", auto: false, ...result });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    // payload: { slot (default 1) } — cancel a bet placed for the current round,
    // only allowed while the round is still in its "waiting" (betting) phase.
    socket.on("bet:cancel", (payload, ack) => {
      if (!socket.userId) return ack?.({ error: "Login required" });
      try {
        const slot = payload?.slot ?? 1;
        const result = roundManager.cancelBet(socket.userId, slot);
        const user = db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(socket.userId);
        ack?.({ ok: true, ...result });
        io.emit("bet:cancelled", { userId: socket.userId, username: user?.display_name ?? "Player", slot, betId: result.betId });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnect id=${socket.id} reason=${reason}`);
      if (onlineUsers.has(socket.id)) {
        onlineUsers.delete(socket.id);
        io.emit("chat:users", Array.from(onlineUsers.values()));
      }
    });
  });
}