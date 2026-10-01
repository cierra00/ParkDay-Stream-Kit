import io
entry = """

## 2026-09-28: Park Day planner, Sign out on every account (built, not yet deployed)
- Planner app (you and mods): "Sign out" in the top bar. Tap once ("Tap again"), tap again within 3 s to sign out, so a stray tap mid-stream does nothing.
- Owner dashboard (/admin): same two-tap Sign out at the top, hidden on the sign-in screen. The old one at the bottom still works.
- Tested at phone size for owner, mod and dashboard: code cleared, back to sign-in, no errors.
- Backups: `*.bak-signout-20260928-220814` for src/App.jsx, src/styles.css, public/admin.html.
"""
io.open(r"D:\OBS-Mobilin_old\streamdocs\Change-Log.md", "a", encoding="utf-8").write(entry)
print("logged")
