# 6. Security

What protects the stream, and what you need to keep private.

---

## Keep these private

| Secret | Where it lives | If it leaks |
|---|---|---|
| `OWNER_PASS` | Cloudflare secret, your password manager | Someone can control the whole app. Change it at once |
| `ADMIN_PASS` | Cloudflare secret | Someone can add mods. Change it, check the mod list |
| `OVERLAY_KEY` | Cloudflare secret, `planner/.keys.json`, `overlays/planner_key.js` | Read-only: someone can see your plan. Make new keys |
| `BOT_KEY` | Cloudflare secret, `planner/.keys.json` | Someone could pretend to be the helper (report fake scene status). They still can't switch your OBS |
| OBS websocket password | OBS settings (the helper reads it from there) | Only matters on your home network |
| Mod codes | Only the mod has it | Turn that mod off or give them a New code |

`.keys.json` and `planner_key.js` are in `.gitignore`. This repo contains placeholders like `<OVERLAY_KEY>` instead (see [SECRETS.md](../../SECRETS.md)). Before this repo was published, every file was scanned against the real values and for anything that looks like a password or token.

**Make new keys:** run `planner/scripts/set_keys.ps1` after deleting `.keys.json`, update `planner_key.js`, redeploy, refresh OBS.

---

## Built-in protections

| Protection | How |
|---|---|
| Encrypted | Everything is HTTPS / WSS through Cloudflare |
| No code, no access | Every API call and live connection needs a valid code. Wrong code: refused before it reaches the live hub |
| Wrong-code lockout | 10 wrong codes within 15 minutes from one internet address locks that address for 15 minutes (even the right code). It clears on its own |
| Guess-proof mod codes | 3 random words + 4 digits from a 64-word list: about 2.4 billion possibilities, created with the browser's secure random generator |
| Codes stored hashed | Mod codes are saved only as SHA-256 hashes. Compared in constant time |
| Permissions enforced by the server | A mod's save is compared with what's on the server. If it changes anything outside their abilities, it's refused (403) |
| Instant cut-off | Turn off / New code / Remove closes that mod's open connection at once and signs them out |
| Phones and overlays can't send commands over the live connection | The live connection is listen-only for them. Only the helper's status reports are accepted |
| One command only | The helper obeys `scene.live` and nothing else. It can't start or stop the stream or change settings |
| Home PC not exposed | The helper connects out to Cloudflare; no router ports are opened |
| Helper log is safe | It uses its own log file and silences the OBS library's logging, which would otherwise write the websocket password |

## Known limits

- The words on the stream card are built on the phone that saves. The server checks which parts of the day a mod changed, but not the card wording itself. Give the NOW abilities only to people you trust.
- Codes travel inside the live-connection address (`?key=`). It's encrypted, but can appear in your own Cloudflare request logs.
- Everyone signed in (including the overlay key) can read the full day plan.
- The lockout is per internet address. People sharing hotel or cell-network Wi-Fi share an address: if someone there mistypes 10 times, everyone on it waits 15 minutes (or switches networks).
