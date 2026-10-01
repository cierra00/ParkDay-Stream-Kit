# 4. Overlays in OBS

The overlay pages are plain HTML files that OBS shows as **Browser** sources. They live in `overlays/`. Photos, videos and local fonts come from the media pack (see [MEDIA.md](../../MEDIA.md)).

**Use these browser source settings on every one:**

- **Shutdown source when not visible:** on.
- **Refresh browser when scene becomes active:** on.

With these, a page only runs, and only connects to anything, while its scene is on screen.

| Page | Typical scene | What it shows |
|---|---|---|
| `overlay.html?planner=1&look=ticket` | **Now** (camera + card) | The NOW / NEXT card and the top show countdown |
| `offline.html?bg=dca` | **offline** | "Hang Tight!" signal-lost screen with a park photo and a reconnect timer |
| `offline.html?mode=pause` | **pause** | "Quick Break!" screen in the same style |
| `lowdata.html` | **low-data** | The spinning 3D "LOW DATA MODE / HANG TIGHT" tile |
| `screens.html` | design board | All screen designs side by side (for picking a look) |
| `planner.html` | none (older) | The first stream planner page, kept for reference |

Add `&layout=vertical` to any of them for a 1080 x 1920 vertical canvas.

---

## The NOW / NEXT card: `overlay.html`

### How it gets data

1. `planner_key.js` (next to the page) holds your planner URL and the read-only `OVERLAY_KEY`. Make it from `planner_key.example.js`. Never commit it.
2. When the scene opens, the page fetches the day once (`GET /api/state?key=...`).
3. It then opens one live connection (`/api/ws?key=...`) and redraws whenever a new day is pushed. No polling.
4. If the connection drops, it reconnects on its own.

### Link settings

| Setting | Does |
|---|---|
| `planner=1` | Use the Park Day app (the normal mode) |
| `look=ticket` / `bar` / `sign` | Card style. Leave it off for the original dark card ("classic") |
| `layout=vertical` | 1080 x 1920 layout |
| `scene=live` | This copy is for the camera-only scene. It only shows when **Also show the card on the live scene** is on in the app. Needs the OBS page permission "Read access to user information" |
| `card=0` | Hide the card (countdown only) |
| `cd=0` | Hide the countdown (overrides the app) |
| `within=180` | Countdown appears this many minutes before the show (overrides the app) |
| `debug=1` / `debug=show` | Connection status in the page title / on screen, for testing |
| `mock=<json>` | Show a fake day instead of the real one (testing) |
| `previewbg=<image>` | Put a photo behind the card (testing screenshots) |

### The looks

| Look | Style |
|---|---|
| **ticket** | Cream park-ticket card, colored stub with an activity icon, round yellow wait sticker, NEXT tab underneath |
| bar | Slim dark lower-third strip, colored edge, NEXT built in on the right |
| sign | Bold card in the activity color, white icon circle, wait sticker |
| classic | Original dark card with a NOW chip |

Activity colors: ride teal, line gold, food pink, show violet, fireworks magenta, parade blue, concert rose, meeting orange, shopping green, exploring blue, park hopping red, getting around indigo.

### What viewers see, and when

| Situation | On stream |
|---|---|
| Nothing picked | Nothing (card hidden) |
| Nothing picked, but there's a NEXT | Only the NEXT tab |
| A category tapped but nothing picked yet | Nothing yet |
| On a ride / In line with a posted wait | Round wait sticker |
| A stop ticked with ⏱, countdown on | Top countdown "Name starts in 24m 10s", pulses in the last minute |
| Show start time reached | **HAPPENING NOW** with confetti, for 30 minutes |
| Nothing updated for 12 hours | Everything hidden (yesterday's day never shows) |
| After midnight | 12 AM to 4 AM times count as the same night |

Long names shrink a little, then wrap to two even lines. Hyphenated names never split. Motion (slide in, shine every 14 seconds, flip when NEXT changes) turns off for "reduce motion".

---

## Offline and pause screens: `offline.html`

| Setting | Does |
|---|---|
| `mode=pause` | "Quick Break!" with a pause icon and "On break · m:ss" instead of "Hang Tight!" and "Reconnecting · m:ss" |
| `bg=dca` / `bg=monorail` | Photo in the window (`offline-dca-wide/tall.jpg`, `offline-monorail-wide/tall.jpg` from the media pack) |
| `layout=vertical` | 1080 x 1920 |
| `msg=Your text` | Replaces the message line |
| `style=window` / `card` / `tint` | Design direction (window is the one in use) |

The timer counts up from when the scene opened.

## Low data tile: `lowdata.html`

Plays `low-data-classic.webm` (640 x 640, transparent, 6-second loop): a blue tile with an orange rim and a classic Wi-Fi icon that tilts, spins and blinks its signal bars.

| Setting | Does |
|---|---|
| `layout=vertical` | Vertical position (larger, higher) |
| `pos=top` | Move it to the top |
| `size=` | Scale it |

You can also skip the page and add the webm directly as a looping **Media Source**. That's how the original setup runs it. The design source is `lowdata-classic.html`, and earlier designs are in `design-history/lowdata/`.

## BRB typewriter frames

`brb_text.py` renders "BE RIGHT BACK!" typewriter frames in two styles (DCA and Monorail) into `overlays/brb_text/`. They're included in the media pack.

---

## Adding sources automatically: `obs-install/`

Scripts that edit the OBS scene collection file directly:

- `apply_planner_overlay.py`: adds the Now card sources.
- `apply_offline_screen.py` and `apply_pause_screen.py`: add the offline and pause screens.
- `apply_lowdata_tile.py`: adds the low data tile.
- `apply_look.py ticket`: switches the card look.
- `add_vertical.py`: adds the vertical copies.
- The rest are fixes and helpers.

Rules:

1. **Close OBS first.** OBS overwrites the file when it closes.
2. They're written for a collection named `Moblin` with scenes `Now`, `live`, `offline`, `pause`, `low-data` and their `Vertical` twins. Change the names at the top of each script for your setup.
3. Each script makes a timestamped backup (`Moblin.json.bak-*`) before changing anything.
4. They use Windows paths like `C:\StreamerBot\ctpg-pack`. Change them to where you put `overlays/`.

## Testing the overlays

| Tool | Does |
|---|---|
| `overlays/lab/lab.html` + `tests/shoot.ps1 -look ticket -name test` | Renders the card over a park photo in 8 situations (hop, wait, long names, countdown, vertical) using local fonts |
| `overlay.html?planner=1&mock=<json>&previewbg=<image>` | Shows any fake day |
| `overlays/preview-live/` | A frame that shows the real overlay with the real day, for screenshots |
| `tests/verify.ps1` | Checks the deployed app, what the phone last sent, and renders the real OBS link |

Screenshots taken while animations run can catch the card mid-slide. Use Chromium's `--force-prefers-reduced-motion` for a still frame.
