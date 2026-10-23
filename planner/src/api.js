// Talks to the Park Day Worker. Saves are queued on the phone and retried when signal is bad.
const KEY = "parkday-code";
export const getCode = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
export const setCode = c => { try { c ? localStorage.setItem(KEY, c) : localStorage.removeItem(KEY); } catch {} };

async function call(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { "content-type": "application/json", authorization: "Bearer " + getCode(), ...(opts.headers || {}) } });
  if (r.status === 401) { const e = new Error("Wrong passcode"); e.auth = true; throw e; }
  if (r.status === 429) { const j = await r.json().catch(() => ({})); const e = new Error(j.error || "Too many wrong codes. Try again later."); e.locked = true; throw e; }
  if (r.status === 403) { const j = await r.json().catch(() => ({})); const e = new Error(j.error || "Not allowed"); e.forbidden = true; throw e; }
  if (!r.ok) throw new Error("Server said " + r.status);
  return r.json();
}
export const whoami = () => call("/api/whoami");
export const fetchState = () => call("/api/state");
export const saveState = s => call("/api/state", { method: "PUT", body: JSON.stringify(s) });

// Send a command to the home PC (e.g. { action: "scene.live" }). Never throws: returns { ok, error? }.
export async function sendCmd(action, extra = {}) {
  try {
    const r = await fetch("/api/cmd", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + getCode() }, body: JSON.stringify({ action, ...extra }) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, ...j } : { ok: false, error: j.error || "Server said " + r.status };
  } catch (e) { return { ok: false, error: "No signal" }; }
}
// Location test mode (owner only): on/off, and GPS from this phone's browser while it is on. Never throw.
export async function setLocTest(on) {
  try { const r = await fetch("/api/location/testmode", { method: "PUT", headers: { "content-type": "application/json", authorization: "Bearer " + getCode() }, body: JSON.stringify({ on }) }); const j = await r.json().catch(() => ({})); return r.ok ? { ok: true } : { ok: false, error: j.error || "Server said " + r.status }; }
  catch { return { ok: false, error: "No signal" }; }
}
// Location settings (owner only), e.g. { map: true, mapColor: "#FFC933" }. Never throws.
export async function setLocConfig(o) {
  try { const r = await fetch("/api/location/config", { method: "PUT", headers: { "content-type": "application/json", authorization: "Bearer " + getCode() }, body: JSON.stringify(o) }); const j = await r.json().catch(() => ({})); return r.ok ? { ok: true } : { ok: false, error: j.error || "Server said " + r.status }; }
  catch { return { ok: false, error: "No signal" }; }
}
export async function setLocParty(mode) {
  try { const r = await fetch("/api/location/party", { method: "PUT", headers: { "content-type": "application/json", authorization: "Bearer " + getCode() }, body: JSON.stringify({ mode }) }); const j = await r.json().catch(() => ({})); return r.ok && !j.error ? { ok: true } : { ok: false, error: j.error || "Server said " + r.status }; }
  catch { return { ok: false, error: "No signal" }; }
}
export async function sendPhoneFix(body) {
  try { const r = await fetch("/api/location/phone", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + getCode() }, body: JSON.stringify(body) }); if (r.ok) return { ok: true }; const j = await r.json().catch(() => ({})); return { ok: false, error: j.error || "Server said " + r.status, off: r.status === 409 }; }
  catch { return { ok: false, error: "No signal" }; }
}
// Moderators (owner only)
export const getMods = () => call("/api/mods");
export const putMods = list => call("/api/mods", { method: "PUT", body: JSON.stringify(list) });
// Live link: plan changes from mods / other phones, and the home PC's scene status. Reconnects by itself.
export function liveLink(onMsg) {
  let ws, stop = false, wait = 2000, timer, ping;
  const open = () => {
    if (stop) return;
    try { ws = new WebSocket(location.origin.replace(/^http/, "ws") + "/api/ws?key=" + encodeURIComponent(getCode())); } catch { timer = setTimeout(open, wait); return; }
    ws.onopen = () => { wait = 2000; clearInterval(ping); ping = setInterval(() => { try { ws.send("ping"); } catch {} }, 25000); };
    ws.onmessage = e => { if (e.data === "pong") return; let m; try { m = JSON.parse(e.data); } catch { return; } if (m && m.type === "revoked") { stop = true; setCode(""); try { ws.close(); } catch {} location.reload(); return; } try { onMsg(m); } catch {} };
    ws.onclose = e => { clearInterval(ping); if (e && e.code === 4001) { setCode(""); location.reload(); return; } if (!stop) { timer = setTimeout(open, wait); wait = Math.min(wait * 2, 30000); } };
    ws.onerror = () => { try { ws.close(); } catch {} };
  };
  open();
  return () => { stop = true; clearTimeout(timer); clearInterval(ping); try { ws.close(); } catch {} };
}
