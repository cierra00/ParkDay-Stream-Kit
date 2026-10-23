// Activity log: plain-language lines for "who pressed what". Kept in the LiveHub Durable Object (SQLite), 30 days.
import { PERMS } from "../src/perms.js";

export const LOG_DAYS = 30;
const LABEL = Object.fromEntries(PERMS.map(p => [p.k, p.l]));
const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
const cut = (t, n = 60) => { t = String(t ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const STAGE = { walk: "walking there", line: "in line", doing: "on it" };
function clock(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || "");
  if (!m) return "";
  const h = +m[1];
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

// What changed in the saved day, a = before, b = after. Live wait-time refreshes (display only) give [].
export function describeChange(a, b) {
  a = a || {}; b = b || {};
  const out = [];
  const A = new Map((a.plan || []).map(p => [p.id, p])), B = new Map((b.plan || []).map(p => [p.id, p]));
  const nameOf = id => { const p = B.get(id) || A.get(id); return p ? cut(p.name || (p.cat ? p.cat : "a stop")) : "a stop"; };
  // NOW / pause / NEXT first: those are what viewers see
  if (!same(a.cur, b.cur)) {
    if (!b.cur) out.push(a.paused !== b.paused && b.paused ? "" : `NOW cleared (was ${nameOf(a.cur)})`);
    else if (b.cur === a.paused) out.push(`Resumed: ${nameOf(b.cur)}`);
    else out.push(`NOW: ${nameOf(b.cur)}`);
  }
  if (!same(a.paused, b.paused) && b.paused) out.push(`Paused: ${nameOf(b.paused)}`);
  if (!same(a.nextId, b.nextId)) out.push(b.nextId ? `NEXT: ${nameOf(b.nextId)}` : "NEXT set back to automatic");
  for (const [id, p] of B) {
    const o = A.get(id);
    if (!o) { if (!(p.adhoc && id === b.cur)) out.push(`Added stop: ${nameOf(id)}${p.time ? " at " + clock(p.time) : ""}`); continue; }
    if (!!o.done !== !!p.done) out.push(`${p.done ? "Checked off" : "Brought back"}: ${nameOf(id)}`);
    if (!same(o.time, p.time)) out.push(p.time ? `Time for ${nameOf(id)}: ${clock(p.time)}` : `Time cleared: ${nameOf(id)}`);
    if (!!o.cd !== !!p.cd && p.cd) out.push(`Countdown to: ${nameOf(id)}`);
    if (!same(o.stage, p.stage) && STAGE[p.stage]) out.push(`${nameOf(id)}: ${STAGE[p.stage]}`);
    if (!same(o.item, p.item) || !same(o.cat, p.cat)) {
      const it = p.item || {};
      if (!same((o.item || {}).band, it.band) && it.band) out.push(`Band: ${cut(it.band, 40)}`);
      else if (!same((o.item || {}).mode, it.mode) && it.mode) out.push(`Getting around: ${cut(it.mode, 30)}${it.to ? " to " + cut(it.to, 30) : ""}`);
      else if (!same(o.cat, p.cat)) out.push(`${nameOf(id)}: now "${cut(p.cat, 20)}"`);
    }
    if (!same(o.name, p.name) && o.name) out.push(`Renamed: ${cut(o.name, 30)} to ${nameOf(id)}`);
  }
  // a stop that had the countdown lost it, and no other stop got it
  const hadCd = [...A.values()].some(p => p.cd), hasCd = [...B.values()].some(p => p.cd);
  if (hadCd && !hasCd) out.push("Countdown: nothing ticked");
  for (const [id, o] of A) if (!B.has(id) && !(o.adhoc && (id === a.cur || id === a.paused))) out.push(`Removed stop: ${cut(o.name || "a stop")}`);
  if (!same(a.hereId, b.hereId)) { const p = (b.parks || []).find(x => x.id === b.hereId); out.push(p ? `Park: ${cut(p.name)}` : "Park cleared"); }
  if (!same(a.parks, b.parks)) {
    const ia = new Set((a.parks || []).map(p => p.id)), ib = new Set((b.parks || []).map(p => p.id));
    for (const p of b.parks || []) if (!ia.has(p.id)) out.push(`Added park: ${cut(p.name)}`);
    for (const p of a.parks || []) if (!ib.has(p.id)) out.push(`Removed park: ${cut(p.name)}`);
  }
  const sa = a.settings || {}, sb = b.settings || {};
  const onoff = v => (v ? "on" : "off");
  if (!same(sa.countdown, sb.countdown)) out.push(`Top countdown switched ${onoff(sb.countdown)}`);
  if (!same(sa.within, sb.within) && sb.within != null) out.push(sb.within >= 1440 ? "Countdown shows all the time" : `Countdown shows ${sb.within} min before`);
  if (!same(sa.next, sb.next)) out.push(`NEXT line switched ${onoff(sb.next)}`);
  if (!same(sa.onLive, sb.onLive)) out.push(`Card on the live scene switched ${onoff(sb.onLive)}`);
  const lines = out.filter(Boolean);
  return lines.length > 6 ? [...lines.slice(0, 5), `and ${lines.length - 5} more changes`] : lines;
}

// What changed in the moderator list (owner dashboard). Codes are never logged, only that one was made.
export function describeMods(old, next) {
  const out = [];
  const O = new Map((old || []).map(m => [m.id, m])), N = new Map((next || []).map(m => [m.id, m]));
  for (const [id, m] of N) {
    const o = O.get(id);
    if (!o) { out.push(`Added mod ${cut(m.name, 40)} (${m.role || "custom"})`); continue; }
    if (o.name !== m.name) out.push(`Renamed mod ${cut(o.name, 30)} to ${cut(m.name, 30)}`);
    if ((o.active === false) !== (m.active === false)) out.push(`${m.active === false ? "Turned off" : "Turned on"} mod ${cut(m.name, 40)}`);
    if (o.hash !== m.hash) out.push(`New code for ${cut(m.name, 40)}`);
    const po = new Set(o.perms || []), pn = new Set(m.perms || []);
    const added = [...pn].filter(k => !po.has(k)).map(k => LABEL[k] || k), removed = [...po].filter(k => !pn.has(k)).map(k => LABEL[k] || k);
    if (added.length || removed.length) out.push(`${cut(m.name, 40)}: ${[added.length ? "can now " + added.join(", ") : "", removed.length ? "can no longer " + removed.join(", ") : ""].filter(Boolean).join("; ")}`);
  }
  for (const [id, o] of O) if (!N.has(id)) out.push(`Removed mod ${cut(o.name, 40)}`);
  return out;
}

// Commands to the home PC, in words
export const CMD_WORDS = { "scene.live": "Switch to LIVE scene", "snap.take": "Snapshot" };
export const cmdWords = a => CMD_WORDS[a] || cut(a, 40);

// Short, not personal: "203.0.x.x" / "2600:1700:x"
export function maskIp(ip) {
  ip = String(ip || "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.split(".").slice(0, 2).join(".") + ".x.x";
  if (ip.includes(":")) return ip.split(":").slice(0, 2).join(":") + ":x";
  return "unknown";
}
