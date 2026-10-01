# Secrets and placeholders

This repo is public. Every private value was replaced with a placeholder in angle brackets. Replace them only in your local copy, and never commit the real values.

| Placeholder | What goes there | Where you get it | Used in |
|---|---|---|---|
| `<OVERLAY_KEY>` | Read-only key for the OBS overlay | Made by `planner/scripts/set_keys.ps1` (saved in `planner/.keys.json`) | `overlays/planner_key.js` (copy of `planner_key.example.js`) |
| `<BOT_KEY>` | Key for the home PC helper | Same as above | Read by `helper/ctpg_remote.py` from `.keys.json` |
| `<CLOUDFLARE_ACCOUNT_ID>` | Your Cloudflare account ID (not a password, but kept private) | Cloudflare dashboard | `planner/scripts/*.ps1` |
| `<OBS_WEBSOCKET_PASSWORD>` | OBS websocket password | OBS, Tools, WebSocket Server Settings | Never needed in files: the helper reads it from OBS's own config |
| `<SRT_STREAMID>`, `<STREAM_KEY>`, `<OVERLAYS_UNO_ID>`, `<APPS_SCRIPT_ID>` | Streaming and third-party IDs | Your own services | Only if they appear in OBS install scripts |

Passcodes that never appear anywhere, not even as placeholders: `OWNER_PASS` and `ADMIN_PASS`. Set them only with `npx wrangler secret put`.

Files that hold real values locally and are git-ignored:

- `planner/.keys.json`
- `overlays/planner_key.js`
- `planner/.dev.vars`
- `helper/remote.log`
