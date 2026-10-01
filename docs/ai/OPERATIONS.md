# OPERATIONS: build, test, deploy, port, pitfalls

## 1. Toolchain

Node 20+ (tested on 24), React ^19.3, Vite ^8.3, @vitejs/plugin-react ^6.1, Wrangler ^4.142. Python 3.10+ with `obsws-python`, `websocket-client` (helper) and `playwright` (some tests). OBS 30+ with obs-websocket 5.x; optional Aitum Vertical plugin.

## 2. Build and deploy

| Step | Command | Notes |
|---|---|---|
| Install | `cd planner && npm install` | |
| Dev UI | `npm run dev` | `/api` calls fail unless proxied to `wrangler dev` |
| Local full stack | `npx wrangler dev --local --port 8799 --var OWNER_PASS:... --var ADMIN_PASS:... --var BOT_KEY:... --var OVERLAY_KEY:...` | Uses local R2 + DO; add `--persist-to <dir>` to keep state |
| Build | `npm run build` | Emits `dist/` + `dist/version.json` with `__BUILD__` |
| Deploy | `npx wrangler deploy` | Secrets persist across deploys |
| Dry run | `npx wrangler deploy --dry-run --outdir <dir>` | Verifies the Worker bundles (e.g. the `../src/perms.js` import) |
| Secrets | `npx wrangler secret put NAME` | OWNER_PASS, ADMIN_PASS, OVERLAY_KEY, BOT_KEY |

`scripts/deploy_cdtick.ps1 [deploy]` is the owner's Windows wrapper (build, optional deploy). It hard-codes a path and `CLOUDFLARE_ACCOUNT_ID` placeholder.

## 3. Tests

| Test | Run | Pass condition |
|---|---|---|
| Permission matrix | `node planner/tests/perms_test.mjs` | table printed; `single-ability check failures: 0` |
| Security integration | start `wrangler dev` (port 8799, test vars above) then `node planner/tests/sec_test.mjs` | wrong codes `401 x10, 429`; locked address 429 even with owner code; other address 200; revoke closes socket with 4001; turned-off code 401; mod without plan.add -> 403 `Not allowed: Add stops` |
| App E2E | `tests/app-test-suite.js` (Playwright, serves built `dist/` with mocked `/api` and fixtures) | 83 checks, see `tests/app-test-results.txt` |
| Overlay render | `tests/shoot.ps1 -look ticket -name x` with `overlays/lab/lab.html` | visual |
| Live checks | `tests/verify.ps1`, `tests/peek_plan.py`, `tests/ver_check.py`, `tests/admin_check.py` | need real keys locally; Cloudflare may 403 default Python UA, scripts send a browser UA |

## 4. Porting (hard-coded values to change)

| Where | Value |
|---|---|
| `helper/ctpg_remote.py` | `C:\StreamerBot\ctpg-planner\.keys.json`, `C:\StreamerBot\ctpg-pack\planner_key.js`, scenes `live`/`live Vertical`, `VERTICAL` canvas uuid |
| `helper/start_remote.bat` | script path |
| `planner/scripts/*.ps1` | `C:\StreamerBot\ctpg-planner`, `<CLOUDFLARE_ACCOUNT_ID>` |
| `planner/worker/index.js` | owner display name `"Cierra"` |
| `planner/src/App.jsx` | resort maps (`RESORT_OF`, `MODES_AT`, `PLACES_AT`), favorite destinations regex, copy text |
| `planner/src/concerts.js` | lineup rows `["YYYY-MM-DD","YYYY-MM-DD","Band"]` |
| `obs-install/*.py` | scene collection `Moblin.json` path, scene and source names |
| `planner/wrangler.jsonc` | Worker name, bucket, route |

## 5. Pitfalls (learned)

1. obs-websocket 5.7: `SetCurrentProgramScene` ignores `canvasUuid`; vertical canvas scenes return error 604. Use `CallVendorRequest` vendor `aitum-vertical-canvas`, request `switch_scene` `{scene}` / `current_scene`.
2. `obsws_python` logs connection params including the password at INFO. Silence it.
3. OBS rewrites the scene collection on exit; edits while OBS runs are lost.
4. Chromium full-viewport screenshots can drop CSS 3D layers; clip the capture region.
5. Duplicate SVG gradient ids across inline SVGs break fills; make ids unique.
6. Cloudflare returns 403 to default Python urllib UA; send a browser UA in probes.
7. `wrangler dev` hibernated sockets may close lazily; the client also acts on the `revoked` message, not only the close code.
8. PWA caching: keep `sw.js` network-first and never cache `/version.json`, or phones get stuck on old builds.
9. Shared IPs (CGNAT, hotel Wi-Fi) share the lockout counter.

## 6. Change management used in the original project

Every change: backup (`*.bak-<tag>-<timestamp>`), change-log entry with undo steps, test before deploy, deploy only on explicit owner approval, OBS edits only with OBS closed. Secrets masked in all output.
