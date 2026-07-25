# RUKIA — Crash Game Platform (MVP)

An Aviator-style crash game: a multiplier climbs from 1.00x and can crash at
any moment. Players bet before it takes off and cash out before it crashes.
Cash out too late and you lose the bet.

## Stack
- **Backend**: Node.js, Express, Socket.io, `node:sqlite` (Node's built-in
  SQLite — requires Node 22.5+, no native compilation needed).
- **Frontend**: React + Vite, socket.io-client, Firebase JS SDK (Auth only).
- **Auth**: Firebase Authentication (email/password) on the client; the
  backend verifies Firebase ID tokens itself — no `firebase-admin` /
  service-account key required (see "Auth architecture" below).
- **Fairness**: hash-committed, seed-revealed provably fair crash points.

## Auth architecture (Firebase Auth, no service account)
Firebase handles identity (sign-up/sign-in, password reset, etc). The
backend never sees a password — it only ever sees a short-lived **ID
token** the client SDK produces via `user.getIdToken()`.

- The backend verifies that ID token itself, in
  `backend/src/auth/firebaseVerify.js`, by checking its RS256 signature
  against Google's public certs (fetched from
  `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`
  and cached per their `Cache-Control` header), plus the standard
  `iss`/`aud`/`exp` checks Firebase's own docs describe for
  ["verify ID tokens using a third-party JWT library"](https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library).
  This needs **no service-account credentials** — only your project ID
  (`FIREBASE_PROJECT_ID` in `.env`, already defaulted to `omoka-73f48`).
- `backend/src/auth/userSync.js` maps a verified Firebase `uid` to a local
  `users` row (wallet balance, admin flag, bet history foreign keys all
  stay as plain integers). The row is created automatically on first
  sign-in; the very first user ever created becomes admin.
- `POST /api/auth/session` is called once by the frontend right after
  Firebase sign-in/sign-up to sync/create that row and fetch the current
  balance + admin flag.
- Every other authenticated REST route and the Socket.io connection both
  independently re-verify the ID token — there's no separate app-issued
  session token anymore.
- **Token expiry**: Firebase ID tokens expire hourly. REST calls always
  fetch a fresh one via `getIdToken()` (which transparently renews an
  expired cached token). The Socket.io connection fetches a fresh token
  on every connect/reconnect attempt too — but a long-lived *open* socket
  won't proactively refresh mid-session, so a tab left open for hours
  without a network hiccup could theoretically hold a stale-but-still-
  literally-connected socket. Not an issue in practice (reconnects happen
  often enough), but worth knowing if you're auditing this for production.
- I verified the token-verification logic against a locally self-signed
  mock token (see the testing notes below) since this sandbox can't reach
  `googleapis.com` — you should do one real sign-up/login test in your own
  environment before trusting it further.

## Running it

### Backend
```bash
cd backend
npm install
cp .env.example .env   # FIREBASE_PROJECT_ID defaults to omoka-73f48 already
npm run dev
```
Runs on `http://localhost:4000`. A SQLite file (`src/db/omoka.sqlite`) is
created automatically on first run. New accounts start with a virtual
balance of KES 1,000.00 (stored as cents in `100000`).

**Before this works for real**, go to the Firebase Console →
Authentication → Sign-in method, and enable **Email/Password** as a
provider for the `omoka-73f48` project (it's off by default).

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`. If your backend isn't on localhost:4000,
set `VITE_SERVER_URL` in a `.env` file in `frontend/`. Firebase's web
config is already hardcoded in `frontend/src/firebase.js` (it's meant to
be public — client-side Firebase config isn't a secret; access control
happens via Firebase Auth + your backend's own verification, not by
hiding this object).
Each round cycles through three phases, broadcast to every connected client:

1. **waiting** (6s) — betting window is open. The server publishes
   `sha256(serverSeed)` *before* anyone bets, so the seed is locked in and
   can't be changed after the fact.
2. **flying** — the multiplier climbs (`e^(k·t)`) and ticks to clients every
   100ms. Players can cash out any time before the crash point.
3. **crashed** — the round stops at the pre-committed crash point. The raw
   `serverSeed` is revealed so anyone can hash it themselves and confirm it
   matches the hash published in step 1, then recompute the crash point and
   confirm it matches what was shown. See `GET /api/wallet/rounds/:id/verify`.

The crash point itself comes from `sha256(serverSeed:roundId:clientSeed)`,
using the classic crash-game formula: `P(crash ≥ m) = houseEdge / m`, with a
1% chance of an instant 1.00x crash (this is where the house edge lives).

## What's implemented
- Firebase Authentication (email/password) for sign-up/login; backend
  verifies ID tokens itself (see "Auth architecture" above)
- Real-time round broadcast over Socket.io (waiting → flying → crashed)
- Bet placement + cash-out via socket events, validated server-side
  (balance checks, no double-betting per slot, no cashing out after crash)
- **Bet limits** — min/max stake enforced server-side (`GAME_CONFIG` in
  `db/index.js`), exposed via `GET /api/wallet/config` so the frontend
  always reflects the same numbers the server enforces.
- **Auto-cashout** — when placing a bet, players may set a target
  multiplier. The server checks every active bet against its target on
  every 100ms tick and cashes it out automatically the instant it's
  reached, before the round can crash past it. Fires identically to a
  manual cashout (same payout math), just triggered server-side.
- **Multiple concurrent bets** — each player gets two independent bet
  slots per round (`GAME_CONFIG.MAX_BETS_PER_ROUND`), each with its own
  stake and its own optional auto-cashout target. Slots are tracked as
  `userId:slot` internally and as a `slot` column in the `bets` table.
- Wallet balance + bet history REST endpoints (history includes slot and
  auto-cashout target per bet)
- Provably fair round verification endpoint
- **Leaderboard** — `GET /api/leaderboard?window=24h|all` ranks players by
  net profit (payouts minus wagers) over a rolling 24h window or all-time.
  Shown in-app as a bar chart + table.
- **Personal stats** — each player can see their own net profit, win rate,
  a cumulative profit-over-time line chart, and a recent-bets table
  (`My Stats` tab, reads `GET /api/wallet/history`).
- **Admin dashboard** — gated behind `is_admin` (the *first account ever
  created* is auto-promoted to admin — convenient for a demo, but a
  real deployment should manage this explicitly instead). Shows headline
  numbers (users, rounds played, total wagered/paid out, house profit),
  a recent-rounds table, and a full user list with each player's wagered/
  won totals. Endpoints: `GET /api/admin/stats`, `/rounds`, `/users`,
  all behind `requireAdmin` middleware that re-verifies the Firebase token
  and re-checks the DB (not a cached claim) on every request.
- React frontend: live multiplier, two-slot bet panel with auto-cashout
  inputs, round history strip, auth, tabbed nav (Play / Leaderboard /
  My Stats / Admin)

## What's intentionally NOT implemented yet (next steps)
This is a functional MVP/skeleton, not a production gambling platform. Before
handling real money you'd need at minimum:
- **Legal/regulatory**: real-money gambling requires a license in virtually
  every jurisdiction. This build only supports a virtual/play-money balance.
- Real payment integration (M-Pesa, cards, etc.) with proper reconciliation
- Rate limiting, anti-fraud, multi-device session handling
- Horizontal scaling of the round loop (currently a single in-memory
  `RoundManager` per server instance — fine for one server, not for a
  multi-node deployment without a shared source of truth, e.g. Redis)
- KYC, responsible-gambling tools (deposit limits, self-exclusion, etc.)
- Automated tests, migrations, structured logging, monitoring

## Project structure
```
omoka/
  backend/
    src/
      server.js           # Express + Socket.io entrypoint
      auth/
        firebaseVerify.js # verifies Firebase ID tokens (no admin SDK needed)
        userSync.js        # maps Firebase uid -> local users row
      game/
        provablyFair.js   # seed/hash/crash-point math
        roundManager.js   # round state machine, bet slots, auto-cashout
      routes/
        auth.js           # POST /session — syncs Firebase identity to local user
        wallet.js          # balance, history, fairness verification, config
        admin.js            # stats/rounds/users, requireAdmin-gated
        leaderboard.js       # net-profit rankings
        middleware.js      # Firebase token verification + admin check
      sockets/
        gameSocket.js      # bet:place / bet:cashout handlers
      db/index.js          # SQLite schema + GAME_CONFIG
  frontend/
    src/
      firebase.js           # Firebase app + Auth client init
      App.jsx              # tab nav: Play / Leaderboard / My Stats / Admin
      hooks/
        useAuth.js           # wraps Firebase Auth + backend session sync
        useGameSocket.js
      components/
        AuthForm.jsx         # email/password sign-up/login via Firebase
        MultiplierDisplay.jsx
        BetPanel.jsx         # two bet slots + auto-cashout inputs
        History.jsx
        Leaderboard.jsx      # recharts bar chart + table
        MyStatsChart.jsx     # recharts line chart + table
        AdminDashboard.jsx
```

## Notes on the admin/leaderboard/stats features
- The admin flag is re-checked against the DB on every request via
  `requireAdmin` — it's never trusted from a cached claim.
- Leaderboard "net profit" = sum of payouts on cashed-out bets minus the
  stake on every settled bet (cashed-out or lost), grouped by player.
  The 24h window uses SQLite's `datetime('now', '-1 day')`.
- The personal stats chart reconstructs a cumulative P/L line client-side
  from the same `/api/wallet/history` data the bet-history table already
  used — no new backend endpoint was needed for that one.

## Testing notes (what I could and couldn't verify from this sandbox)
This sandbox's network is locked down to package registries and a few
dev domains — it can't reach `googleapis.com`, so I couldn't do a live
sign-up/login test against real Firebase servers. What I did verify:
- **Token verification logic**: generated a local RSA keypair standing in
  for Google's real signing key, signed mock tokens with it, and confirmed
  `verifyFirebaseIdToken` correctly accepts valid tokens and rejects wrong
  audience, wrong issuer, expired tokens, forged signatures (signed by a
  *different* key than the one the `kid` claims), missing `kid`, and
  unknown `kid` — 9/9 checks passed.
- **Full request flow**: ran the actual Express routes with a mocked cert
  endpoint and confirmed: first sign-in becomes admin, second sign-in
  doesn't, repeat sign-ins for the same Firebase uid return the same local
  user (no duplicate rows), missing token → 401, and the wallet balance
  endpoint reads correctly off the synced user.
- **Not yet verified**: an actual round-trip against real Firebase Auth
  servers, and the full browser flow (sign-up form → Firebase → session
  sync → socket connection → placing a bet). Do at least one real sign-up
  and one real login in your own environment before trusting this further,
  and make sure Email/Password sign-in is enabled in the Firebase Console
  (it's off by default on a new project).
#   R U K I A - A P P  
 