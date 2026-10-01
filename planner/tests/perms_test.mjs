import { missingPerm, expandPerms, ROLES } from "../src/perms.js";
const base = () => ({ v: 3, parks: [{ id: "ep", name: "EPCOT" }, { id: "mk", name: "MK" }], hereId: "ep", cur: "a", nextId: null, paused: null,
  settings: { countdown: true, within: 180, next: true, onLive: false, cdId: "" },
  plan: [{ id: "a", name: "Soarin", type: "A", parkId: "ep", time: "10:00", done: false, cat: "ride", stage: "line" },
         { id: "b", name: "Luminous", type: "S", parkId: "ep", time: "21:00", done: false },
         { id: "c", name: "Lunch", type: "C", parkId: "ep", time: "12:00", done: false }], display: { now: "x" } });
const C = o => JSON.parse(JSON.stringify(o));
const cases = [
  ["done NOW (auto-advance)", s => { s.plan[0].done = true; s.cur = "c"; s.plan[2].stage = "walk"; }],
  ["pause", s => { s.paused = "a"; s.cur = null; }],
  ["stage In line -> On ride", s => { s.plan[0].stage = "doing"; }],
  ["pick NEXT from plan", s => { s.nextId = "b"; }],
  ["pick NEXT new item", s => { s.plan.push({ id: "n", name: "Frozen", type: "A", parkId: "ep", time: "", done: false }); s.nextId = "n"; }],
  ["put something new on NOW", s => { s.plan.push({ id: "q", name: "Shopping", type: "Q", parkId: "ep", time: "11:00", done: false, cat: "shop", adhoc: true }); s.cur = "q"; }],
  ["tick countdown", s => { s.plan[1].cd = true; }],
  ["countdown off", s => { s.settings.countdown = false; }],
  ["NEXT line off", s => { s.settings.next = false; }],
  ["add stop", s => { s.plan.push({ id: "z", name: "Snack", type: "C", parkId: "ep", time: "15:00", done: false }); }],
  ["change time", s => { s.plan[2].time = "12:30"; }],
  ["check off in plan", s => { s.plan[2].done = true; }],
  ["remove stop", s => { s.plan = s.plan.filter(p => p.id !== "c"); }],
  ["park hop", s => { s.hereId = "mk"; s.cur = null; }],
  ["remove a park", s => { s.parks = s.parks.slice(0, 1); }],
  ["wait time refresh only", s => { s.display = { now: "y" }; }],
];
const who = { live: ROLES.live.perms, planner: ROLES.planner.perms, stream: ROLES.stream.perms, cohost: ROLES.cohost.perms, legacyPlan: expandPerms(["scene", "plan"]) };
const pad = (t, n) => (t + " ".repeat(n)).slice(0, n);
console.log(pad("change", 26) + Object.keys(who).map(k => pad(k, 12)).join(""));
for (const [name, fn] of cases) {
  const a = base(), b = C(a); fn(b);
  console.log(pad(name, 26) + Object.values(who).map(p => pad(missingPerm(p, a, b) ? "no" : "yes", 12)).join(""));
}
const single = { "now.done": "done NOW (auto-advance)", "now.pause": "pause", "now.detail": "stage In line -> On ride", next: "pick NEXT from plan", "cd.pick": "tick countdown", "cd.settings": "countdown off", display: "NEXT line off", "plan.add": "add stop", "plan.time": "change time", "plan.check": "check off in plan", "plan.remove": "remove stop", "park.here": "park hop", "park.list": "remove a park" };
let bad = 0;
for (const [k, own] of Object.entries(single)) for (const [name, fn] of cases) {
  const a = base(), b = C(a); fn(b);
  const ok = !missingPerm([k], a, b);
  if (name === own && !ok) { bad++; console.log("FAIL", k, "should allow", name, missingPerm([k], a, b)); }
}
console.log("no-change save:", missingPerm([], base(), base()) === null ? "allowed" : "blocked");
console.log("single-ability check failures:", bad);
