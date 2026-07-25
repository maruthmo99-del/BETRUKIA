//BETRUKIA/backend/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import authRoutes from "./routes/auth.js";
import walletRoutes from "./routes/wallet.js";
import nestlinkRoutes from "./routes/nestlink.js";
import adminRoutes from "./routes/admin.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import referralsRoutes from "./routes/referrals.js";
import { attachGameSocket } from "./sockets/gameSocket.js";
import { RoundManager } from "./game/roundManager.js";
import { attachBotPlayers } from "./game/botPlayers.js";
import { initializeFirestore } from "./db/firestore.js";

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3000,http://localhost:4000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isPreviewOrigin = (origin) => {
  if (!origin) return true;
  return /(^https?:\/\/.*\.app\.github\.dev$)|(^https?:\/\/.*\.preview\.app\.github\.dev$)|(^https?:\/\/.*\.githubpreview\.dev$)|(^https?:\/\/.*\.vercel\.app$)/.test(origin);
};

const isPrivateNetworkOrigin = (origin) => {
  if (!origin) return false;
  return /(^https?:\/\/localhost(?::\d+)?$)|(^https?:\/\/127\.0\.0\.1(?::\d+)?$)|(^https?:\/\/0\.0\.0\.0(?::\d+)?$)|(^https?:\/\/10\.\d+\.\d+\.\d+(?::\d+)?$)|(^https?:\/\/192\.168\.\d+\.\d+(?::\d+)?$)|(^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(?::\d+)?$)/.test(origin);
};

const allowOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin) || isPreviewOrigin(origin) || isPrivateNetworkOrigin(origin)) {
    callback(null, true);
  } else {
    callback(null, false);
  }
};

app.use(
  cors({
    origin: allowOrigin,
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/nestlink", nestlinkRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/referrals", referralsRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/online", (_req, res) => {
  try {
    const count = typeof io.getOnlineUsersCount === "function" ? io.getOnlineUsersCount() : io.of("/").sockets.size || 0;
    const list = typeof io.getOnlineUsersList === "function" ? io.getOnlineUsersList() : [];
    res.json({ ok: true, online: Number(count), users: list });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "RUKIA Backend Running",
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowOrigin,
    credentials: true,
    methods: ["GET", "POST"],
  },
});
app.locals.io = io;

const roundManager = new RoundManager(io);
attachGameSocket(io, roundManager);

// Simulated "bot" players that keep the ALL BETS panel populated when real
// traffic is low. Purely visual — see backend/src/game/botPlayers.js for the
// guardrails (no DB writes, no wallet effects, always tagged isBot: true).
// Set BOT_PLAYERS_ENABLED=false in the environment to turn this off entirely.
if (process.env.BOT_PLAYERS_ENABLED !== "false") {
  attachBotPlayers(io, roundManager, {
    minBots: Number(process.env.BOT_PLAYERS_MIN || 150),
    maxBots: Number(process.env.BOT_PLAYERS_MAX || 200),
  });
}

roundManager.start();

initializeFirestore().catch((err) => {
  console.warn("[Server] Firestore initialization warning:", err?.message || String(err));
});

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`RUKIA backend running on http://${HOST}:${PORT}`);
});