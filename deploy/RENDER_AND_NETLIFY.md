# Deploying backend (Render) + frontend (Vercel)

This document describes a simple, reliable deployment flow for the RUKIA app:

1) Deploy the backend to Render (recommended)
2) Deploy the frontend to Vercel (or another static host)
3) Set environment variables so the frontend connects to the backend via WebSockets

---

Backend (Render) - quick steps

- Connect your GitHub repo to Render and create a new **Web Service**.
- Repository root: the project root. Set the "Build Command" to `npm ci` and the "Start Command" to `npm start` with the "Working Directory" set to `backend`.
- Alternatively, choose the Docker option and Render will use the `backend/Dockerfile` we added.
- Set the following environment variables in the Render service settings (Environment > Environment Variables):
  - `PORT` = 4000 (Render provides a port but this is safe)
  - `ALLOWED_ORIGINS` = `https://<your-frontend-host>` (example: `https://rukiafinal.vercel.app`)
  - `CORS_ORIGIN` (optional) = same as above
  - `FIREBASE_PROJECT_ID` = your Firebase project id (if different from the default in `.env.example`)
  - Any other secrets from `.env.example` you need (NESTLINK keys, etc.)

Notes:
- Render will give you a public HTTPS hostname like `my-backend.onrender.com` — use that for the frontend.
- WebSockets are supported on Render (long-lived connections) so Socket.io will work.

Frontend (Vercel) - quick steps

- In Vercel project settings > Environment Variables, add:
  - `VITE_API_URL` = `https://<your-backend-host>` (example: `https://my-backend.onrender.com`)
  - `VITE_SERVER_URL` = same as `VITE_API_URL` (optional)

- Trigger a redeploy of the frontend after setting these env vars.

Why this matters

-- The frontend picks its `SERVER_URL` from `VITE_API_URL` / `VITE_SERVER_URL` if present. If not present it will attempt to connect back to the origin that served the frontend, but many static hosts do not host Socket.io, so you must point it at your backend.
- The backend `ALLOWED_ORIGINS` must include your frontend origin so CORS checks pass for REST and Socket.io handshake.

Local testing

1. In `frontend/.env` add:

```
VITE_API_URL=http://localhost:4000
```

2. Start backend locally:
```
cd backend
npm ci
npm run dev
```

3. Start frontend locally:
```
cd frontend
npm ci
npm run dev
```

4. Open the frontend and verify the topbar changes from "Connecting" to "Live".

Troubleshooting

- If the frontend shows "Connecting" on the deployed site:
  - Verify the frontend env `VITE_API_URL` is set and points to the backend HTTPS URL.
  - Check backend logs on Render for handshake errors or CORS rejections.
  - Ensure `ALLOWED_ORIGINS` contains the exact origin (protocol + hostname) used by the frontend.
  - Inspect the browser console for `connect_error` logs — we added extra logging in `useGameSocket`.

Advanced options

- Use a custom domain and TLS for both frontend and backend. If both share the same origin, CORS isn't needed and path-based routing is simpler.
- If you want to scale to multiple backend instances, you'll need a shared store (Redis) for the round loop / presence and a message bus so instances coordinate.
