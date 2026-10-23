// CTPG Park Day Worker
// Routes:
//   GET  /api/state            read the day plan + what's on stream   (owner, mod, overlay)
//   PUT  /api/state            save it                                  (owner, mod)
//   GET  /api/mods             list mods                                (owner)
//   PUT  /api/mods             replace mod list                         (owner)
//   POST /api/cmd              send a command to the home PC            (owner, mod with that ability)
//   GET  /api/log              activity log: who pressed what, last 30 days (owner, owner dashboard)
//   POST /api/gps/push|stop    GPS from Moblin's RealtimeIRL sender (?key=GPS key; used while OBS is streaming or the Location scene is on air)
//   GET  /api/location         location status (owner, owner dashboard, mods with "See location"); /config /key /park /test (owner)
//   GET  /api/ws               live WebSocket: app, mod view, overlay, and the home PC ("bot": the OBS bridge dock)
// Everything else is the React app (served from ./dist); /mod is the mod view.
//
// Auth: send "Authorization: Bearer <code>" (or ?key= for WebSockets and the OBS overlay).
//   OWNER_PASS  = Cierra's passcode (secret)
//   ADMIN_PASS  = owner dashboard login (/admin): manages mods and roles only (secret)
//   OVERLAY_KEY = read-only key used by the OBS overlay (secret)
//   BOT_KEY     = key the home PC (the OBS bridge dock) uses to connect (secret)
//   mod codes   = stored hashed in R2 (mods.json), managed from the app

import { DurableObject } from "cloudflare:workers";
import { PERMS, ROLES, PERM_KEYS, STREAM_KEYS, expandPerms, missingPerm } from "../src/perms.js";
import { LOG_DAYS, describeChange, describeMods, cmdWords, maskIp } from "./activity.js";
import { LOC_DEFAULTS, cleanConfig, parkModel, freshState, step, parseFix, RATE_MS, partyNight } from "./location.js";
import { WDW_PLACES, RESORT } from "./places.js";
import { RIDE_SHAPES, RIDE_MARGIN, RIDE_OMIT, RIDE_PARTY } from "./rides.js";
import { PARK_EXTRAS, EXTRA_SHAPES, TRANSPORT_PLACES, TRANSPORT_LINES, PARK_BOUNDS as PARK_ONLY_BOUNDS } from "./extras.js";
import { SPLIT_SHAPES, SPLIT_DROP } from "./split.js";
import { PARK_LANDS, SPOT_MOVES, LAND_AREAS, PARK_FIXES, applyFixes } from "./lands.js";
const BUILTIN_SHAPES = (() => { const o = { ...RIDE_SHAPES, ...EXTRA_SHAPES, ...SPLIT_SHAPES }; for (const id of SPLIT_DROP) delete o[id]; return o; })();
import { DISTRICTS, DISTRICT_SPOTS, DISTRICT_SHAPES, DISTRICT_BOUNDS, DISTRICT_PLACES } from "./districts.js";
// park edges plus the shopping districts' edges (Disney Springs, Downtown Disney, CityWalk): inside one = that park or district
const PARK_BOUNDS = { ...PARK_ONLY_BOUNDS, ...DISTRICT_BOUNDS };
// places outside the parks (hotels, stations, docks, CityWalk), each with a stable id so the owner can adjust them
const placeSlug = n => "pl-" + String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
const PLACES = [...WDW_PLACES.map(p => ({ id: placeSlug(p.n), r: RESORT, ...p })), ...TRANSPORT_PLACES, ...DISTRICT_PLACES.filter(h => !WDW_PLACES.some(p => p.n === h.n))];
// the owner's edits outside the parks are stored like a park under these ids (never a park themselves)
const RESORT_IDS = { "resort-wdw": "Walt Disney World Resort", "resort-uo": "Universal Orlando Resort", "resort-dlr": "Disneyland Resort" };
const OUT_KINDS = { O: "hotel", T: "train", B: "boat", U: "bus", P: "area" };
// land outlines (lands.js) matched to her own section names; names she doesn't use are left out
const normLand = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const landAreas = p => { const mine = new Map((p.lands || []).map(l => [normLand(l), l])); return (LAND_AREAS[p.id] || []).filter(a => mine.has(normLand(a.n))).map(a => ({ land: mine.get(normLand(a.n)), p: a.p })); };
const modelOf = p => ({ ...parkModel(p, PARK_EXTRAS[p.id]), areas: landAreas(p) });
const parkModels = parks => [...parks.values()].filter(p => !RESORT_IDS[p.id]).map(modelOf);
const PARTY_IDS = new Set(RIDE_PARTY);

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
  if (env.BOT_KEY && safeEqual(code, env.BOT_KEY)) return { role: "bot", name: "Home PC", perms: [] };
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
    const ip = request.headers.get("cf-connecting-ip") || "unknown";

    // GPS from Moblin (RealtimeIRL format). Its own key, which can only post a location.
    // Moblin sends whenever you are live; ignored updates (Location off, OBS not streaming) are answered from a 10 s cached note.
    if (url.pathname === "/api/gps/push" || url.pathname === "/api/gps/stop") {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      const key = url.searchParams.get("key") || "";
      if (!key || key.length > 200) return json({ error: "Missing key" }, 401);
      const push = url.pathname.endsWith("/push");
      const gate = new Request(url.origin + "/__gps_gate");
      if (push) { try { if (await caches.default.match(gate)) return new Response(null, { status: 204 }); } catch {} }
      let body = null;
      if (push) {
        const text = await request.text();
        if (text.length > 2000) return json({ error: "Too big" }, 413);
        try { body = JSON.parse(text); } catch { return json({ error: "Bad JSON" }, 400); }
      }
      const res = await hub.gps(push ? "push" : "stop", await sha256(key), body);
      if (res.gated) { try { await caches.default.put(gate, new Response("off", { headers: { "cache-control": "public, max-age=10" } })); } catch {} }
      return res.status === 204 ? new Response(null, { status: 204 }) : json({ error: res.error || "" }, res.status);
    }

    // too many wrong codes from this address: locked for a while (stops code guessing)
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
        if (!(who.role === "owner" || (who.role === "mod" && who.perms.some(k => !STREAM_KEYS.includes(k))))) return json({ error: "Not allowed" }, 403);
        let body;
        try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
        if (JSON.stringify(body).length > 200000) return json({ error: "Too big" }, 413);
        const cur = await readJSON(env, STATE_KEY, {});
        if (who.role !== "owner") {
          // mods: only the parts their permissions cover may change
          const miss = missingPerm(who.perms, cur, body);
          if (miss) {
            await hub.log([{ who: who.name, role: who.role, kind: "denied", what: `Tried: ${miss} (not allowed)`, ok: 0 }]);
            return json({ error: `Not allowed: ${miss}`, missing: miss }, 403);
          }
        }
        body.updated = Date.now();
        body.updatedBy = who.name;
        await env.PLAN.put(STATE_KEY, JSON.stringify(body), { httpMetadata: { contentType: "application/json" } });
        // one log line per thing that changed; live wait-time refreshes change nothing here and are not logged
        await hub.broadcastState(body, describeChange(cur, body).map(what => ({ who: who.name, role: who.role, kind: "edit", what, ok: 1 })));
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
        const changes = describeMods(old, next);
        if (changes.length) await hub.log(changes.map(what => ({ who: who.name, role: who.role, kind: "mods", what, ok: 1 })));
        const gone = old.filter(o => { const n = next.find(x => x.id === o.id); return !n || n.active === false || n.hash !== o.hash; }).map(o => o.id);
        if (gone.length) await hub.kick(gone);
        return json(next.map(({ hash, ...m }) => m));
      }
    }

    if (url.pathname === "/api/cmd" && request.method === "POST") {
      let cmd;
      try { cmd = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
      const perm = String(cmd.perm || cmd.action || "").split(".")[0];
      if (!(who.role === "owner" || can(who, perm))) {
        await hub.log([{ who: who.name, role: who.role, kind: "denied", what: `Tried: ${cmdWords(String(cmd.action || ""))} (not allowed)`, ok: 0 }]);
        return json({ error: "Not allowed" }, 403);
      }
      // byId lets a private answer (a snapshot) come back to the person who asked, and nobody else
      const res = await hub.sendToBot({ action: String(cmd.action || "").slice(0, 40), by: who.name, byId: who.id || who.role, role: who.role, at: Date.now() });
      return json(res, res.ok ? 200 : 503);
    }

    if (url.pathname === "/api/location" || url.pathname.startsWith("/api/location/")) {
      const owner = who.role === "owner" || who.role === "admin";
      const sub = url.pathname.slice("/api/location".length);
      if (sub === "" && request.method === "GET") {
        if (!owner && !can(who, "loc")) return json({ error: "Not allowed" }, 403);
        return json(await hub.locInfo(owner));
      }
      // read-only copy of every park's saved data (outlines, lands, own spots) for the backup on the home PC; no keys in it
      if (sub === "/export" && request.method === "GET") {
        if (!owner && who.role !== "bot") return json({ error: "Not allowed" }, 403);
        return json(await hub.locExport());
      }
      if (!owner) return json({ error: "Only the owner can change location settings" }, 403);
      const readBody = async max => { const t = await request.text(); if (t.length > max) throw Object.assign(new Error("Too big"), { code: 413 }); return JSON.parse(t || "{}"); };
      try {
        if (sub === "/config" && request.method === "PUT") {
          const r = await hub.locSetConfig(await readBody(4000), who.name);
          try { await caches.default.delete(new Request(url.origin + "/__gps_gate")); } catch {}
          return json(r);
        }
        if (sub === "/key" && request.method === "POST") return json(await hub.locNewKey(who.name));
        const id = String(url.searchParams.get("id") || "").slice(0, 60);
        if (sub === "/park" && request.method === "GET") return json(await hub.locGetPark(id));
        if (sub === "/shapes" && request.method === "GET") return json({ shapes: { ...BUILTIN_SHAPES, ...DISTRICT_SHAPES, ...Object.fromEntries(PLACES.map(p => [p.id, p.p])) }, districts: DISTRICTS.map(d => d.id), omit: RIDE_OMIT, margin: RIDE_MARGIN, landAreas: LAND_AREAS, extras: PARK_EXTRAS,
          places: PLACES.map(p => ({ id: p.id, n: p.n, k: p.k, r: p.r, lat: p.c[0], lon: p.c[1] })), lines: TRANSPORT_LINES, resorts: RESORT_IDS });
        if (sub === "/park" && request.method === "PUT") { const r = await hub.locPutPark(id, await readBody(900000), who.name); return json(r, r.conflict ? 409 : r.error ? 400 : 200); }
        if (sub === "/park" && request.method === "DELETE") return json(await hub.locDeletePark(id, who.name));
        if (sub === "/history" && request.method === "GET") return json(await hub.locHistory(id));
        if (sub === "/restore" && request.method === "POST") { const r = await hub.locRestore(id, String(url.searchParams.get("v") || ""), who.name); return json(r, r.error ? 400 : 200); }
        if (sub === "/test" && request.method === "POST") return json(await hub.locTest(await readBody(2000)));
        if (sub === "/__drop" && request.method === "POST" && env.TEST_HOOKS === "1") return json(await hub.dropMemory());
        if (sub === "/testmode" && request.method === "PUT") {
          const r = await hub.locSetTest((await readBody(200)).on === true, who.name);
          try { await caches.default.delete(new Request(url.origin + "/__gps_gate")); } catch {}
          return json(r);
        }
        if (sub === "/party" && request.method === "PUT") return json(await hub.locSetParty(String((await readBody(200)).mode || "auto"), who.name));
        if (sub === "/phone" && request.method === "POST") { const r = await hub.locPhone(await readBody(2000), who.name); return r.status === 204 ? new Response(null, { status: 204 }) : json({ error: r.error || "" }, r.status); }
      } catch (e) { return json({ error: e.code === 413 ? "Too big" : "Bad request" }, e.code === 413 ? 413 : 400); }
      return json({ error: "Not found" }, 404);
    }

    if (url.pathname === "/api/log" && request.method === "GET") {
      if (who.role !== "owner" && who.role !== "admin") return json({ error: "Only the owner can see the activity log" }, 403);
      const days = Math.max(1, Math.min(LOG_DAYS, Number(url.searchParams.get("days")) || 7));
      return json(await hub.readLog(Date.now() - days * 864e5));
    }

    return json({ error: "Not found" }, 404);
  },
};

// Who may see the home PC's stream status: the owner, and mods with "See stream status" or the LIVE button.
// Who may see the private location check view (exact position, distances): owner, dashboard, mods with "See location".
const seesLoc = a => a.role === "owner" || a.role === "admin" || (a.role === "mod" && (a.perms || []).some(p => p === "*" || p === "loc"));
const seesStatus = a => a.role === "owner" || (a.role === "mod" && (a.perms || []).some(p => p === "*" || p === "status" || p === "scene"));

// One live hub: keeps WebSockets to the phone app, mod views, the OBS overlay and the home PC (the OBS bridge dock).
// Uses the hibernation API so idle connections cost nothing.
export class LiveHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    // activity log (who pressed what). One row per action, removed after LOG_DAYS.
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, who TEXT, role TEXT, kind TEXT, what TEXT, ok INTEGER)");
    this.ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS log_at ON log(at)");
  }
  async log(entries) {
    if (!entries || !entries.length) return;
    const now = Date.now();
    for (const e of entries.slice(0, 20)) {
      this.ctx.storage.sql.exec("INSERT INTO log (at, who, role, kind, what, ok) VALUES (?, ?, ?, ?, ?, ?)",
        now, String(e.who || "?").slice(0, 60), String(e.role || "").slice(0, 20), String(e.kind || "").slice(0, 20), String(e.what || "").slice(0, 300), e.ok == null ? null : e.ok ? 1 : 0);
    }
    // forget anything older than LOG_DAYS (at most once an hour)
    if (!this.pruned || now - this.pruned > 3600e3) { this.pruned = now; this.ctx.storage.sql.exec("DELETE FROM log WHERE at < ?", now - LOG_DAYS * 864e5); }
  }
  async readLog(since) {
    return this.ctx.storage.sql.exec("SELECT at, who, role, kind, what, ok FROM log WHERE at >= ? ORDER BY id DESC LIMIT 3000", since).toArray();
  }
  async fetch(request) {
    const role = request.headers.get("x-role") || "overlay";
    const name = request.headers.get("x-name") || "";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [role]);
    const att = { role, name, id: request.headers.get("x-id") || "", perms: JSON.parse(request.headers.get("x-perms") || "[]") };
    server.serializeAttachment(att);
    // Send the latest known stream status right away (only to those allowed to see it)
    const status = seesStatus(att) ? await this.ctx.storage.get("botStatus") : null;
    if (status) server.send(JSON.stringify({ type: "status", ...status }));
    // the Location scene's current text (names only), and the check view for those allowed
    try {
      const L = await this.locLoad();
      const m = this.locMsgs(L);
      if (L.cfg.enabled || this.locTesting(L)) server.send(m.pub);
      if (seesLoc(att)) server.send(m.priv);
      if (att.role === "overlay" || seesLoc(att)) server.send(m.map);
    } catch {}
    return new Response(null, { status: 101, webSocket: client });
  }
  async broadcastState(state, entries) {
    await this.log(entries);
    // names in today's plan: preferred when the Location scene picks a nearby ride
    try {
      const names = [...new Set((state.plan || []).filter(p => !p.done && p.name).map(p => String(p.name).slice(0, 120)))].slice(0, 300);
      const L = await this.locLoad();
      if (JSON.stringify(names) !== JSON.stringify([...L.plan])) { L.plan = new Set(names); await this.ctx.storage.put("loc:plan", names); }
    } catch {}
    const msg = JSON.stringify({ type: "state", state });
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(msg); } catch {} }
  }
  async sendToBot(cmd) {
    const bots = this.ctx.getWebSockets("bot");
    if (!bots.length) {
      await this.log([{ who: cmd.by, role: cmd.role, kind: "cmd", what: `${cmdWords(cmd.action)}: home PC not connected`, ok: 0 }]);
      return { ok: false, error: "The home PC is not connected (is OBS open?)" };
    }
    await this.log([{ who: cmd.by, role: cmd.role, kind: "cmd", what: `Pressed ${cmdWords(cmd.action)}`, ok: null }]);
    const msg = JSON.stringify({ type: "cmd", ...cmd });
    for (const ws of bots) { try { ws.send(msg); } catch {} }
    return { ok: true, sent: true };
  }
  async webSocketMessage(ws, message) {
    const who = ws.deserializeAttachment() || {};
    if (who.role !== "bot") return;
    let data;
    try { data = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)); } catch { return; }
    if (!data || (data.type !== "status" && data.type !== "result")) return;
    const text = typeof message === "string" ? message : "";
    if (text.length > 400000) return;   // a snapshot is tens of kB; anything huge is dropped
    const now = Date.now();
    if (data.type === "status") {
      // the home PC reports scene / live / mic. Kept so a phone that opens later sees it at once.
      const mic = data.mic && typeof data.mic === "object" ? { name: String(data.mic.name || "").slice(0, 80), muted: !!data.mic.muted } : null;
      const status = { scene: String(data.scene || "").slice(0, 80), vertical: String(data.vertical || "").slice(0, 80), streaming: data.streaming === true ? true : data.streaming === false ? false : null, mic, ...(data.error ? { error: String(data.error).slice(0, 120) } : {}), at: now };
      // log what changed on stream (scene, live or not, mic), not the 30-second heartbeats
      const prev = (await this.ctx.storage.get("botStatus")) || {};
      const seen = [];
      if (status.scene && status.scene !== prev.scene) seen.push(`OBS scene: ${status.scene}`);
      if (status.streaming !== null && prev.streaming != null && status.streaming !== prev.streaming) seen.push(status.streaming ? "Stream went live" : "Stream stopped");
      if (status.mic && prev.mic && status.mic.muted !== prev.mic.muted) seen.push(`Mic ${status.mic.muted ? "muted" : "on"}`);
      await this.log(seen.map(what => ({ who: "OBS (home PC)", role: "bot", kind: "obs", what, ok: 1 })));
      await this.ctx.storage.put("botStatus", status);
      await this.locStatusChanged(status);
      const out = JSON.stringify({ type: "status", ...status });
      for (const s of this.ctx.getWebSockets()) { if (seesStatus(s.deserializeAttachment() || {})) { try { s.send(out); } catch {} } }
      return;
    }
    // the result of a command
    const act = String(data.action || "").slice(0, 40);
    await this.log([{ who: String(data.by || "?").slice(0, 60), role: "", kind: "result", what: `${cmdWords(act)}: ${data.ok ? "done" + (data.scene ? " (" + String(data.scene).slice(0, 60) + ")" : "") : "failed, " + String(data.error || "no reason given").slice(0, 120)}`, ok: data.ok ? 1 : 0 }]);
    const out = JSON.stringify({ ...data, at: now });
    const priv = String(data.action || "").startsWith("snap");   // a snapshot goes back only to whoever asked for it
    for (const s of this.ctx.getWebSockets()) {
      const a = s.deserializeAttachment() || {};
      if (a.role !== "owner" && a.role !== "mod") continue;
      if (priv && !((a.role === "owner" && data.byId === "owner") || (a.id && a.id === data.byId))) continue;
      try { s.send(out); } catch {}
    }
  }
  // ---- Location (GPS from Moblin) -----------------------------------------------------------------
  // Everything lives in this object's storage: loc:cfg, loc:key (hash), loc:state (latest fix only), loc:plan, loc:park:<id>.
  async locLoad() {
    if (this.L) return this.L;
    const st = this.ctx.storage;
    const [cfg, key, state, plan, stats, bot, test, view] = await Promise.all([st.get("loc:cfg"), st.get("loc:key"), st.get("loc:state"), st.get("loc:plan"), st.get("loc:stats"), st.get("botStatus"), st.get("loc:test"), st.get("loc:view")]);
    const [party, sched] = await Promise.all([st.get("loc:party"), st.get("loc:sched")]);
    const parks = await st.list({ prefix: "loc:park:" });
    const L = { cfg: cleanConfig({ ...LOC_DEFAULTS, ...(cfg || {}) }), key: key || null, state: state || null, plan: new Set(plan || []),
      parks: new Map([...parks.values()].map(v => [v.id, v])), arrivals: [], stats: stats || { day: "", seen: 0, used: 0 }, show: null, check: null, test: test || null, party: party || null, sched: sched || {}, partyNow: { on: false, why: "" } };
    // what the card shows, and where it came from, must survive the hub going to sleep between updates (hibernation),
    // or the card goes blank on the next OBS heartbeat whenever no GPS update arrived for a while
    if (view && state) { L.show = view.show || null; L.check = view.check || null; L.src = view.src || ""; L.pinUntil = view.pinUntil || 0; L.jump = !!view.jump; }
    // shopping districts (Disney Springs, Downtown Disney, CityWalk) work like parks: until one is saved, its built-in record is used
    // (map spots + suggested areas); once saved, spots added by a later map build are added, nothing of yours is changed
    for (const d of DISTRICTS) {
      const built = DISTRICT_SPOTS[d.id] || [], cur = L.parks.get(d.id);
      if (cur) { const have = new Set(cur.spots.map(x => x.id)); const add = built.filter(x => !have.has(x.id)); if (add.length) L.parks.set(d.id, { ...cur, spots: [...cur.spots, ...add] }); continue; }
      const anchors = Object.entries(d.lands).flatMap(([land, names]) => built.filter(x => names.includes(x.n)).map(x => [land, x]));
      const m = (a, b) => Math.hypot((a.lat - b.lat) * 110540, (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180));
      const assign = {};
      for (const x of built) { let best = null; for (const [land, a] of anchors) { const dd = m(x, a); if (!best || dd < best[1]) best = [land, dd]; } if (best && best[1] <= 150) assign[x.id] = best[0]; }
      L.parks.set(d.id, { id: d.id, name: d.name, spots: built, lands: Object.keys(d.lands), assign, custom: [], shapes: {}, at: 0, builtin: true });
    }
    // park-app dots that sit far from the real place (lands.js SPOT_MOVES): use the corrected position
    for (const [pid, cur] of L.parks) if ((cur.spots || []).some(x => SPOT_MOVES[x.id])) L.parks.set(pid, { ...cur, spots: cur.spots.map(x => SPOT_MOVES[x.id] ? { ...x, lat: SPOT_MOVES[x.id][0], lon: SPOT_MOVES[x.id][1] } : x) });
    // suggested sections (lands.js): only for spots without a tag of hers; her tags and her section list always win
    for (const [pid, sug] of Object.entries(PARK_LANDS)) {
      const cur = L.parks.get(pid); if (!cur) continue;
      const assign = { ...(cur.assign || {}) }; let n = 0;
      for (const [id, land] of Object.entries(sug.assign)) if (assign[id] === undefined) { assign[id] = land; n++; }
      if (n) L.parks.set(pid, { ...cur, lands: [...(cur.lands || []), ...sug.lands.filter(l => !(cur.lands || []).includes(l))], assign });
    }
    // park changes (lands.js PARK_FIXES): renamed sections, closed map places, new sections
    for (const pid of Object.keys(PARK_FIXES)) { const cur = L.parks.get(pid); if (cur) L.parks.set(pid, applyFixes(cur)); }
    L.models = parkModels(L.parks);
    this.locShapes(L);
    if (this.botStatus === undefined) this.botStatus = bot || null;
    L.wasOn = this.locActive(L); L.wasAir = this.locGateOn(L);
    this.L = L;
    return L;
  }
  // GPS is used (and the card shows on every scene that has it) while Location is on and the home PC's status is fresh (120 s), and
  // either OBS is streaming (cfg.live, the default) or the location scene is on air (main or vertical canvas)
  locGateOn(L) {
    const b = this.botStatus;
    return !!(L.cfg.enabled && b && Date.now() - (b.at || 0) < 120e3 && ((L.cfg.live && b.streaming === true) || (L.cfg.scene && b.scene === L.cfg.scene) || (L.cfg.vscene && b.vertical === L.cfg.vscene)));
  }
  // test mode: GPS is used without the OBS scene and with Location off; results go only to the private preview, never on stream
  locTesting(L) { return !!(L.test && L.test.until > Date.now()); }
  locTestSrc(L) { return L.src === "phone" || L.src === "map"; }
  // the home PC says OBS is NOT streaming (fresh status, streaming false); test data may only reach the OBS page then
  locOffAir() { const b = this.botStatus; return !!(b && Date.now() - (b.at || 0) < 120e3 && b.streaming === false); }
  locActive(L) { return this.locGateOn(L) || this.locTesting(L); }
  locFast(L) {
    const a = L.arrivals;
    if (a.length < 6) return false;
    const gaps = a.slice(1).map((t, i) => t - a[i]).sort((x, y) => x - y);
    return gaps[Math.floor(gaps.length / 2)] < 10000;
  }
  locMsgs(L) {
    const on = this.locGateOn(L), act = this.locActive(L), test = this.locTesting(L);
    // test mode reaches the OBS page too, but only while the home PC says OBS is NOT streaming (fresh status, streaming === false)
    const offAir = this.locOffAir();
    // test data = anything while not on air, or a phone / map-tap position even when the scene is on air
    const obsTest = test && offAir && (!on || this.locTestSrc(L));
    return {
      pub: JSON.stringify({ type: "loc", on, test: obsTest, testSrc: obsTest ? L.src || "" : "", show: obsTest || (on && !this.locTestSrc(L)) ? L.show : null, cfg: { delayS: L.cfg.delayS, fallback: L.cfg.fallback, map: L.cfg.map, mapColor: L.cfg.mapColor, mapStyle: L.cfg.mapStyle } }),
      // the round map's dot: exact position, only to the OBS page and to those who may see location, only while the card may show it
      map: JSON.stringify(L.cfg.map && L.check && (obsTest || (on && !this.locTestSrc(L))) && Number.isFinite(L.check.lat) ? { type: "locMap", lat: L.check.lat, lon: L.check.lon, labels: (L.check.nearby || []).filter(x => !x.dup && Math.abs(x.dx) < 120 && Math.abs(x.dy) < 120).slice(0, 3).map(x => ({ n: x.n, dx: x.dx, dy: x.dy })) } : { type: "locMap", off: true }),
      priv: JSON.stringify({ type: "locCheck", on, enabled: L.cfg.enabled, party: L.partyNow, test: test ? { until: L.test.until, by: L.test.by, pinned: L.pinUntil > Date.now() } : null, show: act ? L.show : null, check: act ? L.check : null, src: act ? L.src || "" : "", fast: this.locFast(L), scene: (this.botStatus && this.botStatus.scene) || "", locScene: L.cfg.scene, streaming: !!(this.botStatus && this.botStatus.streaming === true), map: L.cfg.map, mapColor: L.cfg.mapColor, mapStyle: L.cfg.mapStyle }),
    };
  }
  locBroadcast(L) {
    const m = this.locMsgs(L);
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() || {};
      if (a.role === "bot") continue;
      try { ws.send(m.pub); if (seesLoc(a)) ws.send(m.priv); if (a.role === "overlay" || seesLoc(a)) ws.send(m.map); } catch {}
    }
  }
  async locClear(L) { L.state = null; L.show = null; L.check = null; L.src = ""; L.pinUntil = 0; L.jump = false; await this.ctx.storage.delete(["loc:state", "loc:view"]); }
  locView(L) { return { show: L.show, check: L.check, src: L.src || "", pinUntil: L.pinUntil || 0, jump: !!L.jump }; }
  // the home PC reported a scene change: switch GPS use on or off
  async locStatusChanged(status) {
    this.botStatus = status;
    const L = await this.locLoad();
    const air = this.locGateOn(L);
    if (air !== L.wasAir) {
      L.wasAir = air;
      await this.log([{ who: "OBS (home PC)", role: "bot", kind: "loc", what: air ? "Live or location scene on air: GPS in use" : "Not streaming and location scene off: GPS ignored" + (this.locTesting(L) ? " (test mode still on)" : " and cleared"), ok: 1 }]);
    }
    if (this.locTestSrc(L) && status.streaming === true && L.state) { await this.locClear(L); await this.log([{ who: "OBS (home PC)", role: "bot", kind: "loc", what: "OBS streaming: test position cleared", ok: 1 }]); }
    const on = this.locActive(L);
    if (on === L.wasOn) { this.locBroadcast(L); return; }
    L.wasOn = on;
    if (!on) await this.locClear(L);
    this.locBroadcast(L);
  }
  async gps(kind, keyHash, body) {
    const L = await this.locLoad();
    if (!L.key || !safeEqual(keyHash, L.key)) return { status: 401, error: "Wrong key" };   // no lockout: Moblin retries, and this key can only post a location
    return this.locFix(L, kind, body, "moblin");
  }
  // one GPS update from Moblin (src moblin) or from the owner's phone browser in test mode (src phone)
  async locFix(L, kind, body, src) {
    const who = src === "phone" ? "GPS (test, phone)" : src === "map" ? "GPS (test, map tap)" : "GPS (Moblin)";
    const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
    if (L.stats.day !== day) L.stats = { day, seen: 0, used: 0 };
    L.stats.seen++;
    if (kind === "stop") {
      // Moblin sends "stop" whenever it stops streaming AND every time the app goes to the background (switching apps, locking
      // the phone), even when not live. So a Moblin stop never blanks the card: the last place stays until the scene goes off
      // air, Location is turned off or test mode ends. It also never touches a test position from the phone or a map tap.
      if (src === "moblin") {
        if (L.state && L.src === "moblin" && !L.stopLogged) { L.stopLogged = true; await this.log([{ who, role: "", kind: "loc", what: "Moblin paused sending GPS (card keeps the last place)", ok: 1 }]); }
        return { status: 204 };
      }
      if (L.state) {
        await this.locClear(L);
        await this.log([{ who, role: "", kind: "loc", what: "Test position cleared", ok: 1 }]);
        this.locBroadcast(L);
      }
      return { status: 204 };
    }
    if (src === "moblin") L.stopLogged = false;
    if (src === "moblin") { L.arrivals.push(now); if (L.arrivals.length > 11) L.arrivals.shift(); }
    if (!this.locActive(L)) {
      if (L.state) { await this.locClear(L); this.locBroadcast(L); }
      return { status: 204, gated: true };
    }
    const p = parseFix(body, now);
    if (p.error) return { status: 400, error: p.error };
    if (src !== "map" && L.src !== "map" && L.state && L.state.fixAt && (p.fix.t < L.state.fixAt || p.fix.t - L.state.fixAt < RATE_MS)) return { status: 204 };   // out of order, or sooner than 3 s (a map tap always counts)
    const first = !L.state || !L.state.fixAt;
    // a map tap in test mode ("pretend I'm here") jumps straight there: no waiting for 3 agreeing fixes or the ride dwell time
    // jump straight there for a map tap, and for the first phone position after "Use this phone's GPS" (back to your real spot)
    const jump = src === "map" || (src === "phone" && L.jump);
    if (src === "phone") L.jump = false;
    const party = await this.locParty(L, L.state && L.state.park);
    const r = step(L.state, p.fix, L.models, L.cfg, L.plan, { dry: jump, places: L.places, resort: RESORT, lines: TRANSPORT_LINES, bounds: PARK_BOUNDS, shapes: L.shapes, margin: RIDE_MARGIN, omit: L.omit, partyIds: PARTY_IDS, hideParty: !party.on });
    if (r.show.outside) { r.show.area = await this.locArea(p.fix); r.check.area = r.show.area; }
    L.state = r.state; L.show = r.show; L.check = { ...r.check, acc: src === "phone" && Number.isFinite(Number(body.accuracy)) ? Math.round(Number(body.accuracy)) : null }; L.src = src; L.stats.used++;
    await this.ctx.storage.put({ "loc:state": L.state, "loc:view": this.locView(L), "loc:stats": L.stats });
    const events = [...(first ? ["GPS started: " + (r.show.park || r.show.place || r.show.area || "outside the parks")] : []), ...r.events];
    if (events.length) await this.log(events.map(what => ({ who, role: "", kind: "loc", what: (this.locGateOn(L) ? "" : "Test: ") + what, ok: 1 })));
    this.locBroadcast(L);
    return { status: 204 };
  }
  // Town name for a spot outside the parks and resort places ("Kissimmee"), from OpenStreetMap's Nominatim (© OpenStreetMap contributors).
  // Cached per ~1 km square (memory and storage), at most one lookup a minute, 3 s timeout; never a street or address.
  async locArea(fix) {
    const k = fix.lat.toFixed(2) + "," + fix.lon.toFixed(2);
    if (!this.areas) this.areas = (await this.ctx.storage.get("loc:areas")) || {};
    if (k in this.areas) return this.areas[k];
    const now = Date.now();
    if (this.areaAt && now - this.areaAt < 60e3) return this.lastArea || null;
    this.areaAt = now;
    let name = null;
    try {
      const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${fix.lat.toFixed(4)}&lon=${fix.lon.toFixed(4)}`;
      const r = await fetch(u, { headers: { "user-agent": "ParkDay/1.0 (planner.cruiseandthemeparkguide.com)", "accept-language": "en" }, signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const a = (await r.json()).address || {};
        name = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || null;
        if (name === "Bay Lake") name = RESORT;   // Bay Lake is Walt Disney World's own town
        if (name) name = String(name).slice(0, 60);
      }
    } catch {}
    if (!name) return this.lastArea || null;   // lookup failed: try again in a minute, nothing stored
    this.areas[k] = name; this.lastArea = name;
    const keys = Object.keys(this.areas); if (keys.length > 300) delete this.areas[keys[0]];
    await this.ctx.storage.put("loc:areas", this.areas);
    return name;
  }
  async locExport() {
    const L = await this.locLoad();
    return { at: Date.now(), parks: [...L.parks.values()].sort((a, b) => a.id.localeCompare(b.id)) };
  }
  async locInfo(owner) {
    const L = await this.locLoad();
    const b = this.botStatus;
    const day = new Date().toISOString().slice(0, 10);
    const parks = [...L.parks.values()].map(p => {
      const assign = p.assign || {};
      return { id: p.id, name: p.name, short: parkModel({ name: p.name }).short, spots: (p.spots || []).length, tagged: Object.values(assign).filter(v => v && v !== "-").length, lands: p.lands || [], custom: (p.custom || []).length, ...(RESORT_IDS[p.id] ? { places: PLACES.filter(x => x.r === RESORT_IDS[p.id]).length + (p.custom || []).length, outlines: Object.keys(p.shapes || {}).length } : {}) };
    }).sort((x, y) => x.name.localeCompare(y.name));
    return {
      cfg: L.cfg, keySet: !!L.key, on: this.locGateOn(L), party: L.partyNow, test: this.locTesting(L) ? { until: L.test.until, by: L.test.by } : null, src: this.locActive(L) ? L.src || "" : "",
      obs: b ? { scene: b.scene || "", vertical: b.vertical || "", age: Math.round((Date.now() - (b.at || 0)) / 1000) } : null,
      show: this.locActive(L) ? L.show : null, check: this.locActive(L) ? L.check : null, fast: this.locFast(L),
      stats: L.stats.day === day ? L.stats : { day, seen: 0, used: 0 },
      parks: owner ? parks : parks.map(({ id, short }) => ({ id, short })),
    };
  }
  async locSetConfig(c, by) {
    const L = await this.locLoad();
    const before = L.cfg;
    L.cfg = cleanConfig({ ...L.cfg, ...(c || {}) });
    await this.ctx.storage.put("loc:cfg", L.cfg);
    const what = before.enabled !== L.cfg.enabled ? (L.cfg.enabled ? "Location turned on" : "Location turned off") : "Location settings changed";
    await this.log([{ who: by, role: "owner", kind: "loc", what, ok: 1 }]);
    const on = this.locActive(L);
    if (!on && L.state) await this.locClear(L);
    L.wasOn = on; L.wasAir = this.locGateOn(L);
    this.locBroadcast(L);
    return L.cfg;
  }
  async locNewKey(by) {
    const L = await this.locLoad();
    const b = new Uint8Array(18); crypto.getRandomValues(b);
    const key = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    L.key = [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join("");
    await this.ctx.storage.put("loc:key", L.key);
    await this.log([{ who: by, role: "owner", kind: "loc", what: "New GPS key made (the old one stops working)", ok: 1 }]);
    return { key };
  }
  async locGetPark(id) { const L = await this.locLoad(); return L.parks.get(id) || null; }
  // Ride outlines in use: the built-in ones (rides.js, from OpenStreetMap) with the owner's own per park on top
  // (an outline she drew, "circle" = only the 25 m circle, "omit" = never "Near").
  locShapes(L) {
    const shapes = { ...BUILTIN_SHAPES, ...DISTRICT_SHAPES }, omit = new Set(RIDE_OMIT);
    for (const p of L.parks.values()) for (const [id, v] of Object.entries(p.shapes || {})) {
      if (v === "circle") { delete shapes[id]; omit.delete(id); }
      else if (v === "omit") { delete shapes[id]; omit.add(id); }
      else if (Array.isArray(v)) { shapes[id] = v; omit.delete(id); }
    }
    L.shapes = shapes; L.omit = omit;
    // outside the parks: built-in places with the owner's outlines on top ("omit" removes one), plus places she added
    const own = {};
    for (const id of Object.keys(RESORT_IDS)) { const r = L.parks.get(id); if (r) own[id] = r; }
    const places = [];
    for (const pl of PLACES) {
      const v = Object.values(own).map(r => (r.shapes || {})[pl.id]).find(x => x !== undefined);
      if (v === "omit") continue;
      places.push(Array.isArray(v) ? { ...pl, p: v } : pl);
    }
    for (const [rid, r] of Object.entries(own)) for (const c of r.custom || []) {
      const sh = (r.shapes || {})[c.id];
      if (sh === "omit") continue;
      const circle = Array.from({ length: 16 }, (_, i) => [c.lat + (40 / 110540) * Math.sin(i * Math.PI / 8), c.lon + (40 / (111320 * Math.cos(c.lat * Math.PI / 180))) * Math.cos(i * Math.PI / 8)]);
      places.push({ id: c.id, n: c.n, k: OUT_KINDS[c.t] || "area", r: RESORT_IDS[rid], c: [c.lat, c.lon], p: Array.isArray(sh) ? sh : circle });
    }
    L.places = places;
  }
  async locPutPark(id, d, by) {
    const L = await this.locLoad();
    if (!/^[a-zA-Z0-9-]{8,60}$/.test(id)) return { error: "Bad park id" };
    // saved from another device since this one loaded the park: hand back the current copy so the dashboard can merge (never overwrite)
    const cur = L.parks.get(id);
    if (d.base !== undefined && cur && Number(d.base) !== cur.at) return { error: "conflict", conflict: true, park: cur };
    const num = v => (Number.isFinite(Number(v)) ? Number(v) : NaN);
    const lands = [...new Set((Array.isArray(d.lands) ? d.lands : []).map(x => String(x).trim().slice(0, 60)).filter(Boolean))].slice(0, 40);
    const spots = (Array.isArray(d.spots) ? d.spots : []).slice(0, 500).map(s => ({ id: String(s.id || "").slice(0, 60), n: String(s.n || "").slice(0, 120), t: ["A", "S", "R", "H", "P"].includes(s.t) ? s.t : "A", lat: num(s.lat), lon: num(s.lon) }))
      .filter(s => s.id && s.n && Number.isFinite(s.lat) && Number.isFinite(s.lon));
    const assign = {};
    for (const [k, v] of Object.entries(d.assign || {})) { if (v === "-" || lands.includes(v)) assign[String(k).slice(0, 60)] = v; }
    const custom = (Array.isArray(d.custom) ? d.custom : []).slice(0, 60).map(c => ({ id: String(c.id || "").slice(0, 40), n: String(c.n || "").slice(0, 80), lat: num(c.lat), lon: num(c.lon), land: lands.includes(c.land) ? c.land : null, t: ["A", "S", "R", "H", "P", "O", "T", "B", "U"].includes(c.t) ? c.t : "C" }))
      .filter(c => c.id && c.n && Number.isFinite(c.lat) && Number.isFinite(c.lon));
    // the owner's outlines: only for this park's spots, 3 to 100 corners near the spot, at most 400 per park
    const ids = new Map([...spots, ...custom, ...(PARK_EXTRAS[id] || []), ...(RESORT_IDS[id] ? PLACES.filter(p => p.r === RESORT_IDS[id]).map(p => ({ id: p.id, lat: p.c[0], lon: p.c[1] })) : [])].map(x => [x.id, x])), shapes = {};
    for (const [k, v] of Object.entries(d.shapes && typeof d.shapes === "object" ? d.shapes : {}).slice(0, 400)) {
      const sp = ids.get(k);
      // a spot this park no longer lists (renamed or removed in the park app, or a map rebuild): keep your outline anyway, never drop it
      if (!sp) { if (v === "circle" || v === "omit" || (Array.isArray(v) && v.length >= 3 && v.length <= 100 && v.every(q => Array.isArray(q) && Number.isFinite(num(q[0])) && Number.isFinite(num(q[1]))))) shapes[k] = Array.isArray(v) ? v.map(q => [Math.round(num(q[0]) * 1e6) / 1e6, Math.round(num(q[1]) * 1e6) / 1e6]) : v; continue; }
      if (v === "circle" || v === "omit") { shapes[k] = v; continue; }
      if (!Array.isArray(v) || v.length < 3 || v.length > 100) continue;
      const pts = v.map(q => [Math.round(num(q && q[0]) * 1e6) / 1e6, Math.round(num(q && q[1]) * 1e6) / 1e6]);
      if (pts.every(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - sp.lat) < 0.01 && Math.abs(b - sp.lon) < 0.01)) shapes[k] = pts;
    }
    const park = { id, name: String(d.name || "Park").slice(0, 80), spots, lands, assign, custom, shapes, at: Date.now() };
    const size = JSON.stringify(park).length;
    if (size > 120000) return { error: `Too big to save (${Math.round(size / 1000)} KB, limit 120). Use fewer corners on the biggest outlines. Your changes are kept on this device.` };
    await this.locSnap(cur, "before your changes");
    await this.ctx.storage.put("loc:park:" + id, park);
    L.parks.set(id, park); L.models = parkModels(L.parks); this.locShapes(L);
    const ns = Object.keys(shapes).length;
    await this.log([{ who: by, role: "owner", kind: "loc", what: `Location: saved ${lands.length} lands for ${parkModel(park).short} (${Object.values(assign).filter(v => v !== "-").length} of ${spots.length} spots tagged, ${custom.length} own spots${ns ? `, ${ns} ride outline${ns === 1 ? "" : "s"} of your own` : ""})`, ok: 1 }]);
    return { ok: true, at: park.at, shapes: ns };
  }
  // ---- save history (Oct 4): a copy of a park as it was before a change, at most one per 10 minutes (the dashboard saves every few
  // seconds while you edit, so one copy = "before that editing session"), always before a removal or a go-back; the last 30 kept.
  // Each copy is its own key (loc:ver:<park>:<time>); a small index (loc:verlist:<park>) lists them, so a save never reads them all.
  async locSnap(p, why, force) {
    if (!p) return;
    const ix = "loc:verlist:" + p.id, list = (await this.ctx.storage.get(ix)) || [];
    if (!force && list.length && Date.now() - list[list.length - 1].at < 600000) return;
    const at = Date.now(), v = String(at), key = "loc:ver:" + p.id + ":" + v;
    await this.ctx.storage.put(key, p);
    list.push({ v, at, why, lands: (p.lands || []).length, tagged: Object.values(p.assign || {}).filter(x => x !== "-").length, spots: (p.spots || []).length, own: (p.custom || []).length, outlines: Object.keys(p.shapes || {}).length });
    while (list.length > 30) { const old = list.shift(); await this.ctx.storage.delete("loc:ver:" + p.id + ":" + old.v); }
    await this.ctx.storage.put(ix, list);
  }
  async locHistory(id) {
    const L = await this.locLoad(), cur = L.parks.get(id);
    const list = (await this.ctx.storage.get("loc:verlist:" + id)) || [];
    const count = p => p ? { lands: (p.lands || []).length, tagged: Object.values(p.assign || {}).filter(x => x !== "-").length, spots: (p.spots || []).length, own: (p.custom || []).length, outlines: Object.keys(p.shapes || {}).length } : null;
    return { now: cur ? { at: cur.at, ...count(cur) } : null, versions: list.slice().reverse() };
  }
  // go back to a copy: your outlines, lands, tags and own spots come back; the park's current ride list stays (it comes from the park app).
  // The state you leave is saved first, so going back can itself be undone.
  async locRestore(id, v, by) {
    const L = await this.locLoad();
    if (!/^\d{10,16}$/.test(v)) return { error: "Bad version" };
    const old = await this.ctx.storage.get("loc:ver:" + id + ":" + v);
    if (!old) return { error: "That copy is not kept any more" };
    const cur = L.parks.get(id);
    await this.locSnap(cur, "before going back to an earlier copy", true);
    const park = { ...old, spots: cur ? cur.spots : old.spots, at: Date.now() };
    await this.ctx.storage.put("loc:park:" + id, park);
    L.parks.set(id, park); L.models = parkModels(L.parks); this.locShapes(L);
    await this.log([{ who: by, role: "owner", kind: "loc", what: `Location: went back to the copy of ${parkModel(park).short} from ${new Date(Number(v)).toISOString().slice(0, 16).replace("T", " ")} UTC`, ok: 1 }]);
    return { ok: true, at: park.at };
  }
  async locDeletePark(id, by) {
    const L = await this.locLoad();
    const p = L.parks.get(id);
    if (!p) return { ok: true };
    await this.locSnap(p, "before the park was removed", true);
    await this.ctx.storage.delete("loc:park:" + id);
    L.parks.delete(id); L.models = parkModels(L.parks); this.locShapes(L);
    await this.log([{ who: by, role: "owner", kind: "loc", what: `Location: removed ${parkModel(p).short}`, ok: 1 }]);
    return { ok: true };
  }
  // tests only (TEST_HOOKS=1 in wrangler dev): forget everything held in memory, like the hub waking from hibernation
  dropMemory() { this.L = undefined; this.botStatus = undefined; return { ok: true }; }
  // test mode on (for 3 hours) or off
  // Party-only spots: shown when the owner says so (until 4 AM Orlando time), or automatically on a party night at this park
  // (ThemeParks.wiki schedule, fetched at most every 6 hours per park, 3 s timeout; no schedule = hidden).
  async locParty(L, parkId) {
    const now = Date.now();
    const m = L.party && L.party.until > now ? L.party.mode : "auto";
    let res;
    if (m === "on") res = { on: true, mode: "on", why: "you turned them on" };
    else if (m === "off") res = { on: false, mode: "off", why: "you turned them off" };
    else {
      let night = null;
      if (parkId) {
        let c = L.sched[parkId];
        if ((!c || now - c.at > 6 * 3600e3) && !(c && c.tried && now - c.tried < 10 * 60e3)) {
          try {
            const r = await fetch(`https://api.themeparks.wiki/v1/entity/${parkId}/schedule`, { signal: AbortSignal.timeout(3000) });
            if (r.ok) { const j = await r.json(); c = { at: now, list: (j.schedule || []).slice(0, 200).map(e => ({ type: e.type, description: e.description || "", openingTime: e.openingTime, closingTime: e.closingTime })) }; }
            else c = { ...(c || { at: 0, list: [] }), tried: now };
          } catch { c = { ...(c || { at: 0, list: [] }), tried: now }; }
          L.sched = { [parkId]: c };
          await this.ctx.storage.put("loc:sched", L.sched);
        }
        night = c ? partyNight(c.list, now) : null;
      }
      res = night ? { on: true, mode: "auto", why: night.name, until: night.end } : { on: false, mode: "auto", why: parkId ? "not a party night here" : "" };
    }
    if (res.on !== L.partyNow.on && res.mode === "auto" && res.on) await this.log([{ who: "Location", role: "", kind: "loc", what: "Party night (" + res.why + "): party-only spots shown", ok: 1 }]);
    L.partyNow = res;
    return res;
  }
  async locSetParty(mode, by) {
    const L = await this.locLoad();
    if (!["auto", "on", "off"].includes(mode)) return { error: "mode must be auto, on or off" };
    if (mode === "auto") { L.party = null; await this.ctx.storage.delete("loc:party"); }
    else {
      // until 4 AM Orlando time
      const now = Date.now(), ny = new Date(new Date(now).toLocaleString("en-US", { timeZone: "America/New_York" })), off = ny.getTime() - now;
      const t = new Date(ny); t.setHours(4, 0, 0, 0); if (t <= ny) t.setDate(t.getDate() + 1);
      L.party = { mode, until: t.getTime() - off, by };
      await this.ctx.storage.put("loc:party", L.party);
    }
    await this.log([{ who: by, role: "owner", kind: "loc", what: mode === "auto" ? "Party spots: automatic (shown on party nights)" : mode === "on" ? "Party spots: shown (until 4 AM)" : "Party spots: hidden (until 4 AM)", ok: 1 }]);
    await this.locParty(L, L.state && L.state.park);
    this.locBroadcast(L);
    return { party: L.partyNow };
  }
  async locSetTest(on, by) {
    const L = await this.locLoad();
    L.test = on ? { until: Date.now() + 3 * 3600e3, by } : null;
    if (L.test) await this.ctx.storage.put("loc:test", L.test); else await this.ctx.storage.delete("loc:test");
    await this.log([{ who: by, role: "owner", kind: "loc", what: on ? "Location test mode on (3 hours): GPS is used without the OBS scene, shown only in the preview" : "Location test mode off", ok: 1 }]);
    const act = this.locActive(L);
    if (!act && L.state) await this.locClear(L);
    L.wasOn = act;
    this.locBroadcast(L);
    return { test: L.test };
  }
  async locPhone(body, by) {
    const L = await this.locLoad();
    if (!this.locTesting(L)) return { status: 409, error: "Test mode is off" };
    if (!(body && body.stop) && this.botStatus && this.botStatus.streaming === true) return { status: 423, error: "OBS is streaming: test positions are blocked so they can't reach viewers" };
    const src = body && body.src === "map" ? "map" : "phone";
    // a map tap pins the test position for 5 minutes, so a phone still sending its real (home) position doesn't pull it back;
    // the app's "Use this phone's GPS" button sends resume first to undo the pin
    if (body && body.resume) { L.pinUntil = 0; L.jump = true; if (L.state) await this.ctx.storage.put("loc:view", this.locView(L)); return { status: 204 }; }
    if (body && body.stop) return this.locFix(L, "stop", null, src);
    if (src === "phone" && L.pinUntil > Date.now()) return { status: 204 };
    if (src === "map") L.pinUntil = Date.now() + 5 * 60e3;
    const acc = Number(body && body.accuracy);
    if (src === "phone" && Number.isFinite(acc) && acc > 80) return { status: 422, error: "GPS too rough (" + Math.round(acc) + " m)" };
    return this.locFix(L, "push", { ...body, timestamp: src === "map" ? Date.now() / 1000 : body.timestamp }, src);
  }
  // test mode: what would the scene say at this spot? (no waiting, nothing stored or shown on stream)
  async locTest(b) {
    const L = await this.locLoad();
    const lat = Number(b && b.lat), lon = Number(b && b.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { error: "Bad position" };
    const pk = step(freshState(), { lat, lon, speed: 0, t: Date.now() }, L.models, L.cfg, L.plan, { dry: true, bounds: PARK_BOUNDS, shapes: L.shapes, margin: RIDE_MARGIN, omit: L.omit, partyIds: PARTY_IDS }).state.park;
    const party = await this.locParty(L, pk);
    const r = step(freshState(), { lat, lon, speed: 0, t: Date.now() }, L.models, L.cfg, L.plan, { dry: true, places: L.places, resort: RESORT, lines: TRANSPORT_LINES, bounds: PARK_BOUNDS, shapes: L.shapes, margin: RIDE_MARGIN, omit: L.omit, partyIds: PARTY_IDS, hideParty: !party.on });
    if (r.show.outside) { r.show.area = await this.locArea({ lat, lon }); r.check.area = r.show.area; }
    return { show: r.show, check: r.check };
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
    if (f.n >= MAX && !f.until) await this.log([{ who: "Someone at " + maskIp(ip), role: "", kind: "lockout", what: `${MAX} wrong codes: locked out for 15 min`, ok: 0 }]);
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
