import io
entry = """

## 2026-09-28: Park Day planner, security fixes (built, not yet deployed)
- Wrong-code lockout: 10 wrong codes within 15 min from one internet address locks that address for 15 min (HTTP 429 "Too many wrong codes"). Counted in the LiveHub Durable Object; old records are cleaned up hourly by an alarm.
- Stronger mod codes from /admin: 3 random words + 4 digits (e.g. WORD-WORD-WORD-1234), about 2 billion combinations. Existing codes keep working; tap New code to upgrade one.
- Turning a mod off, removing them or giving a new code now disconnects their open app right away (message "revoked" + close 4001) and signs them out.
- Tested locally with wrangler dev and throwaway test codes: lockout at try 11, other addresses unaffected, revoke closes the socket (4001), turned-off code gets 401, a mod without "Add stops" gets 403.
- Backups: `*.bak-sec-20260928-215859` for worker/index.js, src/App.jsx, src/api.js, public/admin.html.
- Undo: copy those backups back and run `deploy_cdtick.ps1 deploy`.
"""
io.open(r"D:\OBS-Mobilin_old\streamdocs\Change-Log.md", "a", encoding="utf-8").write(entry)
print("logged")
