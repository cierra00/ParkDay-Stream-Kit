// Live show times from the free ThemeParks.wiki API (https://api.themeparks.wiki).
// Shared by overlay.html and screens.html. No key needed.
(function(){
  const PARKS = {
    "magic kingdom":              { id:"75ea578a-adc8-4116-a54d-dccb60765ef9", tz:"America/New_York" },
    "epcot":                      { id:"47f90d2c-e191-4239-a466-5892ef59a88b", tz:"America/New_York" },
    "hollywood studios":          { id:"288747d1-8b4f-4a64-867e-ea7c9b27bad8", tz:"America/New_York" },
    "animal kingdom":             { id:"1c84a229-8862-4648-9c71-378ddd2c7693", tz:"America/New_York" },
    "disneyland":                 { id:"7340550b-c14d-4def-80bb-acdb51d49a66", tz:"America/Los_Angeles" },
    "california adventure":       { id:"832fcd51-ea19-4e77-85c7-75d5843b127c", tz:"America/Los_Angeles" },
    "universal studios florida":  { id:"eb3f4560-2383-4a36-9152-6b3e5ed6bc57", tz:"America/New_York" },
    "islands of adventure":       { id:"267615cc-8943-4c2a-ae2c-5da728ca591f", tz:"America/New_York" },
    "epic universe":              { id:"12dbb85b-265f-44e6-bccf-f1faa17211fc", tz:"America/New_York" },
    "universal studios hollywood":{ id:"bc4005c5-8c7e-41d7-b349-cdddf1796427", tz:"America/Los_Angeles" },
  };
  // Which shows count as "big" (get a countdown). Add names to plan.js watch: [...] for anything else.
  const HEADLINER = /parade|cavalcade|firework|happily ever after|luminous|fantasmic|starlight|enchantment|wondrous journeys|world of color|nighttime|harmonious|kaleidoscope|awakenings|beacons of magic|spelltacular|drone|movie magic|wonderful world of animation|rising moons|tapestry of happiness|shadows of memory|celestial goodnight|symphonic spectacular|not-so-spooky spectacular|halloween screams|believe in holiday magic|holiday magic|candlelight|processional|castle lighting|dream lights|seasons greetings|sunset seasons|minnie's wonderful christmastime|jollywood|new year/i;
  const NOT = /^meet |pianist|\bdans\b|philharmonic|flag retreat|\bdj\b|character|photo|stunt|sing-along|storytelling|band\b/i;

  function findPark(name){
    if (!name) return null;
    const n = String(name).toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
    if (PARKS[n]) return PARKS[n];
    const key = Object.keys(PARKS).find(k => n.includes(k) || k.includes(n));
    return key ? PARKS[key] : null;
  }
  function hhmmIn(date, tz){
    const p = new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
    return p.find(x => x.type==='hour').value + ':' + p.find(x => x.type==='minute').value;
  }
  function dayIn(date, tz){ return new Intl.DateTimeFormat('en-CA',{timeZone:tz}).format(date); } // YYYY-MM-DD
  function cleanName(n){
    return String(n).replace(/\s+at (Mickey's|Disney After Hours|Oogie|Disney Jollywood|Mickey's Very).*$/i,'')
      .replace(/^Disney['’]?s? /,'').replace(/:.*$/, m => m.length > 28 ? '' : m).trim();
  }

  // Returns [{time:"HH:MM", label, show:true, api:true}] for today's big shows at that park.
  async function fetchShows(parkName, opts = {}){
    const park = findPark(parkName);
    if (!park) return { shows: [], tz: null, ok: false, reason: 'unknown park' };
    const res = await fetch(`https://api.themeparks.wiki/v1/entity/${park.id}/live`, { cache: 'no-store' });
    if (!res.ok) return { shows: [], tz: park.tz, ok: false, reason: 'http ' + res.status };
    const data = await res.json();
    const today = dayIn(new Date(), park.tz);
    const watch = (opts.watch || []).map(s => String(s).toLowerCase());
    const skip = (opts.skip || []).map(s => String(s).toLowerCase());
    const out = [];
    for (const e of data.liveData || []){
      if (e.entityType !== 'SHOW' || !Array.isArray(e.showtimes)) continue;
      const name = e.name || '', lower = name.toLowerCase();
      if (skip.some(s => lower.includes(s))) continue;
      const watched = watch.some(s => lower.includes(s));
      // onlyWatch: the planner picked exact shows, so ignore the automatic headliner list
      const wanted = opts.onlyWatch ? watched : (watched || (HEADLINER.test(name) && !NOT.test(name)));
      if (!wanted) continue;
      for (const t of e.showtimes){
        if (!t.startTime) continue;
        const partyOnly = /special ticketed/i.test(t.type || '');
        if (partyOnly && !opts.party) continue;
        if (!partyOnly && opts.partyOnly) continue;
        const d = new Date(t.startTime);
        if (dayIn(d, park.tz) !== today) continue;
        out.push({ time: hhmmIn(d, park.tz), label: cleanName(name) || name, show: true, api: true });
      }
    }
    // de-duplicate
    const seen = new Set();
    return { shows: out.filter(s => { const k = s.label + s.time; if (seen.has(k)) return false; seen.add(k); return true; }), tz: park.tz, ok: true };
  }

  // Every show at the park today (for the planner's pick list).
  async function listShows(parkName){
    const park = findPark(parkName);
    if (!park) return { ok:false, shows:[], tz:null };
    const res = await fetch(`https://api.themeparks.wiki/v1/entity/${park.id}/live`, { cache:'no-store' });
    if (!res.ok) return { ok:false, shows:[], tz:park.tz };
    const data = await res.json(), today = dayIn(new Date(), park.tz), out = [];
    for (const e of data.liveData || []){
      if (e.entityType !== 'SHOW' || !Array.isArray(e.showtimes)) continue;
      const times = e.showtimes.filter(t => t.startTime && dayIn(new Date(t.startTime), park.tz) === today)
        .map(t => ({ time: hhmmIn(new Date(t.startTime), park.tz), party: /special ticketed/i.test(t.type || '') }));
      if (!times.length) continue;
      out.push({ name: e.name, label: cleanName(e.name) || e.name, times, headliner: HEADLINER.test(e.name) && !NOT.test(e.name) });
    }
    out.sort((a,b) => (b.headliner - a.headliner) || a.times[0].time.localeCompare(b.times[0].time));
    return { ok:true, shows: out, tz: park.tz };
  }

  window.CTPG_PARKDATA = { fetchShows, listShows, findPark, PARKS };
})();
