import io
def patch(p, pairs):
    s = io.open(p, encoding="utf-8").read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80])
        s = s.replace(a, b)
    io.open(p, "w", encoding="utf-8", newline="\n").write(s)

X = r"C:\StreamerBot\ctpg-planner\src\App.jsx"
patch(X, [
 ('''<span className={`sync ${sync !== "ok" ? "wait" : ""}`}>{syncLabel}</span></header>''',
  '''<span className={`sync ${sync !== "ok" ? "wait" : ""}`}>{syncLabel}</span><SignOut /></header>'''),
 ('''// ---------- login ----------''', '''// Sign out (every account): tap once to arm, tap again within 3 s, so a stray tap mid-stream doesn't log you out
function SignOut() {
  const [sure, setSure] = useState(false);
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t); }, [sure]);
  return <button className={`signout ${sure ? "sure" : ""}`} onClick={() => { if (!sure) return setSure(true); setCode(""); location.reload(); }}>{sure ? "Tap again" : "Sign out"}</button>;
}

// ---------- login ----------'''),
])
C = r"C:\StreamerBot\ctpg-planner\src\styles.css"
s = io.open(C, encoding="utf-8").read()
s += '''
/* sign out, top bar on every account */
.signout { flex: none; margin-left: 8px; background: transparent; border: 1.5px solid var(--line); color: var(--muted); border-radius: 999px; padding: 5px 11px; font: 800 12px var(--body); cursor: pointer; }
.signout.sure { border-color: #ff4f9a; color: #ff9fc4; }
'''
io.open(C, "w", encoding="utf-8", newline="\n").write(s)

A = r"C:\StreamerBot\ctpg-planner\public\admin.html"
patch(A, [
 ('''<h1>Park <span>Day</span> Owner Dashboard</h1>''', '''<div class="row between"><h1>Park <span>Day</span> Owner Dashboard</h1><button class="ghost small" id="topout" hidden>Sign out</button></div>'''),
 ('''  $("#out").onclick = () => { try { localStorage.removeItem(KEY); } catch (x) {} code = ""; login(); };''',
  '''  $("#out").onclick = signOut;
  const top = $("#topout"); top.hidden = false; top.textContent = "Sign out"; delete top.dataset.sure;
  top.onclick = () => { if (top.dataset.sure) return signOut(); top.dataset.sure = "1"; top.textContent = "Tap again"; setTimeout(() => { if (top.dataset.sure) { delete top.dataset.sure; top.textContent = "Sign out"; } }, 3000); };'''),
 ('''function login(msg) {''', '''function signOut() { try { localStorage.removeItem(KEY); } catch (x) {} code = ""; mods = []; shown = null; login(); }
function login(msg) {
  $("#topout").hidden = true;'''),
])
print("ok")
