# OVERLAY-CONTRACT: what `overlays/overlay.html` consumes

The overlay is a dumb renderer of `state.display` (built by `buildDisplay` in App.jsx). It never calls ThemeParks.wiki and never computes NEXT itself.

## 1. Config

`overlays/planner_key.js` (git-ignored) MUST define:

```js
window.CTPG_PLANNER = { url: 'https://<planner host>', key: '<OVERLAY_KEY>' };
```

Loaded via a `<script>` next to the page (file:// source in OBS).

## 2. Transport

1. On load (`?planner=1`): `GET {url}/api/state?key={key}` (`cache:no-store`).
2. Then `new WebSocket(url.replace(/^http/,'ws') + '/api/ws?key=' + key)`; on `{type:"state"}` -> `applyPlanner(m.state)`; `"pong"` ignored; reconnect with backoff on close.
3. No polling. OBS source MUST have "Shutdown source when not visible" so the socket exists only while the scene is live.

## 3. `display` object

```jsonc
{
  "now": "In line: Haunted Mansion · 35 min posted",        // plain text summary (legacy)
  "nowParts": {                                               // null = hide card
    "cat": "line",          // drives color + icon: ride line eat fireworks parade concert show meet shop explore hop travel custom
    "label": "In line · 35 min wait",
    "title": "Haunted Mansion",
    "sub": "Magic Kingdom",
    "wait": 35,             // >0 -> round wait sticker
    "posted": 0,            // ride: posted wait shown differently
    "mode": "skyliner"      // travel only: icon
  },
  "pending": "In line",     // category tapped, nothing picked (app-only hint; overlay shows nothing)
  "park": "Magic Kingdom", "parkId": "<uuid>", "tz": "America/New_York",
  "next": { "time": "21:30", "label": "Happily Ever After" },   // null = no NEXT tab
  "shows": [ { "id": "<stop id>", "time": "21:00", "label": "Luminous", "parkId": "<uuid>" } ],   // countdown target (0 or 1)
  "settings": { "countdown": true, "within": 180, "next": true, "onLive": false, "cdId": "<stop id>|''" }
}
```

## 4. Render rules

| Rule | Implementation |
|---|---|
| Staleness | ignore state if `Date.now() - state.updated > STALE_MS (12 h)` |
| Card | render when `nowParts`; else hide. If hidden but `next` and `settings.next !== false` -> NEXT tab only |
| NEXT tab | hidden when `settings.next === false` |
| Countdown | only if `settings.countdown !== false` (URL `cd=0` overrides) and a `shows[0]` exists; visible when minutes until start `<= within` (1440 = always); after start shows HAPPENING NOW for `LIVE_FOR = 30 min`; times 00:00 to 04:00 treated as same night |
| `scene=live` copy | shown only when `settings.onLive` is true AND OBS program scene (via `window.obsstudio` + `obsSceneChanged`) is the live scene; countdown never shown there |
| Layout | `layout=vertical` -> 1080x1920 positions |
| Looks | `look=ticket|bar|sign|classic` CSS variants |
| Text fit | shrink then balanced two-line wrap; hyphenated words wrapped in `.nb` spans; refit after `document.fonts.ready` |
| Motion | disabled under `prefers-reduced-motion` |

## 5. Test hooks

`mock=<url-encoded JSON state>` bypasses network. `previewbg=<image>` adds a background. `debug=1` writes status to `document.title`; `debug=show` renders a readout.
