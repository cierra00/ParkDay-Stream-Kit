// Park data straight from ThemeParks.wiki (free, no key). Not routed through the Worker,
// so browsing rides, shows, food and waits costs no Worker requests.
const API = "https://api.themeparks.wiki/v1";
const TYPE = { ATTRACTION: "A", SHOW: "S", RESTAURANT: "R" };

export async function loadDestinations() {
  const r = await fetch(`${API}/destinations`);
  if (!r.ok) throw new Error("Could not load parks");
  const d = await r.json();
  return (d.destinations || [])
    .map(x => ({ name: x.name, parks: (x.parks || []).map(p => ({ id: p.id, name: p.name })) }))
    .filter(x => x.parks.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function hhmm(iso, tz) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  return p.find(x => x.type === "hour").value + ":" + p.find(x => x.type === "minute").value;
}
function dayIn(date, tz) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date); }

// -> { tz, items: [{ id, n, t: "A"|"S"|"R", o: open?, w: wait minutes|null, x: ["HH:MM", ...] }] }
export async function loadPark(parkId) {
  const [kids, live] = await Promise.all([
    fetch(`${API}/entity/${parkId}/children`).then(r => r.json()),
    fetch(`${API}/entity/${parkId}/live`).then(r => r.json()).catch(() => ({ liveData: [] })),
  ]);
  const tz = kids.timezone || "America/New_York";
  const today = dayIn(new Date(), tz);
  const byId = new Map((live.liveData || []).map(e => [e.id, e]));
  const items = [];
  for (const c of kids.children || []) {
    const t = TYPE[c.entityType];
    if (!t || /allergy request/i.test(c.name)) continue;
    const L = byId.get(c.id) || {};
    const w = L.queue && L.queue.STANDBY ? L.queue.STANDBY.waitTime : null;
    const x = [...new Set((L.showtimes || []).filter(s => s.startTime && dayIn(new Date(s.startTime), tz) === today).map(s => hhmm(s.startTime, tz)))].sort();
    items.push({ id: c.id, n: c.name, t, o: L.status === "OPERATING", s: L.status || null, w: typeof w === "number" ? w : null, x });
  }
  return { tz, items };
}

export function nowIn(tz) { return hhmm(new Date().toISOString(), tz || "America/New_York"); }
export const clock = t => { if (!t) return ""; let [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${h}:${String(m).padStart(2, "0")} ${ap}`; };
