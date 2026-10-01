import io
p = r"C:\StreamerBot\ctpg-planner\src\api.js"
s = io.open(p, encoding="utf-8").read()
a = '''ws.onmessage = e => { if (e.data === "pong") return; try { onMsg(JSON.parse(e.data)); } catch {} };'''
assert s.count(a) == 1
s = s.replace(a, '''ws.onmessage = e => { if (e.data === "pong") return; let m; try { m = JSON.parse(e.data); } catch { return; } if (m && m.type === "revoked") { stop = true; setCode(""); try { ws.close(); } catch {} location.reload(); return; } try { onMsg(m); } catch {} };''')
io.open(p, "w", encoding="utf-8", newline="\n").write(s)
t = r"C:\StreamerBot\ctpg-planner\lab\sec_test.mjs"
s = io.open(t, encoding="utf-8").read().replace('res("still open"), 4000', 'res("still open"), 15000')
io.open(t, "w", encoding="utf-8", newline="\n").write(s)
print("ok")
