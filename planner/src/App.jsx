import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PERMS } from "./perms.js";
// what the signed-in person may change (Cierra: everything; a mod: what the owner dashboard gave them)
const CanCtx = createContext(() => true);
import { loadDestinations, loadPark, nowIn, clock } from "./parks.js";
import { getCode, setCode, whoami, fetchState, saveState, sendCmd, getMods, putMods, liveLink } from "./api.js";
import { CONCERT, bandFor } from "./concerts.js";

const CATS = [
  { k: "ride", ic: "🎢", label: "On a ride", types: ["A"] },
  { k: "line", ic: "⏳", label: "In line", types: ["A"] },
  { k: "eat", ic: "🍽️", label: "Eating", types: ["R"] },
  { k: "fireworks", ic: "🎆", label: "Fireworks", types: ["S"], only: "night" },
  { k: "parade", ic: "🎉", label: "Parade", types: ["S"], only: "parade" },
  { k: "concert", ic: "🎸", label: "Concert", types: ["S"], only: "concert" },
  { k: "show", ic: "🎭", label: "Watching a show", types: ["S"] },
  { k: "meet", ic: "✨", label: "Meeting characters", types: ["S", "A"], meet: true },
  { k: "shop", ic: "🛍️", label: "Shopping", types: [] },
  { k: "explore", ic: "🚶", label: "Exploring", types: [] },
  { k: "hop", ic: "🚝", label: "Park hopping", types: [] },
  { k: "travel", ic: "🚌", label: "Getting around", types: [] },
];
// Getting around: only the transportation and places that exist at the resort you're at
const RESORT_OF = {
  "75ea578a-adc8-4116-a54d-dccb60765ef9": "wdw", "47f90d2c-e191-4239-a466-5892ef59a88b": "wdw", "288747d1-8b4f-4a64-867e-ea7c9b27bad8": "wdw", "1c84a229-8862-4648-9c71-378ddd2c7693": "wdw",
  "7340550b-c14d-4def-80bb-acdb51d49a66": "dlr", "832fcd51-ea19-4e77-85c7-75d5843b127c": "dlr",
  "eb3f4560-2383-4a36-9152-6b3e5ed6bc57": "uor", "267615cc-8943-4c2a-ae2c-5da728ca591f": "uor", "12dbb85b-265f-44e6-bccf-f1faa17211fc": "uor",
  "bc4005c5-8c7e-41d7-b349-cdddf1796427": "ush",
};
const resortOf = park => park ? (RESORT_OF[park.id] || (/walt disney world/i.test(park.dest || "") ? "wdw" : /disneyland resort/i.test(park.dest || "") ? "dlr" : /universal orlando/i.test(park.dest || "") ? "uor" : /universal studios hollywood/i.test(park.dest || "") ? "ush" : "other")) : "other";
const ALL_MODES = { monorail: ["🚝", "Monorail"], skyliner: ["🚡", "Skyliner"], boat: ["⛴️", "Boat"], ferry: ["🛳️", "Ferry"], taxi: ["🚤", "Water taxi"],
  bus: ["🚌", "Bus"], shuttle: ["🚌", "Shuttle"], tram: ["🚋", "Tram"], walk: ["🚶", "Walking"], car: ["🚗", "Minnie Van / car"], rideshare: ["🚗", "Car / rideshare"] };
const MODES_AT = { wdw: ["monorail", "skyliner", "boat", "ferry", "bus", "walk", "car"], dlr: ["monorail", "tram", "shuttle", "walk", "rideshare"],
  uor: ["taxi", "shuttle", "walk", "rideshare"], ush: ["shuttle", "tram", "walk", "rideshare"], other: ["bus", "shuttle", "boat", "tram", "walk", "rideshare"] };
const MODES = Object.entries(ALL_MODES).map(([k, [ic, l]]) => [k, ic, l]);
const modesAt = park => (MODES_AT[resortOf(park)] || MODES_AT.other).map(k => [k, ...ALL_MODES[k]]);
const PLACES_AT = {
  wdw: ["Disney Springs", "Transportation and Ticket Center", "Contemporary Resort", "Polynesian Village Resort", "Grand Floridian Resort", "Wilderness Lodge", "Fort Wilderness",
    "Riviera Resort", "Caribbean Beach Resort", "Pop Century Resort", "Art of Animation Resort", "BoardWalk Inn", "Beach Club Resort", "Yacht Club Resort", "Swan and Dolphin",
    "Port Orleans Riverside", "Port Orleans French Quarter", "Saratoga Springs", "Old Key West", "Animal Kingdom Lodge", "Coronado Springs", "All-Star Resorts"],
  dlr: ["Downtown Disney", "Disneyland Hotel", "Grand Californian Hotel", "Pixar Place Hotel", "Mickey and Friends parking", "Toy Story parking", "Harbor Blvd"],
  uor: ["CityWalk", "Volcano Bay", "Portofino Bay Hotel", "Hard Rock Hotel", "Royal Pacific Resort", "Sapphire Falls Resort", "Aventura Hotel", "Cabana Bay Beach Resort",
    "Endless Summer Resort", "Stella Nova Resort", "Terra Luna Resort", "Helios Grand Hotel"],
  ush: ["CityWalk Hollywood", "Hilton Universal City", "Sheraton Universal"], other: [],
};
const modeOf = k => MODES.find(m => m[0] === k);
const TYPE_NAME = { A: "Ride", S: "Show", R: "Food", C: "Stop", Q: "" };
// Closed = the park says so (down, refurbishment, closed today). Restaurants and walk-throughs with no status count as open.
const isClosed = i => !!(i && i.s && i.s !== "OPERATING");
function ClosedToggle({ on, set }) {
  return <label className="closed-toggle"><input type="checkbox" checked={on} onChange={e => set(e.target.checked)} /> Include closed</label>;
}
// Stream-friendly show names: drop "Disney's" and "at Mickey's Not-So-Scary Halloween Party" style tails
const cleanShow = n => String(n || "").replace(/[\u00ae\u2122]/g, "").replace(/^Disney['\u2019]?s?\s+/i, "")
  .replace(/\s+at\s+(Mickey['\u2019]s|Disney|EPCOT International)\b.*$/i, "").replace(/\s+Concert Series\b.*$/i, "").replace(/\s+Presented by\b.*$/i, "").trim();
const MEET = /\bmeet\b|greet/i;
// Nighttime spectaculars and parades, so they don't get lost in the full show list
const PARADE = /parade|cavalcade|processional|starlight|electrical|paint the night|magic happens/i;
const NIGHT = /firework|happily ever after|luminous|fantasmic|world of color|wondrous journeys|harmonious|enchantment|halloween screams|spooky spectacular|believe|nighttime|symphony|kaleidoscope|drone|shadows of memory|beacons|rising moons|night.*lights|christmas.*spectacular|holiday.*(sky|spectacular)|minnie.*wonderful/i;
const NOT_NIGHT = /stunt|dining|package|meet|parade|cavalcade/i;
const ONLY = { night: n => NIGHT.test(n) && !NOT_NIGHT.test(n), parade: n => PARADE.test(n), concert: n => CONCERT.test(n) };
// Concert: band typed by you, else tonight's band from the published lineup
const bandOf = (it, tz) => (it && (it.band || bandFor(it.n, tz))) || "";
const LOCAL = "parkday-state";
const SETTINGS = { countdown: true, within: 180, next: true, onLive: false, cdId: "" };   // cdId: plan stop the top countdown follows ("" = nothing ticked, no countdown)   // "On stream" controls
const BLANK = { parks: [], hereId: "", plan: [], cur: null, nextId: null, paused: null, settings: SETTINGS, updated: 0, v: 3 };
// ONE LIST: the day is S.plan; S.cur = the id of the stop that is NOW; NEXT is always worked out (nextItem);
// the top countdown = the stop with cd:true. Older saved days (now / nextId / settings.cdId) convert once here.
function normalize(S0) {
  const S = { ...BLANK, ...(S0 || {}) };
  S.settings = { ...SETTINGS, ...((S0 && S0.settings) || {}) };
  S.plan = (S.plan || []).map(p => ({ ...p }));
  if (S.v === 3) return S;
  if (S.v === 2) return toV3(S);
  if (S.settings.cdId) S.plan.forEach(p => { if (p.id === S.settings.cdId) p.cd = true; });
  const n = S.now || {};
  if (n.cat) {
    const it = n.item;
    if (it && it.n) {
      const ex = S.plan.find(p => !p.done && p.name === it.n);
      const extra = { ...(it.w != null ? { w: it.w } : {}), ...(it.band != null ? { band: it.band } : {}) };
      if (ex) { ex.cat = n.cat; ex.item = { ...(ex.item || {}), ...extra }; S.cur = ex.id; }
      else { const q = { id: uid(), name: it.n, type: it.t || "Q", parkId: S.hereId || "", time: "", done: false, cat: n.cat, item: Object.keys(extra).length ? extra : null }; S.plan.push(q); S.cur = q.id; }
    } else if (!NEEDS_PICK.includes(n.cat)) {
      const q = { id: uid(), name: (CATS.find(c => c.k === n.cat) || {}).label || n.cat, type: "Q", parkId: S.hereId || "", time: "", done: false, cat: n.cat, item: it || null };
      S.plan.push(q); S.cur = q.id;
    }
  }
  return toV3(S);
}
// v3: "In line" is a stage of any stop, not a kind of stop; a hand-picked NEXT (nextId) and a paused NOW
function toV3(S) {
  S.plan.forEach(p => { if (p.cat === "line") { p.cat = "ride"; p.stage = "line"; } });
  S.nextId = null; S.paused = null; S.v = 3;
  return S;
}
const loadLocal = () => { try { return normalize(JSON.parse(localStorage.getItem(LOCAL) || "{}")); } catch { return normalize({}); } };
const uid = () => Math.random().toString(36).slice(2, 10);
const GRACE = 30; // minutes a planned stop can run late and still be NEXT (the overlay uses the same)
const minusMin = (hhmm, m) => { const [h, mi] = hhmm.split(":").map(Number); const t = Math.max(0, h * 60 + mi - m); return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); };
const inTripOf = S => p => !p.parkId || S.parks.some(x => x.id === p.parkId);
const byTime = (a, b) => (a.time || "99:99").localeCompare(b.time || "99:99");

// ---------- what viewers see (also saved for the OBS overlay) ----------
// Changing the park you're at ends whatever you were doing at the old one
function setHere(s, id) {
  if (s.hereId !== id) { s.hereId = id; s.cur = null; }   // (ends whatever was NOW, travel too)
  return s;
}
function nowStop(S) { return (S.cur && S.plan.find(p => p.id === S.cur && !p.done)) || null; }
// NEXT = the earliest open stop (not NOW, parks in today's list) that is not more than 30 min late
function nextItem(S, tz) {
  const inTrip = p => !p.parkId || S.parks.some(x => x.id === p.parkId);
  if (S.nextId) { const pin = S.plan.find(p => p.id === S.nextId && !p.done && p.id !== S.cur && inTrip(p)); if (pin) return pin; }   // picked by hand
  const from = minusMin(nowIn(tz), GRACE);
  const open = S.plan.filter(p => !p.done && p.id !== S.cur && p.id !== S.paused && inTrip(p)).sort(byTime);
  return open.find(p => !p.time || p.time >= from) || null;
}
// What the NOW stop looks like on stream: its category + details (the old {cat, item} shape)
function nowOf(S) {
  const p = nowStop(S); if (!p) return { cat: null, item: null, stage: "" };
  let cat = p.cat || catForPlan(p) || "custom", stage = p.stage || (p.cat === "line" ? "line" : "doing");
  if (cat === "line") cat = "ride";   // a ride is a ride; "In line" is its stage
  if (p.type === "Q" || p.type === "C") stage = "doing";
  return { cat, stage, item: p.type === "Q" ? (p.item || null) : { ...(p.item || {}), n: p.name, t: p.type } };
}
// Stage buttons for the NOW stop: Walking there, In line, then the doing word for its kind
const DOING = { ride: "On ride", eat: "Eating", meet: "Meeting", fireworks: "Watching", parade: "Watching", concert: "Watching", show: "Watching" };
function nowText(S, here, data) {
  const N = nowOf(S);
  if (N.item && N.item.n && N.stage === "walk") return `Heading to ${N.item.t === "S" ? cleanShow(N.item.n) : N.item.n}`;
  if (N.item && N.item.n && N.stage === "line") return `In line: ${N.item.t === "S" ? cleanShow(N.item.n) : N.item.n}`;
  if (N.cat === "custom") return N.item ? N.item.n : "";
  const c = CATS.find(c => c.k === N.cat); if (!c) return "";
  const it = N.item;
  if ((NEEDS_PICK.includes(c.k) && !it) || (c.k === "travel" && !(it && it.mode))) return "";
  switch (c.k) {
    case "ride": return it ? `On a ride: ${it.n}` : "On a ride";
    case "line": {
      const live = it && data && data.items.find(i => i.n === it.n);
      const w = live ? live.w : it && it.w;
      return it ? `Waiting in line: ${it.n}${w ? ` · ${w} min posted` : ""}` : "Waiting in line";
    }
    case "eat": return it ? `Eating at ${it.n}` : "Grabbing a bite";
    case "fireworks": return it ? `Fireworks: ${it.n}` : "Fireworks";
    case "parade": return it ? `Parade: ${it.n}` : "Parade";
    case "concert": { const b = bandOf(it, data && data.tz); return it ? `Concert: ${b || cleanShow(it.n)}` : "Concert"; }
    case "show": return it ? `Watching ${it.n}` : "Watching a show";
    case "meet": return it ? `Meeting characters: ${it.n.replace(/^meet\s+/i, "")}` : "Meeting characters";
    case "shop": return "Shopping";
    case "explore": return here ? `Exploring ${here.name}` : "Exploring the park";
    case "hop": { const other = S.parks.find(p => p.id !== S.hereId); return other ? `Park hopping to ${other.name}` : "Park hopping"; }
    case "travel": { const m = it && modeOf(it.mode); return m ? `${m[2]}${it.to ? " to " + it.to : ""}` : "Getting around"; }
    default: return "";
  }
}
// Short park names for the stream card: "Disney's Hollywood Studios" -> "Hollywood Studios"
export const shortPark = n => String(n || "").replace(/^Disney['’]?s?\s+/i, "").replace(/\s+(Theme\s+)?Park$/i, "").replace(/^Universal['’]?s?\s+(?=Islands|Epic)/i, "").trim();
// NOW split into a small label, a big title and a small line under it
const NEEDS_PICK = ["ride", "line", "eat", "fireworks", "parade", "show", "meet", "concert"];
function nowParts(S, here, data) {
  const base = nowPartsBase(S, here, data), N = nowOf(S);
  if (!base || !N.item || !N.item.n) return base;
  if (N.stage === "walk") return { ...base, label: "Heading to", wait: 0 };
  if (N.stage === "line") {
    const live = data && data.items.find(i => i.n === N.item.n), w = live ? live.w : N.item.w;
    return { ...base, cat: "line", label: `In line${w ? ` · ${w} min wait` : ""}`, wait: w || 0 };
  }
  return base;
}
function nowPartsBase(S, here, data) {
  const N = nowOf(S), at = here ? shortPark(here.name) : "";
  if (N.cat === "custom") return N.item ? { cat: "custom", label: "", title: N.item.n, sub: at } : null;
  const c = CATS.find(c => c.k === N.cat); if (!c) return null;
  const it = N.item;
  if (NEEDS_PICK.includes(c.k) && !it) return null;              // nothing on stream until you pick which one
  if (c.k === "travel" && !(it && it.mode)) return null;          // ...or how you're getting there
  const P = (label, title, sub = at, extra = {}) => ({ cat: c.k, label, title, sub, ...extra });
  switch (c.k) {
    case "ride": {
      const live = it && data && data.items.find(i => i.n === it.n);
      const w = live ? live.w : it && it.w;
      return it ? P("On a ride", it.n, at, { wait: 0, posted: w || 0 }) : P("", "On a ride");
    }
    case "line": {
      const live = it && data && data.items.find(i => i.n === it.n);
      const w = live ? live.w : it && it.w;
      return it ? P(`In line${w ? ` · ${w} min wait` : ""}`, it.n, at, { wait: w || 0 }) : P("", "Waiting in line");
    }
    case "eat": return it ? P("Eating at", it.n) : P("", "Grabbing a bite");
    case "fireworks": return it ? P("Fireworks", cleanShow(it.n)) : P("", "Fireworks");
    case "parade": return it ? P("Parade", cleanShow(it.n)) : P("", "Parade");
    case "concert": { const b = bandOf(it, data && data.tz); return it ? (b ? P(cleanShow(it.n), b) : P("Concert", cleanShow(it.n))) : P("", "Concert"); }
    case "show": return it ? P("Watching", cleanShow(it.n)) : P("", "Watching a show");
    case "meet": return it ? P("Meeting", it.n.replace(/^meet\s+/i, "")) : P("", "Meeting characters");
    case "shop": return P("", "Shopping");
    case "explore": return at ? P("Exploring", at, "") : P("", "Exploring the park", "");
    case "hop": { const other = S.parks.find(p => p.id !== S.hereId); return other ? P("Park hopping to", shortPark(other.name), at ? `Leaving ${at}` : "") : P("", "Park hopping"); }
    case "travel": {
      const m = it && modeOf(it.mode), to = it && it.to ? it.to.trim() : "";
      if (!m) return P("", "Getting around", at ? `From ${at}` : "");
      const ride = m[0] === "walk" ? "Walking" : m[0] === "car" ? "Minnie Van" : m[0] === "rideshare" ? "Car" : m[2];
      return to ? P(`${ride} to`, to, at ? `From ${at}` : "", { mode: m[0] }) : P("", m[0] === "walk" ? "Walking over" : `Riding the ${m[2]}`, at ? `From ${at}` : "", { mode: m[0] });
    }
    default: return null;
  }
}
function planLabel(p, tz) {
  if (p.type !== "S") return p.name;
  const b = CONCERT.test(p.name) ? bandFor(p.name, tz) : "";
  return b ? `${cleanShow(p.name)}: ${b}` : cleanShow(p.name);
}
// What the top countdown follows: only the stop ticked with ⏱ (nothing ticked = no countdown)
function countdownStops(S) {
  const ok = p => !p.done && p.time && inTripOf(S)(p);
  return S.plan.filter(p => p.cd && ok(p)).slice(0, 1);
}
function buildDisplay(S, here, data) {
  const tz = (data && data.tz) || "America/New_York";
  const nx = nextItem(S, tz);
  return {
    now: nowText(S, here, data),
    nowParts: nowParts(S, here, data),
    pending: nowOf(S).cat && !nowParts(S, here, data) ? (CATS.find(c => c.k === nowOf(S).cat) || {}).label || "" : "",
    park: here ? shortPark(here.name) : "",
    parkId: here ? here.id : "",
    tz,
    next: nx ? { time: nx.time || "", label: planLabel(nx, tz) } : null,
    shows: countdownStops(S).map(p => ({ id: p.id, time: p.time, label: planLabel(p, tz), parkId: p.parkId })),
    settings: { ...SETTINGS, ...(S.settings || {}), cdId: (S.plan.find(p => p.cd && !p.done) || {}).id || "" },
  };
}

// ---------- small pieces ----------
// Keep hyphenated words ("Not-So-Spooky") on one line
const keepWords = t => String(t || "").split(/(\S*-\S*)/).map((x, i) => /-/.test(x) ? <span key={i} className="nb">{x}</span> : x);
function Preview({ d, ctl }) {
  const can = useContext(CanCtx);
  const p = d.nowParts;
  const lbl = p && p.label ? (p.wait ? p.label.replace(/\s*\u00b7.*$/, "") : p.label) : "";
  return (
    <div className="preview">
      {p ? (
        <div className="pv-now">
          <span className="chip now">NOW</span>
          <div className="pv-stack">
            {lbl && <div className="pv-lbl">{lbl}</div>}
            <div className="pv-title">{keepWords(p.title)}</div>
            {p.sub && <div className="pv-sub">{p.sub}</div>}
          </div>
          {p.wait ? <div className="pv-wait"><b>{p.wait}</b><small>MIN WAIT</small></div> : null}
          {ctl && ctl.canDone && (can("now.done") || can("now.pause")) && <span className="pv-btns">{can("now.done") && <button className="btn sun small" onClick={ctl.done}>✓ Done</button>}{can("now.pause") && <button className="btn ghost small" onClick={ctl.pause}>Pause</button>}</span>}
        </div>
      ) : ctl && ctl.paused ? <div className="pv-now"><div className="pv-val dim">Paused: <b>{ctl.paused}</b>. Nothing on stream.</div>{can("now.pause") && <button className="btn sun small pv-btn" onClick={ctl.resume}>Resume</button>}</div> : ctl && ctl.canDone ? <div className="pv-now"><div className="pv-val dim">{d.pending ? `${d.pending}: pick which one below.` : "Nothing on stream."}</div>{can("now.done") && <button className="btn ghost small pv-btn" onClick={ctl.done}>Clear</button>}</div> : <div className="pv-val dim">{d.pending ? (d.pending === "Getting around" ? "Getting around: pick how you're getting there below and it goes on stream." : `${d.pending}: pick which one below and it goes on stream. Nothing shows until then.`) : "Nothing on stream. Tap what you're doing below."}</div>}
      {ctl && ctl.stages && can("now.detail") && <div className="seg ctl stages">{ctl.stages.map(([k, l]) => <button key={k} className={ctl.stage === k ? "on" : ""} onClick={() => ctl.setStage(k)}>{l}</button>)}</div>}
      <div className="pv-row">{d.settings && d.settings.next === false ? <span className="pv-val dim">NEXT line is off (On stream controls).</span> : d.next ? <><span className="chip next">NEXT</span>{ctl && can("next") ? <button className="pv-next linkrow" onClick={ctl.pickNext}>{d.next.time && <b>{clock(d.next.time)}</b>}{d.next.label} <small className="chg">change</small></button> : <span className="pv-next">{d.next.time && <b>{clock(d.next.time)}</b>}{d.next.label}</span>}{ctl && ctl.nx && <span className="pv-ctl">{ctl.nx.time && <CountdownBox S={ctl.S} update={ctl.update} p={ctl.nx} />}{can("now.set") && <button className="btn small pv-btn" onClick={ctl.start}>▶ Next</button>}</span>}</> : ctl && can("next") ? <button className="btn ghost small" onClick={ctl.pickNext}>+ Pick what's NEXT</button> : <span className="pv-val dim">No next item. Add some in Plan.</span>}</div>
    </div>
  );
}
function Wait({ i }) {
  if (i.t !== "A") return null;
  if (!i.o) return <span className="wait closed">Closed</span>;
  if (i.w == null) return <span className="wait open">Open</span>;
  const w = i.w;
  return <span className={`wait ${w >= 45 ? "hot" : w <= 15 ? "ok" : ""}`}>{w}<small>MIN</small></span>;
}
function ItemRow({ i, sel, inPlan, onClick, tz }) {
  const band = i.t === "S" && CONCERT.test(i.n) ? bandFor(i.n, tz) : "";
  const meta = (band ? "Tonight: " + band + " · " : "") + (i.t === "S" ? (i.x && i.x.length ? i.x.slice(0, 4).map(clock).join(" · ") + (i.x.length > 4 ? " …" : "") : "No times today") : TYPE_NAME[i.t]);
  return (
    <button className={`item ${sel ? "sel" : ""}`} onClick={onClick}>
      <span className="nm">{i.t === "S" ? cleanShow(i.n) : i.n}<div className="meta">{i.pkName && <span className="tag park">{i.pkName}</span>}{isClosed(i) && <span className="tag closed">Closed</span>}{inPlan && <span className="tag">In plan</span>}{meta}</div></span>
      <Wait i={i} />
    </button>
  );
}
// Tap a showtime: add it to the plan (turns on the countdown), tap again to remove
const toggleShowTime = (update, i, parkId, x) => update(s => {
  const ex = s.plan.find(p => p.name === i.n && p.time === x && p.parkId === parkId);
  s.plan = ex ? s.plan.filter(p => p !== ex) : [...s.plan, { id: uid(), name: i.n, type: "S", parkId, time: x, done: false }];
  return s;
}, "Plan updated: " + clock(x));
// Show row on the Now tab: tap the name = Now; tap a time = add to plan
function ShowRow({ i, sel, inPlan, onClick, tz, plan, parkId, update, nowT }) {
  const can = useContext(CanCtx);
  const band = CONCERT.test(i.n) ? bandFor(i.n, tz) : "";
  return (
    <div className={`item block ${sel ? "sel" : ""}`}>
      <button className="nm-btn" onClick={onClick}>
        <span className="nm">{cleanShow(i.n)}<div className="meta">{i.pkName && <span className="tag park">{i.pkName}</span>}{isClosed(i) && <span className="tag closed">Closed</span>}{inPlan && <span className="tag">In plan</span>}{band ? "Tonight: " + band : sel ? "On stream now" : "Tap to put it on stream"}</div></span>
      </button>
      <div className="times">{i.x && i.x.length ? i.x.map(x => {
        const on = plan.some(p => p.name === i.n && p.time === x && p.parkId === parkId);
        return <button key={x} className={`time ${x < nowT ? "past" : ""} ${on ? "on" : ""}`} disabled={!can(on ? "plan.remove" : "plan.add")} onClick={() => toggleShowTime(update, i, parkId, x)}>{on ? "✓ " : ""}{clock(x)}</button>;
      }) : <span className="hint tight">No times today</span>}</div>
    </div>
  );
}
function Search({ value, onChange, placeholder }) {
  return <input className="search" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}

// ⏱ checkbox on a timed stop: that stop drives the TOP countdown (only one at a time; untick = no countdown)
function CountdownBox({ S, update, p, chip }) {
  const can = useContext(CanCtx);
  if (!p.time || p.done) return null;
  const on = !!p.cd;
  if (!can("cd.pick")) return on ? <span className={`cd-box ro on ${chip ? "chip" : ""}`} title="Top countdown">⏱{chip ? " Top countdown" : ""}</span> : null;
  return (
    <label className={`cd-box ${chip ? "chip" : ""} ${on ? "on" : ""}`} title="Top countdown">
      <input type="checkbox" checked={on} aria-label={"Top countdown for " + p.name}
        onChange={e => { const v = e.target.checked; update(s => { s.plan.forEach(x => { x.cd = v && x.id === p.id; }); return s; }, v ? "Top countdown: " + p.name : "Top countdown: nothing ticked"); }} />
      <span>⏱{chip ? " Top countdown" : ""}</span>
    </label>
  );
}

// Done with NOW: check off the matching plan stop, clear NOW, and if your next stop (at this park) starts
// within 5 minutes (or is up to 30 min late), put it on stream automatically. Returns the new NOW name or "".
const SOON = 5;
function catForPlan(p) {
  if (p.type === "R") return "eat";
  if (p.type === "A") return MEET.test(p.name) ? "meet" : "line";
  if (p.type === "S") return MEET.test(p.name) ? "meet" : CONCERT.test(p.name) ? "concert" : PARADE.test(p.name) ? "parade" : (NIGHT.test(p.name) && !NOT_NIGHT.test(p.name)) ? "fireworks" : "show";
  return "";   // your own custom stops have no NOW category, so they don't auto-start
}
// Make a stop NOW: whatever was NOW is checked off first
// Make a stop NOW. finish = the old NOW is checked off (Next, Done); otherwise it is only replaced:
// a quick add you never finished is dropped, a planned stop stays open in your plan.
function startStop(s, id, stage, finish) {
  const old = nowStop(s);
  if (old && old.id !== id) { if (finish) old.done = true; else if (old.adhoc) s.plan = s.plan.filter(x => x !== old); }
  const p = s.plan.find(x => x.id === id); if (!p) return "";
  p.done = false; p.stage = stage || p.stage || "doing"; s.cur = id; s.paused = null;
  if (s.nextId === id) s.nextId = null;
  return p.name;
}
function pauseNow(s) { const p = nowStop(s); if (!p) return ""; s.paused = p.id; s.cur = null; return p.name; }
function resumeNow(s) { const p = s.paused && s.plan.find(x => x.id === s.paused && !x.done); s.paused = null; if (!p) return ""; s.cur = p.id; return p.name; }
// Set NEXT by hand: reuse the open plan stop (same name + park; same time when a showtime was tapped), else add it
function setNext(s, tz, f) {
  if (f.planId) { s.nextId = f.planId; const p = s.plan.find(x => x.id === f.planId); return p ? p.name : ""; }
  const t = minsOf(nowIn(tz));
  const same = s.plan.filter(p => !p.done && p.id !== s.cur && p.name === f.name && p.type === f.type && (!f.pk || !p.parkId || p.parkId === f.pk) && (!f.time || p.time === f.time))
    .sort((a, b) => Math.abs((a.time ? minsOf(a.time) : t) - t) - Math.abs((b.time ? minsOf(b.time) : t) - t));
  let p = same[0];
  if (!p) { p = { id: uid(), name: f.name, type: f.type, parkId: f.pk || s.hereId || "", time: f.time || "", done: false, cat: f.cat, item: f.item || null }; s.plan.push(p); }
  s.nextId = p.id; return p.name;
}
// ✓ Done: check off NOW; if NEXT (at this park) starts within 5 min or is up to 30 min late, it becomes NOW
function finishNow(s, tz) {
  const old = nowStop(s); if (old) old.done = true;
  s.cur = null; s.paused = null;
  const nx = nextItem(s, tz);
  if (nx && nx.time && (!nx.parkId || nx.parkId === s.hereId)) {
    const d = minsOf(nx.time) - minsOf(nowIn(tz));
    if (d <= SOON && d >= -GRACE) return startStop(s, nx.id, "walk", false);   // on its way: Walking there
  }
  return "";
}
// ▶ Next: NEXT becomes NOW (NOW checked off)
function startNext(s, tz) { const nx = nextItem(s, tz); return nx ? startStop(s, nx.id, "walk", true) : ""; }
// Put something on as NOW from the category buttons: reuse an open plan stop with that name at this park
// (the one closest to now), otherwise add it to the plan at the current time
function goNow(s, tz, here, f) {
  const t = minsOf(nowIn(tz));
  const same = s.plan.filter(p => !p.done && p.name === f.name && p.type === f.type && (!here || !p.parkId || p.parkId === here.id))
    .sort((a, b) => Math.abs((a.time ? minsOf(a.time) : t) - t) - Math.abs((b.time ? minsOf(b.time) : t) - t));
  const ex = same[0];
  if (ex) { if (f.cat) ex.cat = f.cat; if (f.item) ex.item = { ...(ex.item || {}), ...f.item }; return startStop(s, ex.id, f.stage, false); }
  const p = { id: uid(), name: f.name, type: f.type, parkId: here ? here.id : "", time: nowIn(tz), done: false, cat: f.cat, item: f.item || null, adhoc: true };
  s.plan.push(p); return startStop(s, p.id, f.stage, false);
}

const WINDOWS = [[1440, "Right now"], [30, "30 min"], [60, "1 hr"], [180, "3 hrs"]];
const minsOf = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
function StreamControls({ S, display, update, tz }) {
  const can = useContext(CanCtx);
  const set = display.settings;
  const cs = can("cd.settings"), ds = can("display");
  if (!cs && !ds && !can("cd.pick")) return null;
  const setOpt = (k, v, msg) => update(s => { s.settings = { ...SETTINGS, ...(s.settings || {}), [k]: v }; return s; }, msg);
  const now = nowIn(tz);
  const ticked = S.plan.find(p => p.cd && !p.done);
  const cdStop = ticked || nextItem(S, tz);   // tick / untick right here, it stays put either way
  const show = (display.shows || []).filter(x => minsOf(x.time) + GRACE >= minsOf(now)).sort((a, b) => a.time.localeCompare(b.time))[0];
  let status;
  if (!set.countdown) status = "Countdown is off. Nothing counts down on stream.";
  else if (!show) status = ticked ? "The stop you ticked has passed or was checked off. Tick ⏱ on another stop in the Plan tab." : "Nothing ticked, so nothing counts down. Tick ⏱ on a stop in the Plan tab to start the countdown.";
  else {
    const left = minsOf(show.time) - minsOf(now);
    status = left <= 0 ? `On stream now: ${show.label} is HAPPENING NOW.`
      : left <= set.within ? `On stream now (top of the Now scene): ${show.label} starts in ${left >= 60 ? Math.floor(left / 60) + "h " : ""}${left % 60}m.`
      : `Counting down to ${show.label} at ${clock(show.time)}. It appears at ${clock(minusMin(show.time, set.within))}.`;
  }
  const Seg = ({ k, opts }) => (
    <div className="seg ctl">{opts.map(([v, l]) => <button key={String(v)} className={set[k] === v ? "on" : ""} onClick={() => setOpt(k, v, l === "On" || l === "Off" ? undefined : "Top countdown: " + l)}>{l}</button>)}</div>
  );
  return (
    <details className="card controls">
      <summary><span className="label">On stream controls</span><span className="ctl-sum">{set.countdown ? (set.within === 1440 ? "Countdown showing now" : "Countdown on") : "Countdown off"} · {set.next ? "NEXT on" : "NEXT off"}{set.onLive ? " · also on live" : ""}</span></summary>
      {cs && <div className="ctl-row"><span>Top countdown</span><Seg k="countdown" opts={[[true, "On"], [false, "Off"]]} /></div>}
      {cs && set.countdown && <div className="ctl-row"><span>Show it <small className="dim">(before the show)</small></span><Seg k="within" opts={WINDOWS} /></div>}
      {set.countdown && <p className="hint tight">Pick what it counts down to: tick <b>⏱</b> on a stop in your plan (Plan tab, or the ⏱ on the NEXT line at the top). Nothing ticked: no countdown.</p>}
      {set.countdown && cdStop && <div className="ctl-row"><span>Count down to <b>{cdStop.type === "S" ? planLabel(cdStop, tz) : cdStop.name}</b>{cdStop.time ? " · " + clock(cdStop.time) : ""}</span><CountdownBox S={S} update={update} p={cdStop} /></div>}
      <p className="hint tight ctl-status">{status}</p>
      {ds && <div className="ctl-row"><span>Show NEXT line</span><Seg k="next" opts={[[true, "On"], [false, "Off"]]} /></div>}
      {ds && <div className="ctl-row"><span>Also show the card on the live scene</span><Seg k="onLive" opts={[[true, "On"], [false, "Off"]]} /></div>}
      {ds && <p className="hint tight">The top countdown only ever shows in the Now scene. This switch just adds the Now card to the live scene.</p>}
    </details>
  );
}

// The top countdown, always in view on the Now tab: tick / untick here; the last stop stays so you can tick it back
function CountdownLine({ S, update, tz, on }) {
  const ticked = S.plan.find(p => p.cd && !p.done);
  const [lastId, setLastId] = useState(ticked ? ticked.id : "");
  useEffect(() => { if (ticked) setLastId(ticked.id); }, [ticked && ticked.id]);
  const t = ticked || S.plan.find(p => p.id === lastId && !p.done && p.time);
  return (
    <div className={`cdline ${ticked && on ? "on" : ""}`}>
      <span className="cd-ic">⏱</span>
      <span className="cd-txt">{t ? <><b>{ticked ? (on ? "Counting down to" : "Countdown switched off:") : "Countdown off:"}</b> {t.type === "S" ? planLabel(t, tz) : t.name}{t.time ? " · " + clock(t.time) : ""}</> : <span className="dim">No countdown. Tick ⏱ on a stop in Coming up or Plan.</span>}</span>
      {t && <CountdownBox S={S} update={update} p={t} />}
    </div>
  );
}

// ---------- the big button: whatever scene is up, go to the live scene (camera, no overlays) ----------
function GoLive({ bot, toast }) {
  const [busy, setBusy] = useState(false);
  const fresh = bot && bot.at && Date.now() - bot.at < 120000;
  const onLive = fresh && /^live$/i.test(bot.scene || "");
  const go = async () => {
    setBusy(true);
    const r = await sendCmd("scene.live");
    setBusy(false);
    toast(r.ok ? "Switching to LIVE…" : (r.error || "Couldn't reach the home PC"));
  };
  return (
    <div className="golive">
      <button className={`btn golive-btn ${onLive ? "is-live" : ""}`} onClick={go} disabled={busy}>{busy ? "Sending…" : onLive ? "✓ On LIVE scene (no overlays)" : "🎥 Switch to LIVE scene (overlays off)"}</button>
      <div className="golive-status">{fresh ? <>On air: <b>{bot.scene || "?"}</b>{bot.streaming === false ? " · not streaming" : ""}</> : "Home PC status unknown (helper not heard from yet)"}</div>
    </div>
  );
}

// ---------- moderators (Cierra only): name + code + what they may do ----------
const MOD_PERMS = [["scene", "GO LIVE button"], ["plan", "Change NOW / NEXT and the plan"]];
const newCode = () => { const w = ["TEACUP", "MONORAIL", "CASTLE", "SKYLINER", "DUMBO", "FIGMENT", "GOOFY", "PLUTO", "EPCOT", "TIKI"]; return w[Math.floor(Math.random() * w.length)] + "-" + Math.floor(1000 + Math.random() * 9000); };
function ModsManager() {
  const [mods, setMods] = useState(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [shown, setShown] = useState(null);   // { name, code } just created: shown once
  useEffect(() => { getMods().then(setMods).catch(() => setErr("Couldn't load moderators. Check your signal.")); }, []);
  const save = list => putMods(list).then(setMods).catch(() => setErr("Couldn't save. Try again."));
  const add = () => { const code = newCode(); const m = { id: uid(), name: name.trim() || "Mod", perms: ["scene", "plan"], active: true, code }; save([...(mods || []), m]); setShown({ name: m.name, code }); setName(""); };
  const edit = (id, fn) => save(mods.map(m => (m.id === id ? fn({ ...m }) : m)));
  return (
    <div className="card gap">
      <p className="label">Moderators</p>
      <p className="hint tight">Mods sign in to this same app with their own code. Turn a mod off any time.</p>
      {err && <p className="err">{err}</p>}
      {shown && <div className="modcode">Code for <b>{shown.name}</b>: <b className="code">{shown.code}</b><br /><small>Send it to them privately. It's shown only once.</small> <button className="linkish" onClick={() => setShown(null)}>Hide</button></div>}
      {mods && mods.map(m => (
        <div key={m.id} className={`item modrow ${m.active === false ? "gone" : ""}`}>
          <span className="nm">{m.name}<div className="meta">{MOD_PERMS.map(([k, l]) => (
            <label key={k} className="perm"><input type="checkbox" checked={(m.perms || []).includes(k)} onChange={e => edit(m.id, x => { x.perms = e.target.checked ? [...new Set([...(x.perms || []), k])] : (x.perms || []).filter(y => y !== k); return x; })} /> {l}</label>))}</div></span>
          <button className="btn ghost small" onClick={() => edit(m.id, x => { x.active = x.active === false; return x; })}>{m.active === false ? "Turn on" : "Turn off"}</button>
          <button className="x" aria-label={"Remove " + m.name} onClick={() => save(mods.filter(x => x.id !== m.id))}>×</button>
        </div>))}
      {mods && !mods.length && <p className="empty">No moderators yet.</p>}
      <div className="own gap"><input value={name} onChange={e => setName(e.target.value)} placeholder="Mod's name" /><button className="btn small" onClick={add} disabled={!mods}>+ Add mod</button></div>
    </div>
  );
}

// Sign out (every account): tap once to arm, tap again within 3 s, so a stray tap mid-stream doesn't log you out
function SignOut() {
  const [sure, setSure] = useState(false);
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t); }, [sure]);
  return <button className={`signout ${sure ? "sure" : ""}`} onClick={() => { if (!sure) return setSure(true); setCode(""); location.reload(); }}>{sure ? "Tap again" : "Sign out"}</button>;
}

// ---------- login ----------
function Login({ onDone }) {
  const [code, setC] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async e => {
    e.preventDefault(); setBusy(true); setErr("");
    setCode(code.trim());
    try { const w = await whoami(); if (w.role === "admin") throw new Error("That's the owner dashboard code. Open this address with /admin at the end."); if (w.role !== "owner" && w.role !== "mod") throw new Error("That code isn't for the planner."); onDone(); }
    catch (x) { setCode(""); setErr(x.auth ? "That passcode didn't work." : x.locked ? x.message : x.message || "Couldn't reach the server. Check your signal."); }
    setBusy(false);
  };
  return (
    <div className="app login">
      <h1 className="logo">Park <span>Day</span></h1>
      <p className="hint">Cruise &amp; Theme Park Guide</p>
      <form onSubmit={go} className="card">
        <label className="label" htmlFor="pc">Passcode</label>
        <input id="pc" className="search" type="password" autoComplete="current-password" value={code} onChange={e => setC(e.target.value)} />
        {err && <p className="err">{err}</p>}
        <button className="btn sun wide" disabled={!code || busy}>{busy ? "Checking…" : "Open"}</button>
      </form>
    </div>
  );
}

// ---------- main app ----------
export default function App() {
  const [authed, setAuthed] = useState(!!getCode());
  const [S, setS] = useState(loadLocal);
  const [tab, setTab] = useState("now");
  const [seg, setSeg] = useState("A");
  const [q, setQ] = useState("");
  const [planParkId, setPlanParkId] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [parkData, setParkData] = useState({});
  const [sync, setSync] = useState("ok"); // ok | sending | waiting
  const [toastMsg, setToast] = useState("");
  const dirty = useRef(false);
  const lastWait = useRef(null);
  const toastT = useRef();

  const here = S.parks.find(p => p.id === S.hereId) || S.parks[0] || null;
  const data = here ? parkData[here.id] : null;
  const display = useMemo(() => buildDisplay(S, here, data), [S, here, data]);

  const undoRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const toast = (m, undo) => { setToast(m); setCanUndo(!!undo); clearTimeout(toastT.current); toastT.current = setTimeout(() => { setToast(""); setCanUndo(false); }, undo ? 4500 : 1600); };
  const update = useCallback((fn, msg) => {
    setS(prev => { if (msg) undoRef.current = prev; const n = fn(structuredClone(prev)); n.updated = Date.now(); return n; });
    dirty.current = true;
    if (msg) toast(msg, true);
  }, []);
  const undo = () => { const prev = undoRef.current; if (!prev) return; undoRef.current = null; setS({ ...prev, updated: Date.now() }); dirty.current = true; toast("Undone"); };

  useEffect(() => {
    const w = (display.nowParts && display.nowParts.wait) || 0;
    const c = canRef.current;
    if (lastWait.current !== null && w !== lastWait.current && c && (c("now.set") || c("now.detail") || c("now.done"))) { dirty.current = true; setS(s => ({ ...s })); }
    lastWait.current = w;
  }, [display]);

  // new version? check when the app opens or comes back to the screen; reload once nothing is waiting to save
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    // unique link each time so no cache (phone or Cloudflare) can answer with an old version
    const check = () => fetch("/version.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.json()).then(v => {
      if (v.build && v.build !== __BUILD__) {
        let tried = ""; try { tried = sessionStorage.getItem("parkday-reloaded") || ""; } catch {}
        if (tried === v.build) { setUpdateReady(true); return; }            // already reloaded once for this version: just offer the button
        if (!dirty.current) { try { sessionStorage.setItem("parkday-reloaded", v.build); } catch {} location.reload(); } else setUpdateReady(true);
      }
    }).catch(() => {});
    check();
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, []);

  // keep a copy on the phone
  useEffect(() => { try { localStorage.setItem(LOCAL, JSON.stringify(S)); } catch {} }, [S]);

  // who is signed in (Cierra or a mod) + live link: changes from other phones/mods and the home PC's scene
  const [me, setMe] = useState({ role: "owner", name: "Cierra", perms: ["*"] });
  const [bot, setBot] = useState(null);   // { scene, streaming, at } from the home PC helper
  useEffect(() => { if (authed) whoami().then(setMe).catch(() => {}); }, [authed]);
  useEffect(() => {
    if (!authed) return;
    return liveLink(m => {
      if (m.type === "state" && m.state && !dirty.current) setS(prev => (m.state.updated > (prev.updated || 0) ? normalize(m.state) : prev));
      if (m.type === "status") setBot(m);
      if (m.type === "result") { toast(m.ok ? (m.msg || "Done on the home PC") : "Home PC: " + (m.error || "that didn't work")); if (m.scene) setBot(b => ({ ...(b || {}), scene: m.scene, at: Date.now() })); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);
  const can = useCallback(p => me.role === "owner" || (me.perms || []).includes("*") || (me.perms || []).includes(p), [me]);
  const canRef = useRef(can); canRef.current = can;
  // a mod with nothing but GO LIVE (or nothing at all) never saves; wait-time refreshes only from someone running NOW
  const writer = me.role === "owner" || (me.perms || []).some(k => k !== "scene");

  // first load: take the server copy if it's newer
  useEffect(() => {
    if (!authed) return;
    fetchState().then(srv => { if (srv && srv.updated && srv.updated > (S.updated || 0)) setS(normalize(srv)); })
      .catch(e => { if (e.auth) { setCode(""); setAuthed(false); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // save to the server (debounced), retry every 5 s when there's no signal
  useEffect(() => {
    if (!authed || !dirty.current) return;
    if (!writer) { dirty.current = false; return; }
    setSync("sending");
    let stop = false, timer;
    const attempt = () => saveState({ ...S, display })
      .then(() => { if (!stop) { dirty.current = false; setSync("ok"); } })
      .catch(e => {
        if (e.auth) { setCode(""); setAuthed(false); return; }
        // not allowed: say so and go back to what's really on stream
        if (e.forbidden) { dirty.current = false; setSync("ok"); toast(e.message.replace(/^Not allowed: /, "You don't have: ")); fetchState().then(srv => srv && setS(normalize(srv))).catch(() => {}); return; }
        if (!stop) { setSync("waiting"); timer = setTimeout(attempt, 5000); }
      });
    timer = setTimeout(attempt, 400);
    return () => { stop = true; clearTimeout(timer); };
  }, [S, display, authed, writer]);

  // park data for every park today; refresh the current park's waits every 2 minutes while open
  useEffect(() => {
    S.parks.forEach(p => { if (!parkData[p.id]) loadPark(p.id).then(d => setParkData(m => ({ ...m, [p.id]: { ...d, at: Date.now() } }))).catch(() => {}); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.parks]);
  useEffect(() => {
    if (!here) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") loadPark(here.id).then(d => setParkData(m => ({ ...m, [here.id]: { ...d, at: Date.now() } }))).catch(() => {}); }, 120000);
    return () => clearInterval(t);
  }, [here]);

  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const syncLabel = sync === "ok" ? "On stream ✓" : sync === "sending" ? "Sending…" : "Waiting for signal";
  return (
    <CanCtx.Provider value={can}><div className="app">
      {updateReady && <button className="update-bar" onClick={() => location.reload()}>New version ready. Tap to update.</button>}
      <header className="top"><h1>Park <span>Day</span></h1>{me.role === "mod" && <span className="modtag">Mod: {me.name}</span>}<span className={`sync ${sync !== "ok" ? "wait" : ""}`}>{syncLabel}</span><SignOut /></header>
      {me.role === "mod" && can("scene") && <GoLive bot={bot} toast={toast} />}
      {tab === "now" && <NowTab {...{ S, here, data, parkData, display, update, q, setQ, showClosed, setShowClosed }} />}
      {tab === "plan" && <PlanTab {...{ S, here, parkData, update, seg, setSeg, q, setQ, planParkId, setPlanParkId, showClosed, setShowClosed }} />}
      {tab === "parks" && <ParksTab {...{ S, here, display, update, me }} />}
      <nav className="tabs"><div className="in">
        {[["now", "📍", "Now"], ["plan", "🗓️", "Plan"], ["parks", "🎡", "Parks"]].map(([k, ic, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setQ(""); window.scrollTo(0, 0); }}><span className="ic">{ic}</span>{l}</button>
        ))}
      </div></nav>
      <div className={`toast ${toastMsg ? "show" : ""}`}>{toastMsg}{canUndo && <button className="undo" onClick={undo}>Undo</button>}</div>
    </div></CanCtx.Provider>
  );
}

// ---------- Now ----------
function NowTab({ S, here, data, parkData, display, update, q, setQ, showClosed, setShowClosed }) {
  const can = useContext(CanCtx);
  const [pickCat, setPickCat] = useState(null);          // a category you tapped and are choosing from (not on stream yet)
  const tz = data && data.tz;
  const N = nowOf(S), cur = nowStop(S), nx = nextItem(S, tz);
  const c = CATS.find(x => x.k === pickCat);
  const open = S.plan.filter(p => !p.done && p.id !== S.cur && inTripOf(S)(p)).sort(byTime);
  // every park added today, the one you're at first; each item remembers its park
  const multi = S.parks.length > 1;
  const parksOrdered = [...S.parks].sort((a, b) => (b.id === (here && here.id)) - (a.id === (here && here.id)));
  const allItems = parksOrdered.flatMap(pk => { const d = parkData[pk.id]; return d ? d.items.map(i => ({ ...i, pk: pk.id, tz: d.tz, pkName: multi ? shortPark(pk.name) : "" })) : []; });
  const loaded = S.parks.some(pk => parkData[pk.id]);
  let pool = [], inPlan = [];
  if (c && c.types.length && loaded) {
    const fits = n => (c.meet ? MEET.test(n) : c.only ? ONLY[c.only](n) : true);
    inPlan = S.plan.filter(p => inTripOf(S)(p) && c.types.includes(p.type) && !p.done && fits(p.name)).sort(byTime);
    pool = allItems.filter(i => c.types.includes(i.t) && fits(i.n) && (showClosed || !isClosed(i)) && (!q || i.n.toLowerCase().includes(q.toLowerCase())));
    const soon = i => { const n = nowIn(i.tz); const t = (i.x || []).find(x => x >= n); return t || "99:99"; };
    const hereFirst = (a, b) => (b.pk === (here && here.id)) - (a.pk === (here && here.id));
    pool.sort((a, b) => c.only ? (soon(a).localeCompare(soon(b)) || a.n.localeCompare(b.n)) : (hereFirst(a, b) || (b.o - a.o) || a.n.localeCompare(b.n)));
  }
  // run an action on a copy first so the toast can say what happened
  const act = (fn, okMsg, emptyMsg) => { const n = fn(JSON.parse(JSON.stringify(S))); update(s => { fn(s); return s; }, n ? okMsg + n : emptyMsg); };
  // picking something at another of today's parks means you're there now
  const put = f => { act(s => { if (f.pk && s.hereId !== f.pk) s.hereId = f.pk; return goNow(s, tz, f.pk ? { id: f.pk } : here, f); }, "Now: ", ""); setPickCat(null); setQ(""); };
  const kindOf = k => (k === "line" ? "ride" : k), stageOf = k => (k === "line" ? "line" : "doing");
  const pick = i => put({ name: i.n, type: i.t, cat: kindOf(c.k), stage: stageOf(c.k), item: i.w != null ? { w: i.w } : null, pk: i.pk });
  const pickPlanned = p => { act(s => { const x = s.plan.find(y => y.id === p.id); if (x) x.cat = kindOf(c.k); if (p.parkId && s.parks.some(k => k.id === p.parkId)) s.hereId = p.parkId; return startStop(s, p.id, stageOf(c.k), false); }, "Now: ", ""); setPickCat(null); setQ(""); };
  // Set NEXT from the panel under the card
  const nextTo = f => { act(s => setNext(s, tz, f), "Next: ", ""); setPickCat(null); setQ(""); };
  const stages = cur && N.item && N.item.n && DOING[N.cat] ? [["walk", "Walking there"], ["line", "In line"], ["doing", DOING[N.cat]]] : null;
  const nextPool = pickCat === "__next" ? allItems.filter(i => ["A", "S", "R"].includes(i.t) && (showClosed || !isClosed(i)) && (!q || i.n.toLowerCase().includes(q.toLowerCase()))) : [];
  const nextPlan = pickCat === "__next" ? S.plan.filter(x => !x.done && x.id !== S.cur && inTripOf(S)(x) && (!q || x.name.toLowerCase().includes(q.toLowerCase()))).sort(byTime) : [];
  const tapCat = x => { setQ(""); if (x.types.length) { setPickCat(pickCat === x.k ? null : x.k); return; } put({ name: x.label, type: "Q", cat: x.k, item: null }); };
  const isNow = n => !!(cur && cur.name === n);
  return (
    <main>
      <p className="label">What viewers see</p>
      <CountdownLine S={S} update={update} tz={tz} on={!(display.settings && display.settings.countdown === false)} />
      <Preview d={display} ctl={{ S, update, nx, canDone: !!cur,
        done: () => act(s => finishNow(s, tz), "Done. Now: ", "Done. Now cleared"),
        start: () => act(s => startNext(s, tz), "Now: ", "Nothing to start"),
        pause: () => act(s => pauseNow(s), "Paused: ", ""),
        paused: !cur && S.paused ? (x => (x ? (x.type === "S" ? planLabel(x, tz) : x.name) : ""))(S.plan.find(x => x.id === S.paused)) : "",
        resume: () => act(s => resumeNow(s), "Back on: ", ""),
        stages, stage: N.stage, setStage: k => update(s => { const x = nowStop(s); if (x) { x.stage = k; if (x.cat === "line") x.cat = "ride"; } return s; }, (stages.find(z => z[0] === k) || [])[1]),
        pickNext: () => { setQ(""); setPickCat(pickCat === "__next" ? null : "__next"); } }} />
      {pickCat === "__next" && (
        <div className="card gap nextpick">
          <div className="row between"><p className="label">Pick what's NEXT</p><button className="linkish" onClick={() => { setPickCat(null); setQ(""); }}>Cancel</button></div>
          <div className="search-row"><Search value={q} onChange={setQ} placeholder={multi ? "Search today's parks…" : here ? `Search ${here.name}…` : "Search…"} /><ClosedToggle on={showClosed} set={setShowClosed} /></div>
          {nextPlan.length > 0 && <><p className="label gap">From your plan</p><div className="list">{nextPlan.map(x => (
            <button key={x.id} className={`item ${nx && nx.id === x.id ? "sel" : ""}`} onClick={() => nextTo({ planId: x.id })}>
              <span className="nm">{x.type === "S" ? planLabel(x, tz) : x.name}<div className="meta">{x.time ? clock(x.time) : "No time"}{TYPE_NAME[x.type] ? " · " + TYPE_NAME[x.type] : ""}</div></span>
            </button>))}</div></>}
          <p className="label gap">Anything at {multi ? "today's parks" : here ? here.name : "the park"}</p>
          {!loaded && <p className="empty">Loading park data…</p>}
          <div className="list">{nextPool.slice(0, q ? 60 : 30).map(i => i.t === "S" ? (
            <div key={i.pk + i.id} className="item block">
              <button className="nm-btn" onClick={() => { const t = (i.x || []).find(x => x >= nowIn(i.tz)) || ""; nextTo({ name: i.n, type: "S", time: t, pk: i.pk }); }}>
                <span className="nm">{cleanShow(i.n)}<div className="meta">{i.pkName && <span className="tag park">{i.pkName}</span>}Tap the name for the next showing, or a time</div></span>
              </button>
              <div className="times">{i.x && i.x.length ? i.x.filter(x => x >= minusMin(nowIn(i.tz), 30)).map(x => <button key={x} className="time" onClick={() => nextTo({ name: i.n, type: "S", time: x, pk: i.pk })}>{clock(x)}</button>) : <span className="hint tight">No times today</span>}</div>
            </div>
          ) : <ItemRow key={i.pk + i.id} i={i} tz={i.tz} sel={!!(nx && nx.name === i.n)} onClick={() => nextTo({ name: i.n, type: i.t, pk: i.pk, item: i.w != null ? { w: i.w } : null })} />)}
          {loaded && !nextPool.length && <div className="empty">Nothing matches.</div>}</div>
        </div>
      )}
      {!pickCat && N.cat === "travel" && can("now.detail") && (
        <div className="card gap">
          <p className="label">How are you getting there?</p>
          <div className="cats modes">{modesAt(here).map(([k, ic, l]) => (
            <button key={k} className={`cat ${N.item && N.item.mode === k ? "on" : ""}`} onClick={() => update(s => { const p = nowStop(s); if (p) p.item = { ...(p.item || {}), mode: k }; return s; }, l)}><span className="ic">{ic}</span>{l}</button>
          ))}</div>
          <p className="label gap">Heading to <small>optional</small></p>
          <input className="search" list="places" value={(N.item && N.item.to) || ""} placeholder="Resort, Disney Springs, a park…"
            onChange={e => { const v = e.target.value; update(s => { const p = nowStop(s); if (p) p.item = { ...(p.item || { mode: "bus" }), to: v }; return s; }); }} />
          <datalist id="places">{[...S.parks.filter(p => resortOf(p) === resortOf(here)).map(p => shortPark(p.name)), ...(PLACES_AT[resortOf(here)] || [])].map(x => <option key={x} value={x} />)}</datalist>
        </div>
      )}
      {!pickCat && N.cat === "concert" && N.item && can("now.detail") && (
        <div className="card gap">
          <p className="label">Band on stream</p>
          <input className="search" value={N.item.band ?? bandFor(N.item.n, tz)} placeholder="Type the band"
            onChange={e => { const v = e.target.value; update(s => { const p = nowStop(s); if (p) p.item = { ...(p.item || {}), band: v }; return s; }); }} />
          <p className="hint tight">Filled in from Disney's published lineup. Change it if tonight's act is different.</p>
        </div>
      )}
      {can("now.set") && <><h2>Doing something else?</h2>
      <div className="cats">
        {CATS.map(x => (
          <button key={x.k} className={`cat ${(pickCat || (N.stage === "line" ? "line" : N.cat)) === x.k ? "on" : ""}`} onClick={() => tapCat(x)}>
            <span className="ic">{x.ic}</span>{x.label}
          </button>
        ))}
      </div>
      {c && c.types.length > 0 && (
        <>
          <h2>Which one? <small>{multi ? "all of today's parks" : here ? here.name : ""}</small></h2>
          <p className="hint tight">Nothing changes on stream until you pick one. <button className="linkish" onClick={() => { setPickCat(null); setQ(""); }}>Cancel</button></p>
          {!loaded && <p className="empty">{here ? "Loading park data…" : "Pick your park in the Parks tab first."}</p>}
          {inPlan.length > 0 && <><p className="label">From your plan</p><div className="list">{inPlan.map(p => { const i = allItems.find(x => x.n === p.name && x.pk === p.parkId) || { n: p.name, t: p.type }; return (
            <button key={p.id} className={`item ${isNow(p.name) ? "sel" : ""}`} onClick={() => pickPlanned(p)}>
              <span className="nm">{p.type === "S" ? planLabel(p, tz) : p.name}<div className="meta">{p.time ? clock(p.time) + " · " : ""}Tap to put it on stream</div></span>
              <Wait i={i} />
            </button>); })}</div>{loaded && <p className="label gap">Everything at {multi ? "today's parks" : here.name}</p>}</>}
          {loaded && <><div className="search-row"><Search value={q} onChange={setQ} placeholder={multi ? "Search today's parks…" : `Search ${here.name}…`} /><ClosedToggle on={showClosed} set={setShowClosed} /></div>
            {c.types.includes("S") && !c.meet && <p className="hint tight">Tap the name to put it on stream. Tap a time to add it to your plan.</p>}
            <div className="list">{pool.slice(0, 80).map(i => i.t === "S" && !c.meet
              ? <ShowRow key={i.pk + i.id} i={i} tz={i.tz} plan={S.plan} parkId={i.pk} update={update} nowT={nowIn(i.tz)} inPlan={S.plan.some(p => p.name === i.n && !p.done)} sel={isNow(i.n)} onClick={() => pick(i)} />
              : <ItemRow key={i.pk + i.id} i={i} tz={i.tz} sel={isNow(i.n)} onClick={() => pick(i)} />)}{!pool.length && <div className="empty">Nothing matches.</div>}</div></>}
        </>
      )}</>}
      <h2>Coming up <small>{open.length ? open.length + " in your plan" : ""}</small></h2>
      {open.length ? <div className="list">{open.map(p => (
        <div key={p.id} className={`item ${nx && nx.id === p.id ? "sel" : ""}`}>
          <span className="nm">{p.type === "S" ? planLabel(p, tz) : p.name}{nx && nx.id === p.id && <span className="nextflag">NEXT</span>}<div className="meta">{p.time ? clock(p.time) : "No time"}{TYPE_NAME[p.type] ? " · " + TYPE_NAME[p.type] : ""}</div></span>
          <CountdownBox S={S} update={update} p={p} />
          {can("now.set") && <button className="btn small" aria-label={"Start " + p.name + " now"} onClick={() => act(s => startStop(s, p.id, "walk", true), "Now: ", "")}>▶</button>}
        </div>))}</div>
        : <p className="empty">{S.plan.some(p => !p.done) ? "Nothing else coming up today." : "Your plan is empty. Add stops in Plan."}</p>}
      <StreamControls S={S} display={display} update={update} tz={tz} />
    </main>
  );
}

// ---------- time picker sheet ----------
function slots(tz, count = 10) {
  const [h, m] = nowIn(tz).split(":").map(Number);
  let mins = Math.ceil((h * 60 + m + 1) / 15) * 15; // next quarter hour
  const out = [];
  for (let k = 0; k < count && mins < 24 * 60; k++, mins += 15) out.push(String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0"));
  return out;
}
function TimeSheet({ title, sub, initial, tz, onSave, onClose }) {
  const [t, setT] = useState(initial || "");
  const quick = slots(tz);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Pick a time">
        <p className="label">What time?</p>
        <h3>{title}</h3>{sub && <p className="hint tight">{sub}</p>}
        <p className="label gap">Coming up</p>
        <div className="times">{quick.map(x => <button key={x} className={`time ${t === x ? "on" : ""}`} onClick={() => setT(x)}>{clock(x)}</button>)}</div>
        <p className="label gap">Or pick an exact time</p>
        <input className="search" type="time" value={t} onChange={e => setT(e.target.value)} aria-label="Exact time" />
        <div className="row gap">
          <button className="btn sun" onClick={() => onSave(t)} disabled={!t}>{t ? `Save ${clock(t)}` : "Pick a time"}</button>
          <button className="btn ghost" onClick={() => onSave("")}>No set time</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Plan ----------
function PlanTab({ S, here, parkData, update, seg, setSeg, q, setQ, planParkId, setPlanParkId, showClosed, setShowClosed }) {
  const can = useContext(CanCtx);
  const [cName, setCName] = useState("");
  const [cTime, setCTime] = useState("");
  const [sheet, setSheet] = useState(null); // { planId } to edit, or { add: item, parkId } to add
  const park = S.parks.find(p => p.id === planParkId) || here;
  const data = park ? parkData[park.id] : null;
  const t = nowIn(data && data.tz);
  const nx = nextItem(S, data && data.tz);
  let pool = data ? data.items.filter(i => i.t === seg && (showClosed || !isClosed(i)) && (!q || i.n.toLowerCase().includes(q.toLowerCase()))) : [];
  pool.sort((a, b) => (b.o - a.o) || a.n.localeCompare(b.n));
  const parkName = id => (S.parks.find(p => p.id === id) || {}).name || (id ? "not today (park removed)" : "");
  return (
    <main>
      <h2>Today's plan <small>{S.plan.length} stops</small></h2>
      <div className="list plan">
        {S.plan.slice().sort(byTime).map(p => (
          <div key={p.id} className={`item ${p.done ? "done" : ""} ${p.parkId && !S.parks.some(x => x.id === p.parkId) ? "gone" : ""}`}>
            <button className={`check ${p.done ? "done" : ""}`} aria-label="Done" disabled={!can("plan.check")} onClick={() => update(s => { const x = s.plan.find(x => x.id === p.id); x.done = !x.done; if (x.done && s.cur === x.id) s.cur = null; return s; }, p.done ? "Brought back" : "Checked off")}>{p.done ? "✓" : ""}</button>
            <button className={`tm ${p.time ? "" : "unset"}`} disabled={!can("plan.time")} onClick={() => setSheet({ planId: p.id })}>{p.time ? clock(p.time) : "Set time"}</button>
            <span className="nm">{p.type === "S" ? planLabel(p, data && data.tz) : p.name}{S.cur === p.id && !p.done && <span className="nextflag nowflag">NOW</span>}{nx && nx.id === p.id && <span className="nextflag">NEXT</span>}<div className="meta">{TYPE_NAME[p.type] || ""} · {parkName(p.parkId)}</div><CountdownBox S={S} update={update} p={p} chip /></span>
            {can("plan.remove") && <button className="x" aria-label="Remove" onClick={() => update(s => { s.plan = s.plan.filter(x => x.id !== p.id); if (s.cur === p.id) s.cur = null; return s; }, "Removed")}>×</button>}
          </div>
        ))}
        {!S.plan.length && <div className="empty">Nothing yet. Add rides, shows and food below, or your own stop.</div>}
      </div>
      {can("plan.add") && <><form className="custom" onSubmit={e => { e.preventDefault(); if (!cName.trim()) return; update(s => { s.plan.push({ id: uid(), name: cName.trim(), type: "C", parkId: here ? here.id : "", time: cTime, done: false }); return s; }, "Added to plan"); setCName(""); setCTime(""); }}>
        <input value={cName} onChange={e => setCName(e.target.value)} placeholder="Your own stop (Lunch, Skyliner…)" />
        <input type="time" value={cTime} onChange={e => setCTime(e.target.value)} aria-label="Time" />
        <button className="btn">Add</button>
      </form>

      <h2>Add from the park</h2>
      {!S.parks.length && <p className="empty">Pick today's parks in the Parks tab first.</p>}
      <div className="parks">{S.parks.map(p => <button key={p.id} className={`pk ${park && p.id === park.id ? "here" : "on"}`} onClick={() => { setPlanParkId(p.id); setQ(""); }}>{p.name}</button>)}</div>
      {park && <>
        <div className="seg">{[["A", "Rides"], ["S", "Shows"], ["R", "Food"]].map(([k, l]) => <button key={k} className={seg === k ? "on" : ""} onClick={() => { setSeg(k); setQ(""); }}>{l}</button>)}</div>
        <div className="search-row"><Search value={q} onChange={setQ} placeholder={`Search ${park.name}…`} /><ClosedToggle on={showClosed} set={setShowClosed} /></div>
        {!data && <p className="empty">Loading park data…</p>}
        <div className="list">
          {pool.map(i => {
            const planned = S.plan.filter(p => p.name === i.n && p.parkId === park.id);
            if (i.t === "S") return (
              <div key={i.id} className="item block">
                <span className="nm">{cleanShow(i.n)}{CONCERT.test(i.n) && bandFor(i.n, data && data.tz) ? <div className="meta">Tonight: {bandFor(i.n, data && data.tz)}</div> : null}</span>
                <div className="times">{i.x.length ? i.x.map(x => {
                  const on = planned.some(p => p.time === x);
                  return <button key={x} className={`time ${x < t ? "past" : ""} ${on ? "on" : ""}`} disabled={!can(on ? "plan.remove" : "plan.add")} onClick={() => update(s => {
                    const ex = s.plan.find(p => p.name === i.n && p.time === x && p.parkId === park.id);
                    s.plan = ex ? s.plan.filter(p => p !== ex) : [...s.plan, { id: uid(), name: i.n, type: "S", parkId: park.id, time: x, done: false }];
                    return s;
                  }, on ? "Removed" : "Added " + clock(x))}>{clock(x)}</button>;
                }) : <span className="hint tight">No times today</span>}</div>
              </div>
            );
            return (
              <div key={i.id} className="item">
                <span className="nm">{i.n}<div className="meta">{i.t === "A" ? (i.o ? "Open" : "Closed right now") : "Food"}</div></span>
                <Wait i={i} />
                {planned.length ? <button className="btn ghost small" onClick={() => setSheet({ planId: planned[0].id })}>{planned[0].time ? clock(planned[0].time) : "Set time"}</button> : <button className="btn small" onClick={() => setSheet({ add: i, parkId: park.id })}>+ Plan</button>}
              </div>
            );
          })}
          {data && !pool.length && <div className="empty">Nothing matches.</div>}
        </div>
      </>}</>}
      {sheet && (() => {
        const editing = sheet.planId && S.plan.find(p => p.id === sheet.planId);
        const title = editing ? editing.name : sheet.add.n;
        const pk = S.parks.find(p => p.id === (editing ? editing.parkId : sheet.parkId));
        const tz = (parkData[pk && pk.id] || {}).tz;
        return <TimeSheet title={title} sub={pk && pk.name} initial={editing ? editing.time : ""} tz={tz} onClose={() => setSheet(null)}
          onSave={t => { update(s => {
              if (editing) s.plan.find(x => x.id === editing.id).time = t;
              else s.plan.push({ id: uid(), name: sheet.add.n, type: sheet.add.t, parkId: sheet.parkId, time: t, done: false });
              return s; }, editing ? (t ? "Time set: " + clock(t) : "Time cleared") : "Added to plan" + (t ? " at " + clock(t) : ""));
            setSheet(null); }} />;
      })()}
    </main>
  );
}

// ---------- Parks ----------
const FAVORITE_DEST = /walt disney world|universal orlando|disneyland resort|universal studios hollywood|seaworld|busch/i;
function ParksTab({ S, here, display, update, me }) {
  const can = useContext(CanCtx);
  const [dests, setDests] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { loadDestinations().then(setDests).catch(() => setErr("Couldn't load the park list. Check your signal.")); }, []);
  const toggle = p => update(s => {
    const has = s.parks.some(x => x.id === p.id);
    s.parks = has ? s.parks.filter(x => x.id !== p.id) : [...s.parks, { id: p.id, name: p.name, dest: p.dest || "" }];
    if (!s.parks.some(x => x.id === s.hereId)) setHere(s, s.parks[0] ? s.parks[0].id : "");
    return s;
  }, S.parks.some(x => x.id === p.id) ? "Removed " + p.name : "Added " + p.name);
  const shown = dests ? dests.filter(d => q ? (d.name + " " + d.parks.map(p => p.name).join(" ")).toLowerCase().includes(q.toLowerCase()) : FAVORITE_DEST.test(d.name)) : [];
  return (
    <main>
      <h2>We're at now</h2>
      <p className="hint tight">Shows on stream. Tap it when you park hop.</p>
      <div className="parks">
        {S.parks.map(p => <button key={p.id} className={`pk ${here && p.id === here.id ? "here" : "on"}`} disabled={!can("park.here")} onClick={() => update(s => setHere(s, p.id), "Now at " + p.name)}>{here && p.id === here.id ? "📍 " : ""}{p.name}</button>)}
        {!S.parks.length && <p className="empty">Pick today's parks below.</p>}
      </div>
      {can("park.list") && <><h2>Parks today</h2>
      <Search value={q} onChange={setQ} placeholder="Search any park or resort…" />
      {err && <p className="err">{err}</p>}
      {!dests && !err && <p className="empty">Loading parks…</p>}
      {shown.map(d => (
        <div key={d.name} className="dest">
          <p className="label">{d.name}</p>
          <div className="parks">{d.parks.map(p => { const on = S.parks.some(x => x.id === p.id); return <button key={p.id} className={`pk ${on ? "on" : ""}`} onClick={() => toggle({ ...p, dest: d.name })}>{on ? "✓ " : ""}{p.name}</button>; })}</div>
        </div>
      ))}
      {dests && !q && <p className="hint">Showing Florida and California resorts. Search to find any other park.</p>}</>}
      <h2>On stream</h2>
      <Preview d={display} />
      {me && me.role === "mod" && <div className="card gap mycan"><p className="label">What you can do</p>{(me.perms || []).length ? <ul>{PERMS.filter(x => (me.perms || []).includes(x.k)).map(x => <li key={x.k}><b>{x.l}</b> <span className="dim">{x.h}</span></li>)}</ul> : <p className="hint tight">You can watch what viewers see. Ask Cierra if you need to change something.</p>}</div>}
      {me && me.role === "owner" && <p className="hint">Moderators and their permissions are managed in the owner dashboard: this same web address with /admin at the end.</p>}
      <button className="btn ghost small gap" onClick={() => { setCode(""); location.reload(); }}>Sign out on this phone</button>
      <p className="hint">App version {__BUILD__} (updates itself when you open it)</p>
    </main>
  );
}
