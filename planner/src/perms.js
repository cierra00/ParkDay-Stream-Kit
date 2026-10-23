// One list of everything a moderator can be allowed to do. Used by the app (what to show),
// the Worker (what to allow) and the owner dashboard (/api/perms feeds its checkboxes).
export const PERMS = [
  { k: "scene", g: "Stream", l: "Switch to LIVE scene button", h: "Switches OBS to the live scene with overlays off. Never starts or stops the stream." },
  { k: "status", g: "Stream", l: "See stream status", h: "Current scene, live or not, and whether the mic is muted. Look only." },
  { k: "snap", g: "Stream", l: "Snapshot", h: "Ask for a small still picture of what is on stream right now" },
  { k: "loc", g: "Stream", l: "See location", h: "Your exact position and nearby rides while the Location scene is on air (private check view). Look only." },
  { k: "now.set", g: "NOW card", l: "Put things on NOW", h: "Pick what you're doing, start a stop, the ▶ buttons" },
  { k: "now.done", g: "NOW card", l: "Done / Clear", h: "Check off NOW (starts NEXT if it's due in 5 min)" },
  { k: "now.pause", g: "NOW card", l: "Pause and Resume", h: "Take NOW off stream for a bit and bring it back" },
  { k: "now.detail", g: "NOW card", l: "NOW details", h: "Walking there / In line / On ride, how you're getting around, band name" },
  { k: "next", g: "NEXT", l: "Choose NEXT", h: "Pick or change what shows as NEXT" },
  { k: "cd.pick", g: "Countdown", l: "Pick the countdown stop", h: "Tick or untick ⏱ on a stop" },
  { k: "cd.settings", g: "Countdown", l: "Countdown switch and timing", h: "Turn the top countdown on or off, and how early it shows" },
  { k: "display", g: "On stream", l: "NEXT line and live-scene card", h: "Turn the NEXT line on or off, and the card on the live scene" },
  { k: "plan.add", g: "Plan", l: "Add stops", h: "Rides, food, showtimes and your own stops" },
  { k: "plan.time", g: "Plan", l: "Change times", h: "Set, change or clear a stop's time" },
  { k: "plan.check", g: "Plan", l: "Check stops off", h: "Tick stops as done or bring them back" },
  { k: "plan.remove", g: "Plan", l: "Remove stops", h: "Delete stops from the plan" },
  { k: "park.here", g: "Parks", l: "Change the park we're at", h: "Park hopping: what the card says we're at" },
  { k: "park.list", g: "Parks", l: "Add or remove today's parks", h: "Which parks are on today's list" },
];
export const PERM_KEYS = PERMS.map(p => p.k);
// Stream abilities send commands to the home PC or only look; they never change the saved plan.
export const STREAM_KEYS = PERMS.filter(p => p.g === "Stream").map(p => p.k);
export const ROLES = {
  viewer: { label: "Viewer", what: "sees what viewers see, can't change anything", perms: [] },
  mod: { label: "Mod", what: "Switch to LIVE scene + stream status + NOW + add, change and remove plan stops", perms: ["scene", "status", "now.set", "now.done", "now.pause", "now.detail", "next", "plan.add", "plan.time", "plan.check", "plan.remove"] },
  stream: { label: "Scene only", what: "Switch to LIVE scene button and stream status", perms: ["scene", "status"] },
  live: { label: "Live helper", what: "Switch to LIVE scene + stream status + runs NOW, NEXT and the countdown stop", perms: ["scene", "status", "now.set", "now.done", "now.pause", "now.detail", "next", "cd.pick"] },
  planner: { label: "Planner", what: "builds the plan, picks NEXT and the countdown, nothing live", perms: ["next", "cd.pick", "plan.add", "plan.time", "plan.check", "plan.remove"] },
  cohost: { label: "Co-host", what: "everything except See location", perms: PERM_KEYS.filter(k => k !== "loc") },
};
// Older mods saved "plan" = everything except the Stream abilities
export function expandPerms(list) {
  const out = new Set();
  for (const p of list || []) {
    if (p === "plan") PERM_KEYS.filter(k => !STREAM_KEYS.includes(k)).forEach(k => out.add(k));
    else if (PERM_KEYS.includes(p) || p === "*") out.add(p);
  }
  return [...out];
}
const LABEL = Object.fromEntries(PERMS.map(p => [p.k, p.l]));
export const permLabel = k => LABEL[k] || k;

// What a save changes, as a list of "any one of these permissions is enough" groups.
// a = what the server has now, b = what the phone sent.
export function neededPerms(a, b) {
  a = a || {}; b = b || {};
  const req = [], need = (...alts) => req.push(alts);
  const A = new Map((a.plan || []).map(p => [p.id, p])), B = new Map((b.plan || []).map(p => [p.id, p]));
  const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
  let changed = false;
  for (const [id, p] of B) {
    const o = A.get(id);
    if (!o) { changed = true; need(...(p.adhoc ? ["now.set", "plan.add"] : id === b.nextId ? ["next", "plan.add"] : ["plan.add"])); continue; }
    if (!!o.done !== !!p.done) { changed = true; need("plan.check", "now.done", "now.set"); }
    if (!same(o.time, p.time)) { changed = true; need("plan.time"); }
    if (!!o.cd !== !!p.cd) { changed = true; need("cd.pick"); }
    if (!same(o.stage, p.stage)) { changed = true; need("now.detail", "now.set", "now.done"); }
    if (!same(o.cat, p.cat) || !same(o.item, p.item)) { changed = true; need("now.detail", "now.set"); }
    if (!same(o.name, p.name) || !same(o.type, p.type) || !same(o.parkId, p.parkId) || !!o.adhoc !== !!p.adhoc) { changed = true; need("plan.add"); }
  }
  for (const [id, o] of A) if (!B.has(id)) { changed = true; need(...(o.adhoc ? ["plan.remove", "now.set"] : ["plan.remove"])); }
  if (!same(a.cur, b.cur)) {
    changed = true;
    if (!b.cur) need("now.done", "now.pause", "now.set", "plan.check", "plan.remove", "park.here", "park.list");
    else if (b.cur === a.paused) need("now.pause", "now.set");
    else need("now.set", "now.done");
  }
  if (!same(a.paused, b.paused)) { changed = true; need("now.pause", "now.set", "now.done"); }
  if (!same(a.nextId, b.nextId)) { changed = true; need("next", "now.set", "now.done"); }
  if (!same(a.hereId, b.hereId)) { changed = true; need("park.here", "park.list", "now.set"); }
  if (!same(a.parks, b.parks)) { changed = true; need("park.list"); }
  if (!same(a.heading || "", b.heading || "")) { changed = true; need("next", "now.set"); }   // the location card's "Heading to" line
  const sa = a.settings || {}, sb = b.settings || {};
  for (const k of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
    if (same(sa[k], sb[k])) continue;
    changed = true;
    need(k === "next" || k === "onLive" || k === "heading" ? "display" : "cd.settings");
  }
  const skip = new Set(["plan", "cur", "paused", "nextId", "hereId", "parks", "heading", "settings", "display", "updated", "updatedBy", "v"]);
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!skip.has(k) && !same(a[k], b[k])) { changed = true; need("plan.add"); }
  // nothing changed but the stream card (live wait times refreshing): only someone running NOW sends those
  if (!changed && !same(a.display, b.display)) need("now.set", "now.detail", "now.done");
  return req;
}
// null = allowed, otherwise the label of the first missing permission
export function missingPerm(perms, a, b) {
  if (perms.includes("*")) return null;
  for (const alts of neededPerms(a, b)) if (!alts.some(k => perms.includes(k))) return permLabel(alts[0]);
  return null;
}
