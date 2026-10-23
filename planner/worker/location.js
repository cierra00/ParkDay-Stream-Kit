// Location engine: turns a GPS fix from Moblin (RealtimeIRL format) into park, land and nearby ride names.
// Pure functions, no storage: the LiveHub Durable Object keeps the state and calls step().
// Only names leave this file for the stream; exact coordinates only go to the private check view.

export const LOC_DEFAULTS = {
  enabled: false,              // master switch (owner dashboard, Location tab)
  scene: "location",           // OBS main-canvas scene that turns GPS on
  vscene: "location Vertical", // Aitum Vertical scene that also turns it on
  closeM: 25,                  // "close to a ride": within this many meters of its dot (rides with a mapped outline: also anywhere inside it, see rides.js)
  dwellS: 10,                  // ... for this many seconds
  landM: 120,                  // land = land of the nearest tagged spot within this distance
  showRide: true,              // show the ride name when close
  delayS: 0,                   // the scene page waits this long before showing a change (0 to 300)
  fallback: "",                // text the scene shows when there is nothing to show ("" = hide the card)
  live: true,                  // also use GPS whenever OBS is streaming, on any scene (not only while the location scene is on air)
  map: false,                  // small round map above the card (shows your exact spot on stream)
  mapColor: "#1FB8B4",         // the map's border colour
  mapStyle: "photo",           // "photo" (USGS satellite) or "map" (USGS drawn map); both U.S. government, public domain
};
export const PARK_RADIUS = 100;   // a park counts only when a spot of it is this close (Disneyland and DCA are 234 m apart)
export const PARK_CONFIRM = 3;    // fixes in a row that must agree before the park changes
export const TRAVEL_MS = 3;       // faster than this (m/s) = travelling (Skyliner, monorail, bus)
export const RATE_MS = 3000;      // at most one fix every 3 seconds is used
export const FIX_MAX_AGE = 120e3; // older fixes are refused
export const FIX_MAX_AHEAD = 60e3;

// Spots that exist only during a separately ticketed party (Mickey's Not-So-Scary Halloween Party, Very Merry Christmas Party, After Hours ...)
export const PARTY_RE = /not-so-scary|very merry|merriest|after hours|jollywood|boo bash|h2o glow/i;
// Is a party on at this park right now? schedule = ThemeParks.wiki /schedule list. Party = a TICKETED_EVENT that is not Early Entry or
// Extended Evening. It counts from the day's regular closing (day guests must leave, so anyone still inside is at the party) to its end.
// Returns { start, end, name } or null.
export function partyNight(schedule, now) {
  const list = Array.isArray(schedule) ? schedule : [];
  for (const e of list) {
    if (e.type !== "TICKETED_EVENT" || /early entry|extended evening/i.test(e.description || "")) continue;
    const s = Date.parse(e.openingTime), end = Date.parse(e.closingTime);
    if (!Number.isFinite(s) || !Number.isFinite(end)) continue;
    let start = s;
    for (const o of list) {
      const c = Date.parse(o.closingTime);
      if (o.type === "OPERATING" && Number.isFinite(c) && c <= s && s - c <= 3 * 3600e3) start = Math.min(start, c);
    }
    if (now >= start && now < end) return { start, end, name: e.description || "Party" };
  }
  return null;
}

export function cleanConfig(c) {
  const n = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d; };
  const s = (v, d) => (typeof v === "string" ? v.trim().slice(0, 80) : d);
  c = c || {};
  return {
    enabled: c.enabled === true,
    scene: s(c.scene, LOC_DEFAULTS.scene),
    vscene: s(c.vscene, LOC_DEFAULTS.vscene),
    closeM: n(c.closeM, 5, 200, LOC_DEFAULTS.closeM),
    dwellS: n(c.dwellS, 0, 600, LOC_DEFAULTS.dwellS),
    landM: n(c.landM, 20, 500, LOC_DEFAULTS.landM),
    showRide: c.showRide !== false,
    delayS: n(c.delayS, 0, 300, LOC_DEFAULTS.delayS),
    fallback: typeof c.fallback === "string" ? c.fallback.slice(0, 80) : "",
    live: c.live !== false,
    map: c.map === true,
    mapColor: /^#[0-9a-fA-F]{6}$/.test(c.mapColor || "") ? c.mapColor : LOC_DEFAULTS.mapColor,
    mapStyle: c.mapStyle === "map" ? "map" : "photo",
  };
}

// meters between two {lat, lon}
export function dist(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// meters east / north of a point (for the check view's little map)
export function offset(from, to) {
  const r = Math.PI / 180;
  return { dx: Math.round((to.lon - from.lon) * r * 6371000 * Math.cos(from.lat * r)), dy: Math.round((to.lat - from.lat) * r * 6371000) };
}

// "Magic Kingdom Park" -> "Magic Kingdom". Keeps "Universal" (the greeter checks for it).
export function shortPark(name) {
  return String(name || "")
    .replace(/^Disney's\s+/i, "")
    .replace(/\s+Theme Park$/i, "")
    .replace(/\s+Water Park$/i, "")
    .replace(/^(Magic Kingdom|Disneyland|Disney California Adventure)\s+Park$/i, "$1")
    .replace(/\s+Orlando$/i, (m, i, s) => (/^Discovery Cove/i.test(s) ? "" : m))
    .trim();
}

// A park as stored: { id, name, spots: [{ id, n, t, lat, lon }], lands: [..], assign: { spotId: land | "-" }, custom: [{ id, n, lat, lon, land }] }
// -> model used by step(): every spot with its land, "-" = ignored, dup = one of 3+ spots on the exact same point (event listings)
export function parkModel(p, extras) {
  const assign = p.assign || {};
  const all = [];
  // shops, food carts and other guest spots from OpenStreetMap (extras.js); they take their land from the nearest tagged spot
  for (const x of extras || []) if (Number.isFinite(x.lat) && Number.isFinite(x.lon) && assign[x.id] !== "-") all.push({ id: x.id, n: x.n, t: x.t, lat: x.lat, lon: x.lon, land: assign[x.id] || null });
  for (const s of p.spots || []) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
    const a = assign[s.id];
    if (a === "-") continue;
    all.push({ id: s.id, n: s.n, t: s.t || "A", lat: s.lat, lon: s.lon, land: a || null });
  }
  for (const c of p.custom || []) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon) || !c.n) continue;
    all.push({ id: c.id, n: c.n, t: ["A", "S", "R", "H", "P"].includes(c.t) ? c.t : "C", lat: c.lat, lon: c.lon, land: c.land || null, own: true });
  }
  const at = new Map();
  for (const s of all) { const k = s.lat.toFixed(5) + "," + s.lon.toFixed(5); at.set(k, (at.get(k) || 0) + 1); }
  for (const s of all) s.dup = at.get(s.lat.toFixed(5) + "," + s.lon.toFixed(5)) >= 3 && s.t !== "C";
  return { id: p.id, name: p.name, short: shortPark(p.name), spots: all };
}

// Is a point inside an outline? (ray casting; outline = [[lat, lon], ...])
export function inside(pt, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ay, ax] = poly[i], [by, bx] = poly[j];
    if ((ay > pt.lat) !== (by > pt.lat) && pt.lon < ((bx - ax) * (pt.lat - ay)) / (by - ay) + ax) hit = !hit;
  }
  return hit;
}
// Meters from a point to an outline's edge; 0 when inside.
export function edgeM(pt, poly) {
  if (inside(pt, poly)) return 0;
  const r = Math.PI / 180, kx = 6371000 * r * Math.cos(pt.lat * r), ky = 6371000 * r;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = (poly[j][1] - pt.lon) * kx, ay = (poly[j][0] - pt.lat) * ky, bx = (poly[i][1] - pt.lon) * kx, by = (poly[i][0] - pt.lat) * ky;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
// Size of an outline (only to compare outlines; square degrees), cached
const AREAS = new WeakMap();
export function polyArea(poly) {
  if (!poly) return Infinity;
  let v = AREAS.get(poly);
  if (v === undefined) { v = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) v += poly[j][1] * poly[i][0] - poly[i][1] * poly[j][0]; v = Math.abs(v) / 2; AREAS.set(poly, v); }
  return v;
}
// Meters from a point to a line ([[lat, lon], ...])
export function lineM(pt, line) {
  const r = Math.PI / 180, kx = 6371000 * r * Math.cos(pt.lat * r), ky = 6371000 * r;
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const ax = (line[i - 1][1] - pt.lon) * kx, ay = (line[i - 1][0] - pt.lat) * ky, bx = (line[i][1] - pt.lon) * kx, by = (line[i][0] - pt.lat) * ky;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
// What you are riding when travelling: the nearest transport line within 35 m (monorail, Skyliner, boats, railroads), or null
export function rideLine(pt, lines) {
  let best = null;
  for (const l of lines || []) { const d = lineM(pt, l.p); if (d <= 35 && (!best || d < best.d)) best = { n: l.n, d }; }
  return best ? best.n : null;
}
// Resort hotel or area at a point (outside the parks): the containing place with the nearest center, or null
export function placeAt(pt, places) {
  let best = null;
  for (const p of places || []) {
    if (!inside(pt, p.p)) continue;
    const d = dist(pt, { lat: p.c[0], lon: p.c[1] });
    if (!best || d < best.d) best = { p, d };
  }
  return best ? best.p : null;
}

export function freshState() { return { park: undefined, pend: null, pendN: 0, land: null, near: null, cand: null, candSince: 0, travel: false, fixAt: 0 }; }

// One GPS fix -> new state, what the scene shows, what the private check view shows, and log events.
// fix = { lat, lon, speed, t (ms) }. models = [parkModel]. planNames = Set of names in today's plan (preferred as "near").
// opts.dry = test mode: no waiting (park and ride decided from this one fix).
// opts.partyIds = Set of spot ids that are party-only by list (Halloween Horror Nights). opts.omit = Set of spot ids never shown as "Near". opts.hideParty = leave out party-only spots (PARTY_RE). opts.shapes = ride outlines by spot id (rides.js), opts.margin = meters around an outline that still count as close.
// opts.places = resort hotels and areas (places.js), used outside the parks; opts.area = the town name for this spot, if known.
export function step(prev, fix, models, cfg, planNames = new Set(), opts = {}) {
  const st = { ...(prev || freshState()) };
  const events = [];
  const here = { lat: fix.lat, lon: fix.lon };
  st.travel = Number(fix.speed) > TRAVEL_MS;
  st.fixAt = fix.t;

  // which park: the park of the nearest spot, if it is within PARK_RADIUS (inside a mapped ride outline counts as 0 m: big rides reach past 100 m from their dot)
  const SH = opts.shapes || {}, MG = Number.isFinite(opts.margin) ? opts.margin : 0;
  let best = null;
  for (const m of models) for (const s of m.spots) {
    let d = dist(here, s);
    if (d > MG && SH[s.id] && d < 1000 && edgeM(here, SH[s.id]) <= MG) d = 0;
    if (!best || d < best.d) best = { m, s, d };
  }
  // a park with a mapped boundary (opts.bounds) counts only inside it (10 m slack for GPS), so a station, dock or CityWalk
  // just outside the gate is not the park; parks without a boundary use the nearest-spot rule
  const B = opts.bounds || {};
  let guess = best && best.d <= PARK_RADIUS ? best.m.id : null;
  // inside a shopping district's edge (Disney Springs, Downtown Disney, CityWalk) = that district, even when a park's spot is nearer
  const inDistrict = models.find(m => String(m.id).startsWith("district-") && B[m.id] && inside(here, B[m.id]));
  if (inDistrict) guess = inDistrict.id;
  // inside a resort hotel's outline (Grand Californian, Disneyland Hotel...) and not inside a park's own mapped edge = at the hotel,
  // even when a park with no mapped edge is next door (Disney California Adventure)
  if (guess && !(B[guess] && inside(here, B[guess])) && (opts.places || []).some(p => p.k === "hotel" && inside(here, p.p))) guess = null;
  if (guess && B[guess] && !(inside(here, B[guess]) || edgeM(here, B[guess]) <= 10)) guess = null;
  if (!guess) { const m = models.find(m => B[m.id] && inside(here, B[m.id])); if (m) guess = m.id; }
  if (st.park === undefined || opts.dry) { st.park = guess; st.pend = null; st.pendN = 0; }
  else if (guess !== st.park) {
    if (st.pend === guess) st.pendN++; else { st.pend = guess; st.pendN = 1; }
    if (st.pendN >= PARK_CONFIRM) {
      const from = models.find(m => m.id === st.park), to = models.find(m => m.id === guess);
      events.push(to ? `Arrived at ${to.short}` : `Left ${from ? from.short : "the park"}`);
      st.park = guess; st.pend = null; st.pendN = 0; st.near = null; st.cand = null; st.land = null;
    }
  } else { st.pend = null; st.pendN = 0; }
  const model = models.find(m => m.id === st.park) || null;

  // distances to every spot of the current park: d = to its dot, m = to the ride itself (its outline when mapped, else its dot)
  const shapes = opts.shapes || {}, margin = Number.isFinite(opts.margin) ? opts.margin : 0;
  // shows with no building of their own (fireworks, parades, Luminous and other lagoon shows, street performers) are never
  // picked by GPS: you watch them from all over, so set them with NOW / NEXT instead (Cierra, Oct 4)
  const showOn = s => s.t !== "S" || !!shapes[s.id];
  const ranked = model ? model.spots.filter(s => !(opts.hideParty && (PARTY_RE.test(s.n) || (opts.partyIds && opts.partyIds.has(s.id)))) && showOn(s)).map(s => { const d = dist(here, s), sh = shapes[s.id], e = sh ? edgeM(here, sh) : Infinity; return { s, d, e, m: Math.min(d, e) }; }).sort((a, b) => a.m - b.m) : [];
  const closeTo = x => x.d <= cfg.closeM || x.e <= margin;
  const farFrom = id => { const x = ranked.find(y => y.s.id === id); return !x || (x.d > cfg.closeM * 2 && x.e > margin * 2); };
  const prevNear = st.near ? st.near.id : null, wasRiding = !!(st.rideUntil > fix.t - 3000 && st.near && st.rideId === st.near.id);
  // moving fast inside a ride's outline is riding it, not travelling (coasters, boats); riding stays on for 15 s after slowing down
  const fast = Number(fix.speed) > TRAVEL_MS;
  const inRide = model ? ranked.find(x => x.e <= margin && !x.s.dup && !(opts.omit && opts.omit.has(x.s.id))) : null;
  if (fast && inRide) { st.travel = false; st.rideUntil = fix.t + 15000; st.rideId = inRide.s.id; }

  // land: inside a section's mapped outline (smallest wins), else the land of the nearest tagged spot within landM
  const area = model && model.areas ? model.areas.filter(a => inside(here, a.p)).sort((a, b) => polyArea(a.p) - polyArea(b.p))[0] : null;
  const tagged = ranked.find(x => x.s.land && x.m <= cfg.landM);
  st.land = area ? area.land : tagged ? tagged.s.land : null;

  // close to a ride: stay within closeM for dwellS
  if (st.travel || !model) { st.cand = null; st.near = null; }
  else {
    // walked (or jumped) well away from the ride we were "near": drop it, even if another ride is now a candidate
    if (st.near && farFrom(st.near.id)) st.near = null;
    const riding = x => (st.rideUntil > fix.t && st.rideId === x.s.id ? 1 : 0);
    // a ride you are inside (or standing at its entrance dot) beats a shop or food stand built into it (exit shops, carts)
    // a spot you added yourself wins when you are inside the outline you drew for it
    const ownIn = x => (x.s.own && x.e === 0 ? 1 : 0);
    // inside a ride's outline counts as "at the ride" only when you came from the ride (its queue, its entrance or riding it):
    // walking in from outside, a shop or restaurant whose own smaller outline you are inside wins (Cierra, Oct 4)
    const atRide = x => (x.s.t === "A" && (x.d <= 8 || (x.e === 0 && prevNear === x.s.id)) ? 1 : 0);
    const cands = ranked.filter(x => !x.s.dup && closeTo(x) && !(opts.omit && opts.omit.has(x.s.id)))
      // order: the ride being ridden; a ride you are in or at; then places whose outline you are actually inside (the smallest outline wins, so a
      // restaurant inside a big ride area beats the ride); then today's plan, rides before shows and food, nearest first
      .sort((a, b) => (riding(b) - riding(a)) || (ownIn(b) - ownIn(a)) || (atRide(b) - atRide(a)) || ((b.e === 0) - (a.e === 0)) || (a.e === 0 && b.e === 0 ? polyArea(shapes[a.s.id]) - polyArea(shapes[b.s.id]) : 0)
        || (planNames.has(b.s.n) - planNames.has(a.s.n)) || ((b.s.t === "A") - (a.s.t === "A")) || (a.m - b.m) || (a.d - b.d));
    // stay on the ride you are on (Cierra, Oct 4): while you are still inside the outline of the ride shown now, an overlapping ride's
    // outline does not take over (Na'vi River vs Flight of Passage, Bowser Jr. vs Yoshi). Only the same kind sticks (ride vs ride,
    // show vs show): a restaurant or shop inside a ride area still takes over. It switches anyway when you are riding the other ride,
    // standing at its entrance, or inside a spot you added yourself.
    const inc = prevNear ? cands.find(x => x.s.id === prevNear && x.e <= margin) : null;
    const lead = cands[0];
    if (inc && lead && lead !== inc && lead.s.t === inc.s.t && !riding(lead) && !ownIn(lead) && lead.d > 8) cands.splice(cands.indexOf(inc), 1), cands.unshift(inc);
    const top = cands[0];
    if (top) {
      if (opts.dry) { st.near = { id: top.s.id, n: top.s.n, land: top.s.land }; st.cand = top.s.id; st.candSince = fix.t; }
      else if (st.cand === top.s.id) { if (fix.t - st.candSince >= cfg.dwellS * 1000) st.near = { id: top.s.id, n: top.s.n, land: top.s.land }; }
      else { st.cand = top.s.id; st.candSince = fix.t; }
    } else {
      st.cand = null;
      if (st.near && farFrom(st.near.id)) st.near = null;
    }
  }
  // how close: "riding" (fast inside its outline lately), "at" (inside its outline), or "near"
  const nx = st.near ? ranked.find(x => x.s.id === st.near.id) : null;
  const how = !st.near ? null : (st.rideUntil > fix.t && st.rideId === st.near.id) ? "riding" : nx && nx.e === 0 ? "at" : "near";
  if (!opts.dry) {
    if (st.near && st.near.id !== prevNear) events.push(`${how === "riding" ? "Riding" : how === "at" ? "At" : "Near"} ${st.near.n}`);
    else if (st.near && how === "riding" && !wasRiding) events.push(`Riding ${st.near.n}`);
  }

  // outside the parks: a resort hotel or area, else the town
  const place = model ? null : placeAt(here, opts.places);
  if ((place ? place.n : null) !== (st.place || null)) {
    if (place && !st.travel) events.push(`At ${place.n}`);
    st.place = place ? place.n : null;
  }
  const show = model
    ? { park: model.short, land: (st.near && st.near.land) || st.land || null, ride: cfg.showRide && st.near ? st.near.n : null, how: cfg.showRide && st.near ? how : null, travel: st.travel }
    : place
      ? { park: null, land: null, ride: null, travel: st.travel, place: place.n, kind: place.k, resort: place.r || opts.resort || null }
      : { park: null, land: null, ride: null, travel: st.travel, outside: true, area: opts.area || null };
  if (st.travel) { const via = rideLine(here, opts.lines); if (via) { show.via = via; } }
  const check = {
    lat: fix.lat, lon: fix.lon, speed: Number.isFinite(fix.speed) ? Math.round(fix.speed * 10) / 10 : null, at: fix.t,
    park: model ? model.short : null, place: show.place || null, area: show.area || null, land: show.land, near: st.near ? st.near.n : null, how, via: show.via || null, travel: st.travel,
    pending: st.pend !== null && st.pendN > 0 ? (models.find(m => m.id === st.pend) || { short: "outside the parks" }).short : null,
    nearby: (ranked.length ? ranked : (best ? [{ s: best.s, d: best.d }] : [])).slice(0, 8).map(x => ({ n: x.s.n, t: x.s.t, land: x.s.land, d: Math.round(x.m ?? x.d), ...offset(here, x.s) })),
  };
  return { state: st, show, check, events };
}

// Moblin's RealtimeIRL body -> fix, or an error text
export function parseFix(body, now) {
  if (!body || typeof body !== "object") return { error: "Bad body" };
  const lat = Number(body.latitude), lon = Number(body.longitude), speed = Number(body.speed), ts = Number(body.timestamp);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return { error: "Bad position" };
  const t = Number.isFinite(ts) ? Math.round(ts * 1000) : now;
  if (now - t > FIX_MAX_AGE || t - now > FIX_MAX_AHEAD) return { error: "Too old" };
  return { fix: { lat, lon, speed: Number.isFinite(speed) && speed >= 0 ? speed : 0, t } };
}
