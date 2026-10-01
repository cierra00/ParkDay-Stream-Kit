# Park Day Stream Kit

A phone app plus OBS overlays that put a live **NOW / NEXT** card on an IRL theme park livestream, with a show countdown, moderator accounts, an owner dashboard, and a **Switch to LIVE scene** button that reaches the streaming PC at home.

Built for the **Cruise & Theme Park Guide** YouTube channel (Walt Disney World, Disneyland, Universal and cruise livestreams). Everything here is the real, working code, with private keys replaced by placeholders.

> **Two versions of the docs**
> - **You are reading the human version.** Plain language, step by step.
> - **AI agents:** start with [`AI_README.md`](AI_README.md). It is a precise spec (data model, rules, API contract, invariants, commands) written so an AI coding assistant can rebuild or change the system without guessing.

---

## What it does

| On the phone (in the park) | On the stream (OBS at home) |
|---|---|
| Tap what you're doing: a ride, a line, food, fireworks, a concert, a Skyliner trip | A ticket-style card: **ON A RIDE / Haunted Mansion / Magic Kingdom** with the posted wait |
| Build the day's plan from real park data (rides, shows, restaurants, waits, showtimes) | A **NEXT** tab under the card with your next planned stop |
| Tick ⏱ on a show to count down to it | A top countdown: "Luminous starts in 24m 10s", then **HAPPENING NOW** |
| Mods help from their own phones with only the abilities you give them | Changes appear within about a second, pushed live (no polling) |
| A mod taps **Switch to LIVE scene** | The PC at home switches OBS to the camera-only scene on both canvases |

---

## The pieces

```
  Phone app (React PWA)                    Cloudflare (free plan)                      Home streaming PC
 ┌──────────────────────┐   HTTPS    ┌───────────────────────────────┐   WebSocket  ┌─────────────────────────┐
 │ Now / Plan / Parks   │──────────► │ Worker: serves app + /api      │◄───────────► │ OBS overlay (browser    │
 │ owner or mod account │ ◄──────────│ R2: state.json, mods.json      │  push only   │ source, read-only key)  │
 └──────────┬───────────┘  live push │ Durable Object "LiveHub":      │              ├─────────────────────────┤
            │                        │ WebSockets, lockout, kicks     │◄───────────► │ Helper (Python): obeys  │
            │ park data (free, no key)└───────────────────────────────┘   BOT_KEY    │ "scene.live" only       │
            ▼                                        ▲                               └─────────────────────────┘
   api.themeparks.wiki                               │ /admin  Owner dashboard (add mods, pick abilities)
```

| Folder | What's in it |
|---|---|
| [`planner/`](planner/) | The phone app (React 19 + Vite), the Cloudflare Worker, the owner dashboard (`public/admin.html`), deploy and key scripts, tests |
| [`overlays/`](overlays/) | The OBS browser-source pages: NOW/NEXT card, offline and pause screens, low-data tile, BRB, preview tools |
| [`helper/`](helper/) | The small Python program on the streaming PC that switches OBS when a mod taps **Switch to LIVE scene** |
| [`obs-install/`](obs-install/) | Scripts that add the overlay sources to an OBS scene collection file (run with OBS closed) |
| [`tests/`](tests/) | Automated app tests, live checks, and saved park data used as test fixtures |
| [`research/`](research/) | Show and concert research used for the concert lineup feature |
| [`docs/human/`](docs/human/) | Detailed guides for people |
| [`docs/ai/`](docs/ai/) | Detailed specs for AI assistants |

---

## Read next

1. [How it works](docs/human/01-how-it-works.md): the whole system in plain language.
2. [Set it up from scratch](docs/human/02-setup-from-scratch.md): every step to replicate it on your own accounts.
3. [Using the app](docs/human/03-using-the-app.md): the everyday park-day workflow.
4. [Overlays in OBS](docs/human/04-overlays.md): every overlay page and its link settings.
5. [Mods and the owner dashboard](docs/human/05-mods-and-owner-dashboard.md): accounts, the 15 abilities, presets.
6. [Security](docs/human/06-security.md): what's protected and how.
7. [Troubleshooting](docs/human/07-troubleshooting.md).
8. [Secrets and placeholders](SECRETS.md): every `<PLACEHOLDER>` in the code and what goes there.
9. [Media not included](MEDIA.md): images, videos and fonts left out of the repo.

---

## Quick start (if you already know Cloudflare)

```powershell
cd planner
npm install
npx wrangler login
npx wrangler r2 bucket create ctpg-planner          # or your own bucket name (update wrangler.jsonc)
# edit wrangler.jsonc: your Worker name, bucket, and custom domain route
npx wrangler secret put OWNER_PASS                  # your own passcode
npx wrangler secret put ADMIN_PASS                  # owner dashboard passcode (different)
powershell -File scripts/set_keys.ps1               # makes OVERLAY_KEY + BOT_KEY, saves them locally, uploads them
npm run deploy
```

Download the media pack ([ParkDay-Stream-Kit-media.zip](https://github.com/cierra00/ParkDay-Stream-Kit/releases/download/media-v1/ParkDay-Stream-Kit-media.zip), 7.5 MB: photos, the low-data video, fonts) and unzip it in the repo root. Then copy `overlays/planner_key.example.js` to `overlays/planner_key.js`, fill in your domain and `OVERLAY_KEY`, and add `overlay.html?planner=1&look=ticket` as a browser source in OBS. The full walkthrough is in [Set it up from scratch](docs/human/02-setup-from-scratch.md).

---

## Status

- Live and in daily use since Sept 2026.
- The mod permissions, wrong-code lockout, instant mod cut-off and Sign out features (Sept 29 to 30, 2026) were built and tested before this upload. Check the deployed version before relying on them.
- Cost: runs on Cloudflare's free plan (a park day uses a few thousand requests).

## License

**MIT.** Fork it, clone it, set up your own copy, change it. Just keep the copyright notice. See [LICENSE](LICENSE). Channel names, branding and park photos in the media pack are for reference; use your own on your stream.

## Not affiliated

Cruise & Theme Park Guide is an independent fan channel, not affiliated with The Walt Disney Company, Universal or any park operator. Park data comes from the free [ThemeParks.wiki](https://themeparks.wiki) API.
