# Voice over AI Agent (Demo)

A free-tier demo that converts text to AI voice with ElevenLabs and simulates a call flow entirely in-browser.

## Tech
- Frontend: React + Vite + Tailwind (deploy on Vercel)
- Backend: Node.js + Express (deploy on Render)
- TTS: ElevenLabs API

## Quick start (Local)

1. Backend
   - Copy `backend/.env.example` to `backend/.env` and set `ELEVENLABS_API_KEY`.
   - Install deps and run:

   ```powershell
   cd "backend"
   npm install
   npm run dev
   ```

   - Backend runs on http://localhost:3001

2. Frontend
  - Copy `frontend/.env.example` to `frontend/.env` and set `VITE_BACKEND_URL=http://localhost:3001`.
   - Install deps and run:

   ```powershell
   cd "frontend"
   npm install
   npm run dev
   ```

   - Open the shown local URL (usually http://localhost:5173)

## API
- GET `/voices` → `[{ id, name }]`
- POST `/generate-voice` `{ text, voiceId }` → `{ audioUrl }`
- POST `/simulate-call` `{ audioUrl, toNumber }` → `{ status, duration }`
 - GET `/simulate-call-sse?audioUrl=...&toNumber=...` → SSE stream with events: `initiated`, `ringing`, `connected`, `playing`, `ended`

## Deployment
- Backend on Render (Free):
  - Create a new Web Service from your GitHub repo, root set to `backend`.
  - Build Command: `npm install`
  - Start Command: `npm start`
  - Env Vars: `ELEVENLABS_API_KEY`, optional `PORT`, `ELEVENLABS_BASE_URL`, `ELEVENLABS_MODEL_ID` (defaults to `eleven_multilingual_v2`).
  - Optional fallback: set `ENABLE_DEMO_TTS_FALLBACK=true` to auto-generate a short offline WAV tone if ElevenLabs rejects requests (401/403/429 or "Unusual activity"). Useful for demos when Free Tier is restricted.
- Frontend on Vercel:
  - Import repo, set Framework to Vite.
  - Add env `VITE_BACKEND_URL` pointing to your Render URL.

## Limitations
- No real telephony—call is simulated; audio plays in-browser.
- Free tiers (rate limits, character limits) apply.
 - SSE uses a single HTTP connection; some corporate networks or certain browsers may interfere.
 - If ElevenLabs TTS is unavailable (e.g., free tier disabled), enabling `ENABLE_DEMO_TTS_FALLBACK` will generate a short tone instead of real speech so the flow still works for demos.

## Screenshots / Demo
- Add screenshots of Home and Call Simulation screens.
- Optional Loom video link.
