# AI_README: Park Day Stream Kit (machine-oriented spec)

Audience: AI coding agents rebuilding, extending or debugging this system. Humans: read `README.md`.
Conventions: MUST / MUST NOT are hard requirements. Paths are repo-relative. Times are park-local `HH:MM` (24 h) unless stated.

Detailed specs: `docs/ai/DATA-MODEL.md` (state + rules), `docs/ai/API.md` (Worker, auth, permissions, WebSocket protocol), `docs/ai/OVERLAY-CONTRACT.md` (what the OBS page consumes), `docs/ai/OPERATIONS.md` (build, test, deploy, replicate, pitfalls).

---

## 1. System summary

```
PWA (planner/src, React 19, Vite 8) --PUT /api/state--> Worker (planner/worker/index.js)
      |  reads park data directly from https://api.themeparks.wiki/v1 (no key)      |-- R2 binding PLAN: state.json, mods.json
      |<------------------- WS /api/ws (push {type:"state"}) -----------------------|-- DO class LiveHub (binding HUB, id "main")
OBS browser source (overlays/overlay.html) --GET /api/state?key, WS /api/ws?key--> (role overlay, read-only)
Helper (helper/ctpg_remote.py, Python) --WS /api/ws?key=BOT_KEY--> receives {type:"cmd",action:"scene.live"}, replies {type:"result"}, sends {type:"status"} every 30 s
Owner dashboard (planner/public/admin.html, static) --GET/PUT /api/mods, GET /api/perms
```

Single source of truth for permissions: `planner/src/perms.js` (imported by the app AND the Worker via `../src/perms.js`; served to `/admin` via `GET /api/perms`).

## 2. Repository map

| Path | Role |
|---|---|
| `planner/src/App.jsx` | Entire app UI + state logic (normalize, nowStop, nextItem, startStop, finishNow, pauseNow, resumeNow, setNext, goNow, buildDisplay, NowTab, PlanTab, ParksTab, Preview, CountdownLine, StreamControls, GoLive, SignOut, Login, CanCtx) |
| `planner/src/api.js` | fetch wrapper `call()`, `saveState`, `fetchState`, `whoami`, `sendCmd`, `getMods`, `putMods`, `liveLink` (WS with backoff, handles `revoked` and close 4001) |
| `planner/src/parks.js` | ThemeParks.wiki client: `loadDestinations`, `loadPark(id)` -> `{tz, items:[{id,n,t:'A'|'S'|'R',o,w,x:[HH:MM],s}]}` |
| `planner/src/concerts.js` | `CONCERT` regex, `bandFor(name, tz)` from dated lineup rows |
| `planner/src/perms.js` | `PERMS`, `PERM_KEYS`, `ROLES`, `expandPerms`, `neededPerms(a,b)`, `missingPerm(perms,a,b)`, `permLabel` |
| `planner/worker/index.js` | Worker fetch handler + `LiveHub` Durable Object |
| `planner/public/admin.html` | Owner dashboard, vanilla JS, localStorage key `parkday-admin-code` |
| `planner/public/sw.js` | Service worker: network-first shell cache `parkday-v2`, never caches `/api/*` or `/version.json` |
| `planner/vite.config.js` | Defines `__BUILD__` (ET timestamp) and emits `version.json`; app self-reloads on mismatch |
| `planner/wrangler.jsonc` | Worker name, R2 bucket, DO binding + migration `v1` (`new_sqlite_classes: [LiveHub]`), custom-domain route, `assets.run_worker_first: ["/api/*"]`, SPA fallback |
| `planner/scripts/` | `set_keys.ps1` (OVERLAY_KEY/BOT_KEY), `set_admin_pass.ps1`, `deploy_cdtick.ps1 [deploy]`; `history/` = superseded one-off scripts, kept for provenance |
| `planner/tests/perms_test.mjs` | Unit test of `missingPerm` across roles (node) |
| `planner/tests/sec_test.mjs` | Integration test against `wrangler dev` (lockout, revoke, 403) |
| `overlays/overlay.html` | NOW/NEXT card + countdown (reads `window.CTPG_PLANNER` from `planner_key.js`) |
| `overlays/offline.html`, `lowdata.html`, `lowdata-classic.html`, `screens.html`, `planner.html` | Other OBS pages |
| `helper/` | `ctpg_remote.py`, `start_remote.bat`, `test_live.py`, `test_vert.py` |
| `obs-install/` | Python scripts that mutate an OBS scene collection JSON (OBS MUST be closed) |
| `tests/` | Playwright suite `app-test-suite.js` (83 checks), live probes, fixtures (`*-children.json`, `*-live.json`, `destinations.json`) |
| `MEDIA.md` | Media pack manifest + download link; media paths are git-ignored |
| `SECRETS.md` | Every placeholder token and where the real value comes from |

## 3. Invariants (MUST hold after any change)

1. No secret value is ever committed. Placeholders: `<OVERLAY_KEY>`, `<BOT_KEY>`, `<CLOUDFLARE_ACCOUNT_ID>`, `<OBS_WEBSOCKET_PASSWORD>`, `<SRT_STREAMID>`, `<OVERLAYS_UNO_ID>`, `<STREAM_KEY>`, `<APPS_SCRIPT_ID>`.
2. Scripts and logs MUST NOT print secrets. `ctpg_remote.py` MUST keep `obsws_python` and `websocket` loggers at CRITICAL (the OBS lib logs the password).
3. Permission logic lives ONLY in `perms.js`. UI gating (`useContext(CanCtx)`) is cosmetic; the Worker's `missingPerm` diff is authoritative.
4. The helper MUST whitelist commands (currently only `scene.live`). Never add stream start/stop without an explicit owner decision.
5. State saves are whole-document PUTs; the client debounces 400 ms and retries every 5 s; 401 clears the code; 403 (`e.forbidden`) toasts and refetches server state.
6. Overlay MUST NOT poll; it fetches once then listens on WS. OBS sources use "shutdown when not visible".
7. OBS scene-collection edits happen only while OBS is closed, with a timestamped backup first.
8. Style rule for user-facing copy in this project: no em dashes.

## 4. Key constants

| Constant | Value | Where |
|---|---|---|
| `GRACE` | 30 min: a late stop stays NEXT | App.jsx (overlay uses same) |
| `SOON` | 5 min: Done auto-starts NEXT | App.jsx |
| `LIVE_FOR` | 30 min: HAPPENING NOW duration | overlay.html |
| `STALE_MS` | 12 h: overlay ignores older state | overlay.html |
| Undo window | 4.5 s | App.jsx |
| Save debounce / retry | 400 ms / 5 s | App.jsx |
| Wait refresh | 120 s while app visible | App.jsx |
| Helper status beat | 30 s | ctpg_remote.py |
| Lockout | 10 wrong codes / 15 min window -> 15 min lock, per `cf-connecting-ip` | Worker `LiveHub.failed` |
| Mods max | 25 | Worker PUT /api/mods |
| Mod code format | 3 words from 64 + 4 digits (crypto RNG) | admin.html `newCode` |
| WS close code for revoke | 4001 (client MUST NOT reconnect) | Worker `kick`, api.js |

## 5. Quick commands

```bash
cd planner && npm install
npm run build                      # vite -> dist/ (+ version.json)
npx wrangler deploy                # or: npm run deploy
node tests/perms_test.mjs          # permission matrix; expect "single-ability check failures: 0"
npx wrangler dev --local --port 8799 --var OWNER_PASS:TEST-OWNER --var ADMIN_PASS:TEST-ADMIN --var BOT_KEY:TEST-BOT --var OVERLAY_KEY:TEST-OVERLAY
node tests/sec_test.mjs            # against the dev server above
```

## 6. Replication checklist (agent)

1. Create R2 bucket; set `wrangler.jsonc` `name`, `bucket_name`, `routes` (or remove routes for workers.dev).
2. `wrangler secret put` OWNER_PASS, ADMIN_PASS (distinct); run `scripts/set_keys.ps1` (edit its hard-coded paths/account id) or put OVERLAY_KEY/BOT_KEY manually (>= 24 random bytes, base64url).
3. Deploy. Verify: `GET /api/perms` 200 without auth; `GET /api/whoami` 401 without auth; owner code -> `{role:"owner"}`.
4. Create `overlays/planner_key.js` from the example; add OBS browser source `overlay.html?planner=1&look=ticket` (3840x2160) with shutdown-when-hidden + refresh-on-activate.
5. Download the media pack (MEDIA.md) and unzip at repo root.
6. Helper: `pip install obsws-python websocket-client`; edit hard-coded paths, scene names `live` / `live Vertical`, `VERTICAL` canvas id; run `python helper/ctpg_remote.py --test-live`, then `start_remote.bat`.
7. Hard-coded Windows paths to update when porting: `C:\StreamerBot\ctpg-planner\...`, `C:\StreamerBot\ctpg-pack\...` in helper, obs-install, tests and scripts. Repo equivalents: `planner/`, `overlays/`.
