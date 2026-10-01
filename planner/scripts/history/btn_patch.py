import io
p = r"C:\StreamerBot\ctpg-planner\src\App.jsx"
s = io.open(p, encoding="utf-8").read()
a = '''onLive ? "✓ On LIVE (no overlays)" : "🎥 GO LIVE: remove overlays"'''
assert s.count(a) == 1
s = s.replace(a, '''onLive ? "✓ On LIVE scene (no overlays)" : "🎥 Switch to LIVE scene (overlays off)"''')
io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("ok")
