// CTPG Park Day Worker
// Routes:
//   GET  /api/state            read the day plan + what's on stream   (owner, mod, overlay)
//   PUT  /api/state            save it                                  (owner, mod)
//   GET  /api/mods             list mods                                (owner)
//   PUT  /api/mods             replace mod list                         (owner)
//   POST /api/cmd              send a command to Streamer.bot at home   (owner, mod)
//   GET  /api/ws               live WebSocket: app, mod view, overlay, Streamer.bot
// Everything else is the React app (served from ./dist); /mod is the mod view.
//
// Auth: send "Authorization: Bearer <code>" (or ?key= for WebSockets and the OBS overlay).
//   OWNER_PASS  = Cierra's passcode (secret)
//   ADMIN_PASS  = owner dashboard login (/admin): manages mods and roles only (secret)
//   OVERLAY_KEY = read-only key used by the OBS overlay (secret)
//   BOT_KEY     = key Streamer.bot uses to connect (secret)
//   mod codes   = stored hashed in R2 (mods.json), managed from the app

import { DurableObject } from "cloudflare:workers";
import { PERMS, ROLES, PERM_KEYS, expandPerms, missingPerm } from "../src/perms.js";

const STATE_KEY = "state.json";
const MODS_KEY = "mods.json";
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" } });

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function readJSON(env, key, fallback) {
  const obj = await env.PLAN.get(key);
  if (!obj) return fallback;
  try { return await obj.json(); } catch { return fallback; }
}

// Who is calling? -> { role: "owner" | "mod" | "overlay" | "bot", name, perms }
function codeOf(request) {
  const auth = request.headers.get("authorization") || "";
  return (auth.startsWith("Bearer ") ? auth.slice(7) : new URL(request.url).searchParams.get("key") || "").trim();
}
async function whoIs(request, env) {
  const code = codeOf(request);
  if (!code) return null;
  if (env.OWNER_PASS && safeEqual(code, env.OWNER_PASS)) return { role: "owner", name: "Cierra", perms: ["*"] };
  if (env.ADMIN_PASS && safeEqual(code, env.ADMIN_PASS)) return { role: "admin", name: "Owner dashboard", perms: [] };
  if (env.BOT_KEY && safeEqual(code, env.BOT_KEY)) return { role: "bot", name: "Streamer.bot", perms: [] };
  if (env.OVERLAY_KEY && safeEqual(code, env.OVERLAY_KEY)) return { role: "overlay", name: "OBS overlay", perms: [] };
  const mods = await readJSON(env, MODS_KEY, []);
  const h = await sha256(code);
  const m = mods.find(x => x.active !== false && safeEqual(x.hash, h));
  return m ? { role: "mod", id: m.id, name: m.name, perms: expandPerms(m.perms) } : null;
}
const can = (who, perm) => who && (who.perms.includes("*") || who.perms.includes(perm));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    // the permission list for the owner dashboard (no secrets in it)
    if (url.pathname === "/api/perms") return json({ perms: PERMS, roles: ROLES });

    const hub = env.HUB.get(env.HUB.idFromName("main"));
    // too many wrong codes from this address: locked for a while (stops code guessing)
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const lock = await hub.lockedFor(ip);
    if (lock) return json({ error: `Too many wrong codes. Try again in ${Math.ceil(lock / 60)} min.`, locked: true }, 429);
    const who = await whoIs(request, env);
    if (!who) {
      if (codeOf(request)) await hub.failed(ip);   // only real wrong guesses count
      return json({ error: "Wrong or missing code" }, 401);
    }

    if (url.pathname === "/api/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return json({ error: "Expected WebSocket" }, 426);
      const fwd = new Request(request);
      fwd.headers.set("x-role", who.role);
      fwd.headers.set("x-name", who.name);
      fwd.headers.set("x-id", who.id || "");
      fwd.headers.set("x-perms", JSON.stringify(who.perms));
      return hub.fetch(fwd);
    }

    if (url.pathname === "/api/whoami") return json({ role: who.role, name: who.name, perms: who.perms });

    if (url.pathname === "/api/state") {
      if (request.method === "GET") return json(await readJSON(env, STATE_KEY, {}));
      if (request.method === "PUT") {
        if (!(who.role === "owner" || (who.role === "mod" && who.perms.some(k => k !== "scene")))) return json({ error: "Not allowed" }, 403);
        let body;
        try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
        if (JSON.stringify(body).length > 200000) return json({ error: "Too big" }, 413);
        if (who.role !== "owner") {
          // mods: only the parts their permissions cover may change
          const cur = await readJSON(env, STATE_KEY, {});
          const miss = missingPerm(who.perms, cur, body);
          if (miss) return json({ error: `Not allowed: ${miss}`, missing: miss }, 403);
        }
        body.updated = Date.now();
        body.updatedBy = who.name;
        await env.PLAN.put(STATE_KEY, JSON.stringify(body), { httpMetadata: { contentType: "application/json" } });
        await hub.broadcastState(body);
        return json({ ok: true, updated: body.updated });
      }
    }

    if (url.pathname === "/api/mods") {
      if (who.role !== "owner" && who.role !== "admin") return json({ error: "Only the owner dashboard can manage mods" }, 403);
      if (request.method === "GET") {
        const mods = await readJSON(env, MODS_KEY, []);
        return json(mods.map(({ hash, ...m }) => m));
      }
      if (request.method === "PUT") {
        // body: [{ id, name, perms, active, code? }]  code only when set or changed
        let list;
        try { list = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
        const old = await readJSON(env, MODS_KEY, []);
        const next = [];
        for (const m of list.slice(0, 25)) {
          const prev = old.find(o => o.id === m.id);
          const hash = m.code ? await sha256(String(m.code).trim()) : prev && prev.hash;
          if (!hash) continue;
          next.push({ id: m.id, name: String(m.name || "Mod").slice(0, 40), role: String(m.role || "custom").slice(0, 20), perms: Array.isArray(m.perms) ? expandPerms(m.perms).filter(x => PERM_KEYS.includes(x)) : [], active: m.active !== false, hash });
        }
        await env.PLAN.put(MODS_KEY, JSON.stringify(next));
        const gone = old.filter(o => { const n = next.find(x => x.id === o.id); return !n || n.active === false || n.hash !== o.hash; }).map(o => o.id);
        if (gone.length) await hub.kick(gone);
        return json(next.map(({ hash, ...m }) => m));
      }
    }

    if (url.pathname === "/api/cmd" && request.method === "POST") {
      let cmd;
      try { cmd = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
      const perm = String(cmd.perm || cmd.action || "").split(".")[0];
      if (!(who.role === "owner" || can(who, perm))) return json({ error: "Not allowed" }, 403);
      const res = await hub.sendToBot({ ...cmd, by: who.name, role: who.role, at: Date.now() });
      return json(res, res.ok ? 200 : 503);
    }

    return json({ error: "Not found" }, 404);
  },
};

// One live hub: keeps WebSockets to the phone app, mod views, the OBS overlay and Streamer.bot.
// Uses the hibernation API so idle connections cost nothing.
export class LiveHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  async fetch(request) {
    const role = request.headers.get("x-role") || "overlay";
    const name = request.headers.get("x-name") || "";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role, name, id: request.headers.get("x-id") || "", perms: JSON.parse(request.headers.get("x-perms") || "[]") });
    // Send the latest known stream status right away
    const status = await this.ctx.storage.get("botStatus");
    if (status) server.send(JSON.stringify({ type: "status", ...status }));
    return new Response(null, { status: 101, webSocket: client });
  }
  async broadcastState(state) {
    const msg = JSON.stringify({ type: "state", state });
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(msg); } catch {} }
  }
  async sendToBot(cmd) {
    const bots = this.ctx.getWebSockets("bot");
    if (!bots.length) return { ok: false, error: "Streamer.bot is not connected (is the home PC on?)" };
    const msg = JSON.stringify({ type: "cmd", ...cmd });
    for (const ws of bots) { try { ws.send(msg); } catch {} }
    return { ok: true, sent: true };
  }
  async webSocketMessage(ws, message) {
    const who = ws.deserializeAttachment() || {};
    let data;
    try { data = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)); } catch { return; }
    if (who.role === "bot" && (data.type === "status" || data.type === "result")) {
      // Streamer.bot reports scene / live / overlay visibility, or the result of a command
      if (data.type === "status") await this.ctx.storage.put("botStatus", { ...data, at: Date.now() });
      const out = JSON.stringify({ ...data, at: Date.now() });
      for (const s of this.ctx.getWebSockets()) { const r = (s.deserializeAttachment() || {}).role; if (r === "owner" || r === "mod") { try { s.send(out); } catch {} } }
    }
  }
  // Mods turned off, removed or re-coded: tell their app, then hang up (4001 = don't reconnect)
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
  async webSocketClose(ws, code, reason) { try { ws.close(code, reason); } catch {} }
}
