import io
p = r"public\admin.html"
s = io.open(p, encoding="utf-8").read()
def rep(a, b):
    global s
    assert s.count(a) == 1, a[:80]
    s = s.replace(a, b)

rep('''const ROLES = { stream: { label: "Stream mod", perms: ["scene"], what: "GO LIVE button only" }, cohost: { label: "Co-host", perms: ["scene", "plan"], what: "GO LIVE button + change NOW / NEXT and the plan" }, custom: { label: "Custom", perms: null, what: "pick the permissions below" } };
const PERMS = [["scene", "GO LIVE button (switch the stream to the live scene, overlays off)"], ["plan", "Change NOW / NEXT and edit the plan"]];''',
'''// roles and permissions come from the server (/api/perms), so this page always matches the app
let ROLES = {}, PERMS = [];
const loadPerms = () => fetch("/api/perms").then(r => r.json()).then(j => { ROLES = { ...j.roles, custom: { label: "Custom", perms: null, what: "your own mix" } }; PERMS = j.perms; });
const open = new Set();   // cards with the permission list expanded''')
rep('''async function load() { try { mods''', '''async function load() { try { if (!PERMS.length) await loadPerms(); mods''')
rep('''const roleOf = m => (m.role && ROLES[m.role]) ? m.role : (JSON.stringify([...(m.perms || [])].sort()) === '["plan","scene"]' ? "cohost" : JSON.stringify(m.perms || []) === '["scene"]' ? "stream" : "custom");''',
'''const key = l => JSON.stringify([...(l || [])].sort());
// the preset that matches these exact permissions, else Custom
const roleOf = m => (Object.entries(ROLES).find(([k, r]) => r.perms && key(r.perms) === key(m.perms)) || ["custom"])[0];
const groups = () => [...new Set(PERMS.map(p => p.g))];''')
rep('''<select id="r">${Object.entries(ROLES).filter(([k]) => k !== "custom").map(([k, r]) => `<option value="${k}">${r.label}: ${r.what}</option>`).join("")}</select>''',
    '''<select id="r">${Object.entries(ROLES).filter(([k]) => k !== "custom").map(([k, r]) => `<option value="${k}" ${k === "live" ? "selected" : ""}>${r.label}: ${r.what}</option>`).join("")}</select>''')
rep('''    ${mods.map(m => { const r = roleOf(m); return `''', '''    ${mods.map(m => { const r = roleOf(m), n = (m.perms || []).length, isOpen = open.has(m.id); return `''')
rep('''        <div class="row"><span class="muted">Role</span><select class="role">${Object.entries(ROLES).map(([k, x]) => `<option value="${k}" ${k === r ? "selected" : ""}>${x.label}</option>`).join("")}</select></div>
        <div class="perms">${PERMS.map(([k, l]) => `<label><input type="checkbox" class="perm" value="${k}" ${(m.perms || []).includes(k) ? "checked" : ""}> ${l}</label>`).join("")}</div>''',
'''        <div class="row"><span class="muted">Role</span><select class="role">${Object.entries(ROLES).map(([k, x]) => `<option value="${k}" ${k === r ? "selected" : ""}>${x.label}</option>`).join("")}</select>
          <button class="ghost small more">${isOpen ? "Hide" : "Choose"} abilities (${n} of ${PERMS.length})</button></div>
        <p class="muted small">${esc(ROLES[r].what)}</p>
        ${isOpen ? `<div class="perms">${groups().map(g => `<fieldset><legend>${esc(g)}</legend>${PERMS.filter(p => p.g === g).map(p => `<label><input type="checkbox" class="perm" value="${p.k}" ${(m.perms || []).includes(p.k) ? "checked" : ""}><span><b>${esc(p.l)}</b><small>${esc(p.h)}</small></span></label>`).join("")}</fieldset>`).join("")}
          <div class="row"><button class="ghost small all">All</button><button class="ghost small none">None</button></div></div>` : ""}''')
rep('''    el.querySelectorAll(".perm").forEach(cb => cb.onchange = () => put(x => { const on = [...el.querySelectorAll(".perm")].filter(c => c.checked).map(c => c.value); x.perms = on; x.role = roleOf({ perms: on }); return x; }));''',
'''    el.querySelector(".more").onclick = () => { open.has(id) ? open.delete(id) : open.add(id); render(); };
    el.querySelectorAll(".perm").forEach(cb => cb.onchange = () => put(x => { const on = [...el.querySelectorAll(".perm")].filter(c => c.checked).map(c => c.value); x.perms = on; x.role = roleOf({ perms: on }); return x; }));
    const setAll = on => put(x => { x.perms = on ? PERMS.map(p => p.k) : []; x.role = roleOf(x); return x; });
    if (el.querySelector(".all")) { el.querySelector(".all").onclick = () => setAll(true); el.querySelector(".none").onclick = () => setAll(false); }''')
rep('''    el.querySelector(".role").onchange = e => { const r = e.target.value; put(x => { x.role = r; if (ROLES[r].perms) x.perms = ROLES[r].perms; return x; }); };''',
    '''    el.querySelector(".role").onchange = e => { const r = e.target.value; if (r === "custom") { open.add(id); render(); return; } put(x => { x.role = r; x.perms = ROLES[r].perms; return x; }); };''')
# styles
rep('''.perms label{display:flex;gap:8px;align-items:center;font:700 14px var(--body);padding:4px 0}
.perms input{flex:none;width:18px;height:18px;accent-color:var(--sun)}''',
'''.perms{display:grid;gap:10px}
.perms fieldset{border:1px solid var(--line);border-radius:12px;padding:6px 12px 8px;margin:0}
.perms legend{font:900 12px var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--sun);padding:0 6px}
.perms label{display:flex;gap:10px;align-items:flex-start;font:700 14px var(--body);padding:6px 0;cursor:pointer}
.perms label span{display:grid;gap:2px}.perms small{color:var(--muted);font:600 12px var(--body)}
.perms input{flex:none;width:20px;height:20px;margin-top:1px;accent-color:var(--sun)}
button.small{padding:7px 11px;font-size:13px}.small{font-size:13px}p.small{margin:0}''')
io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("admin ok")
