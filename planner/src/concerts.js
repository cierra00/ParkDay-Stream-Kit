// EPCOT concert lineups (ThemeParks.wiki has the times but not the bands).
// Source: Disney Parks Blog, "2026 EPCOT Eat to the Beat Concert Lineup" (checked against Disney Food Blog, Sept 2026).
// Add Garden Rocks here when Disney posts the spring lineup.
const EAT_TO_THE_BEAT_2026 = [
  ["2026-08-27", "2026-08-27", "Evolution: Motown"], ["2026-08-28", "2026-08-31", "Hanson"], ["2026-09-01", "2026-09-03", "Evolution: Motown"],
  ["2026-09-04", "2026-09-05", "The War and Treaty"], ["2026-09-06", "2026-09-07", "Yellowcard"], ["2026-09-08", "2026-09-10", "Fly Guys"],
  ["2026-09-11", "2026-09-12", "Couch"], ["2026-09-13", "2026-09-14", "Fitz and the Tantrums"], ["2026-09-15", "2026-09-17", "Latin Ambition"],
  ["2026-09-18", "2026-09-19", "MercyMe"], ["2026-09-20", "2026-09-21", "Grupo Manía"], ["2026-09-22", "2026-09-24", "Metro Latino Band"],
  ["2026-09-25", "2026-09-27", "Element"], ["2026-09-28", "2026-09-29", "New Found Glory"], ["2026-09-30", "2026-10-01", "Smash Mouth"],
  ["2026-10-02", "2026-10-04", "Champagne Orchestra"], ["2026-10-05", "2026-10-06", "Rey Ruiz"], ["2026-10-07", "2026-10-08", "Tiffany"],
  ["2026-10-09", "2026-10-11", "Viva Latina"], ["2026-10-12", "2026-10-13", "The Fray"], ["2026-10-14", "2026-10-15", "STARSHIP featuring Mickey Thomas"],
  ["2026-10-16", "2026-10-18", "Jaclyn Hayden"], ["2026-10-19", "2026-10-20", "Ben Rector"], ["2026-10-21", "2026-10-22", "Allen Stone"],
  ["2026-10-23", "2026-10-25", "SoundUp"], ["2026-10-26", "2026-10-27", "Lauren Alaina"], ["2026-10-28", "2026-10-29", "Bowling For Soup"],
  ["2026-10-30", "2026-11-01", "Southbound"], ["2026-11-02", "2026-11-03", "Boyz II Men"], ["2026-11-04", "2026-11-05", "Big Head Todd and The Monsters"],
  ["2026-11-06", "2026-11-08", "M-80's"], ["2026-11-09", "2026-11-10", "Grace Potter"], ["2026-11-11", "2026-11-12", "The Beach Boys"],
  ["2026-11-13", "2026-11-16", "The Hooligans"],
];
export const CONCERT = /eat to the beat|garden rocks|concert series/i;
const dayIn = tz => new Intl.DateTimeFormat("en-CA", { timeZone: tz || "America/New_York" }).format(new Date());
// Tonight's band for a concert-series show name, or "" if unknown
export function bandFor(showName, tz) {
  if (!/eat to the beat/i.test(showName || "")) return "";
  const d = dayIn(tz);
  const hit = EAT_TO_THE_BEAT_2026.find(([a, b]) => d >= a && d <= b);
  return hit ? hit[2] : "";
}
