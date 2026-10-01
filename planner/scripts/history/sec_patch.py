import io
def patch(p, pairs):
    s = io.open(p, encoding="utf-8").read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80])
        s = s.replace(a, b)
    io.open(p, "w", encoding="utf-8", newline="\n").write(s)

W = r"C:\StreamerBot\ctpg-planner\worker\index.js"
patch(W, [
 ('return m ? { role: "mod", name: m.name, perms: expandPerms(m.perms) } : null;',
  'return m ? { role: "mod", id: m.id, name: m.name, perms: expandPerms(m.perms) } : null;'),
 ('''    const who = await whoIs(request, env);
    if (!who) return json({ error: "Wrong or missing code" }, 401);
    const hub = env.HUB.get(env.HUB.idFromName("main"));
''', '''    const hub = env.HUB.get(env.HUB.idFromName("main"));
    // too many wrong codes from this address: locked for a while (stops code guessing)
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const lock = await hub.lockedFor(ip);
    if (lock) return json({ error: `Too many wrong codes. Try again in ${Math.ceil(lock / 60)} min.`, locked: true }, 429);
    const who = await whoIs(request, env);
    if (!who) {
      if (codeOf(request)) await hub.failed(ip);   // only real wrong guesses count
      return json({ error: "Wrong or missing code" }, 401);
    }
'''),
 ('''async function whoIs(request, env) {
  const url = new URL(request.url);
  const auth = request.headers.get("authorization") || "";
  const code = (auth.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("key") || "").trim();
''', '''function codeOf(request) {
  const auth = request.headers.get("authorization") || "";
  return (auth.startsWith("Bearer ") ? auth.slice(7) : new URL(request.url).searchParams.get("key") || "").trim();
}
async function whoIs(request, env) {
  const code = codeOf(request);
'''),
 ('''      fwd.headers.set("x-name", who.name);''', '''      fwd.headers.set("x-name", who.name);
      fwd.headers.set("x-id", who.id || "");'''),
 # kick sockets of mods that were removed, turned off or given a new code
 ('''        await env.PLAN.put(MODS_KEY, JSON.stringify(next));
''', '''        await env.PLAN.put(MODS_KEY, JSON.stringify(next));
        const gone = old.filter(o => { const n = next.find(x => x.id === o.id); return !n || n.active === false || n.hash !== o.hash; }).map(o => o.id);
        if (gone.length) await hub.kick(gone);
'''),
 ('''    server.serializeAttachment({ role, name, perms: JSON.parse(request.headers.get("x-perms") || "[]") });''',
  '''    server.serializeAttachment({ role, name, id: request.headers.get("x-id") || "", perms: JSON.parse(request.headers.get("x-perms") || "[]") });'''),
 ('''  async webSocketClose(ws, code, reason) {''', '''  // Mods turned off, removed or re-coded: tell their app, then hang up (4001 = don't reconnect)
  async kick(ids) {
    for (const ws of this.ctx.getWebSockets("mod")) {
      const a = ws.deserializeAttachment() || {};
      if (a.id && ids.includes(a.id)) { try { ws.send(JSON.stringify({ type: "revoked" })); ws.close(4001, "revoked"); } catch {} }
    }
  }
  // Wrong-code lockout: 10 wrong codes within 15 minutes from one address locks it for 15 minutes
  async lockedFor(ip) {
    const f = await this.ctx.storage.get("fail:" + ip);
    return f && f.until && f.until > Date.now() ? Math.round((f.until - Date.now()) / 1000) : 0;
  }
  async failed(ip) {
    const k = "fail:" + ip, now = Date.now(), WINDOW = 15 * 60 * 1000, MAX = 10;
    let f = await this.ctx.storage.get(k);
    if (!f || now - f.first > WINDOW) f = { n: 0, first: now };
    f.n++;
    if (f.n >= MAX) f.until = now + WINDOW;
    await this.ctx.storage.put(k, f);
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(now + 60 * 60 * 1000);
  }
  // hourly clean-up of old wrong-code records
  async alarm() {
    const now = Date.now(), all = await this.ctx.storage.list({ prefix: "fail:" });
    const old = [...all].filter(([, f]) => now - f.first > 30 * 60 * 1000 && !(f.until > now)).map(([k]) => k);
    if (old.length) await this.ctx.storage.delete(old);
    if (all.size > old.length) await this.ctx.storage.setAlarm(now + 60 * 60 * 1000);
  }
  async webSocketClose(ws, code, reason) {'''),
])

# stronger codes in the owner dashboard: 3 words + 4 digits (about 500 million combinations)
A = r"C:\StreamerBot\ctpg-planner\public\admin.html"
patch(A, [
 ('''const newCode = () => { const w = ["TEACUP", "MONORAIL", "CASTLE", "SKYLINER", "DUMBO", "FIGMENT", "GOOFY", "PLUTO", "EPCOT", "TIKI", "ORBIT", "PIXAR"]; const b = new Uint32Array(2); crypto.getRandomValues(b); return w[b[0] % w.length] + "-" + (1000 + (b[1] % 9000)); };''',
  '''const WORDS = ["TEACUP", "MONORAIL", "CASTLE", "SKYLINER", "DUMBO", "FIGMENT", "GOOFY", "PLUTO", "EPCOT", "TIKI", "ORBIT", "PIXAR", "CHURRO", "LANTERN", "PARADE", "COMET",
  "GALAXY", "HARBOR", "JUNGLE", "KETTLE", "LAGOON", "MAGNET", "NEBULA", "OCEAN", "PEBBLE", "QUILL", "ROCKET", "SAILOR", "TROLLEY", "UNICORN", "VOYAGE", "WAFFLE",
  "YONDER", "ZEPHYR", "ANCHOR", "BALLOON", "CANYON", "DRAGON", "EMBER", "FALCON", "GLACIER", "HOPPER", "ISLAND", "JASPER", "KAZOO", "LOCKET", "MARBLE", "NUTMEG",
  "OTTER", "PEPPER", "RIPPLE", "SPROCKET", "TOUCAN", "VELVET", "WHISTLE", "BISCUIT", "CRICKET", "DOODLE", "GADGET", "PRETZEL", "SPARKLER", "TWISTER", "WIDGET", "ZIPLINE"];
// 3 random words + 4 digits: about 2 billion possible codes (and 10 wrong tries locks the guesser out)
const newCode = () => { const b = new Uint32Array(4); crypto.getRandomValues(b); return [0, 1, 2].map(i => WORDS[b[i] % WORDS.length]).join("-") + "-" + (1000 + (b[3] % 9000)); };'''),
])

# app: if a mod is revoked, sign out at once and don't keep reconnecting; show the lockout message at sign-in
P = r"C:\StreamerBot\ctpg-planner\src\api.js"
patch(P, [
 ('''  if (r.status === 401) { const e = new Error("Wrong passcode"); e.auth = true; throw e; }''',
  '''  if (r.status === 401) { const e = new Error("Wrong passcode"); e.auth = true; throw e; }
  if (r.status === 429) { const j = await r.json().catch(() => ({})); const e = new Error(j.error || "Too many wrong codes. Try again later."); e.locked = true; throw e; }'''),
 ('''    ws.onclose = () => { clearInterval(ping); if (!stop) {''', '''    ws.onclose = e => { clearInterval(ping); if (e && e.code === 4001) { setCode(""); location.reload(); return; } if (!stop) {'''),
])
X = r"C:\StreamerBot\ctpg-planner\src\App.jsx"
patch(X, [
 ('''catch (x) { setCode(""); setErr(x.auth ? "That passcode didn't work." : x.message || "Couldn't reach the server. Check your signal."); }''',
  '''catch (x) { setCode(""); setErr(x.auth ? "That passcode didn't work." : x.locked ? x.message : x.message || "Couldn't reach the server. Check your signal."); }'''),
])
print("patched")
