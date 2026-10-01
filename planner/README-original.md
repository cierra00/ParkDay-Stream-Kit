# CTPG Park Day (planner.cruiseandthemeparkguide.com)

Phone app (React PWA) + Cloudflare Worker + R2 + Durable Object.

- `src/`: the React app. `/` is Cierra's app; `/mod` (later) is the mod view.
- `worker/index.js`: API (`/api/state`, `/api/mods`, `/api/cmd`, `/api/ws`) and the live hub.
- `wrangler.jsonc`: Worker config (R2 bucket `ctpg-planner`, custom domain).
- Secrets (never in files): `OWNER_PASS` (Cierra's passcode), `OVERLAY_KEY` (OBS overlay read key), `BOT_KEY` (Streamer.bot).

Deploy: `npm install`, then `npm run deploy`.
Park data comes straight from ThemeParks.wiki in the browser, not through the Worker.
