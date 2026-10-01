import io
entry = """

## 2026-09-28: Park Day planner, detailed mod permissions (built, not yet deployed)
- 15 separate abilities replace the old two ("scene", "plan"). List lives in `ctpg-planner/src/perms.js` and feeds the app, the Worker and /admin (via `/api/perms`).
- Groups: Stream (Switch to LIVE scene), NOW card (put on NOW, Done/Clear, Pause/Resume, details), NEXT, Countdown (pick stop, switch and timing), On stream (NEXT line and live-scene card), Plan (add, change times, check off, remove), Parks (park we're at, today's parks).
- Presets in /admin: Mod (default: Switch to LIVE scene + NOW + add/change/remove plan stops), Scene only, Live helper, Planner, Co-host, Viewer, Custom.
- Server enforces it: a mod's save is compared with what's on the server and refused (403) if it changes something they don't have. The app then shows "You don't have: ..." and reloads what's really on stream.
- Mods only see the controls they're allowed; Parks tab lists "What you can do".
- Older mods saved with "plan" still get everything except the scene button.
- The big button is renamed "Switch to LIVE scene (overlays off)". It only switches the OBS scene; the home PC helper obeys scene.live only and never starts or stops the stream.
- Known limit: the stream card text (display) is built on the phone and not re-checked by the server.
- Backups: `*.bak-perms-20260928-214858` for worker/index.js, src/App.jsx, src/api.js, src/styles.css, public/admin.html.
- Undo: copy those backups back and run `deploy_cdtick.ps1 deploy`.
"""
p = r"D:\OBS-Mobilin_old\streamdocs\Change-Log.md"
io.open(p, "a", encoding="utf-8").write(entry)
print("logged")
