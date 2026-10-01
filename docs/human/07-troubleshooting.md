# 7. Troubleshooting

| Problem | Check / fix |
|---|---|
| Card not updating on stream | Phone pill says **On stream ✓**? In OBS, right-click the overlay source, **Refresh** (or switch scenes away and back). Try `&debug=show` on the link to see the connection |
| Card blank in OBS | `planner_key.js` missing or wrong key/URL next to `overlay.html`. Nothing picked on the phone. Day older than 12 hours |
| App shows an old version | Close it fully and reopen. Still old: remove the home-screen icon and add it again |
| "That passcode didn't work" | Retype it. Forgotten: set a new one with `npx wrangler secret put OWNER_PASS` |
| "Too many wrong codes. Try again in N min." | Wait 15 minutes, or switch from Wi-Fi to cell data (new internet address) |
| "That's the owner dashboard code…" | You typed `ADMIN_PASS` in the app. Open the address with `/admin` at the end |
| "Waiting for signal" stays up | No data in the park. It retries every 5 seconds; nothing is lost |
| Mod says "You don't have: …" | They tried something outside their abilities. Change their abilities in `/admin` |
| Mod got signed out | You (or someone at /admin) turned them off, removed them or made a new code |
| Switch to LIVE scene: "Streamer.bot is not connected" | The helper isn't running on the home PC. Run `helper/start_remote.bat`; check `helper/remote.log` |
| Switch works on main but not vertical | The vertical scene name or Aitum Vertical plugin; see `remote.log` ("main only") |
| No wait sticker | The park isn't posting a wait (closed, walk-through, after hours) |
| No band on a concert | Not in `planner/src/concerts.js` for tonight; type it under **Band on stream** |
| Offline screen shows an empty photo window | Media pack not unzipped (see [MEDIA.md](../../MEDIA.md)) |
| OBS lost my changes after running an install script | OBS was open. Close OBS, restore the `Moblin.json.bak-*` backup, run the script again |
| Deploy fails "Authentication error" | `npx wrangler login` again; set `CLOUDFLARE_ACCOUNT_ID` if you have several accounts |
| Worker returns 403 on everything for a mod | Their abilities list is empty (Viewer). That's expected for saves |
