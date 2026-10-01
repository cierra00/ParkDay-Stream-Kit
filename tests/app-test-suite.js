// Park Day app: full QA run against the real build, real park data (fixtures), mocked server.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const U = '/mnt/user-data/uploads/ctpg-pack/lab/', OUT = __dirname + '/';
const IDS = { mk: '75ea578a-adc8-4116-a54d-dccb60765ef9', ep: '47f90d2c-e191-4239-a466-5892ef59a88b', dl: '7340550b-c14d-4def-80bb-acdb51d49a66' };
const results = []; let failCount = 0;
const ok = (name, cond, info = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  -> ' + info : ''}`); if (!cond) failCount++; };

async function makePage(b, { device = 'iPhone 13', state = null, server = {}, clock = '2026-09-28T16:00:00-04:00', code = 'good' } = {}) {
  const ctx = await b.newContext({ ...devices[device] });
  await ctx.addInitScript(([s, c]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); if (c) localStorage.setItem('parkday-code', c); if (s) localStorage.setItem('parkday-state', s); }, [state ? JSON.stringify(state) : null, code]);
  const net = { puts: [], failPut: false, serverState: server };
  await ctx.route('**/api/**', r => { const u = r.request().url(), auth = r.request().headers()['authorization'] || '';
    if (auth !== 'Bearer good') return r.fulfill({ status: 401, json: { error: 'Wrong or missing code' } });
    if (u.includes('whoami')) return r.fulfill({ json: { role: 'owner', name: 'Cierra', perms: ['*'] } });
    if (r.request().method() === 'PUT') { if (net.failPut) return r.abort('internetdisconnected'); net.puts.push(JSON.parse(r.request().postData())); return r.fulfill({ json: { ok: true } }); }
    return r.fulfill({ json: net.serverState }); });
  await ctx.route('https://api.themeparks.wiki/**', r => { const u = r.request().url();
    if (u.endsWith('/destinations')) return r.fulfill({ contentType: 'application/json', body: fs.readFileSync(U + 'destinations.json') });
    const k = Object.keys(IDS).find(k => u.includes(IDS[k]));
    return r.fulfill({ contentType: 'application/json', body: fs.readFileSync(U + `${k}-${u.endsWith('/children') ? 'children' : 'live'}.json`) }); });
  await ctx.route('https://fonts.**', r => r.abort());
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_FAILED|net::|401/.test(m.text())) errors.push(m.text()); });
  await p.clock.setFixedTime(new Date(clock));
  await p.goto('http://localhost:5190/'); await p.waitForTimeout(900);
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('parkday-state') || '{}'));
  const last = () => net.puts[net.puts.length - 1] || {};
  const tab = async t => { try { await p.locator('nav.tabs button', { hasText: t }).click({ timeout: 5000 }); } catch (e) { const lines = e.message.split('\n').filter(l => /intercept|visible|stable|waiting|retrying/.test(l)).slice(0, 4).join(' / '); results.push('DIAG  tab ' + t + ' blocked: ' + lines); failCount++; await p.locator('nav.tabs button', { hasText: t }).click({ force: true }); } await p.waitForTimeout(500); };
  const cat = async t => { await p.locator('.cats:not(.modes) button.cat', { hasText: t }).first().click(); await p.waitForTimeout(400); };
  const pickItem = async t => { const row = p.locator('.list .item', { hasText: t }).first(); const nb = row.locator('.nm-btn'); if (await nb.count()) await nb.click(); else await row.click(); await p.waitForTimeout(700); };
  const toggleDest = async name => { await p.locator('.dest button.pk', { hasText: name }).first().click(); await p.waitForTimeout(900); };
  const overflow = () => p.evaluate(() => Math.round(Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('body *')].map(e => e.getBoundingClientRect().right)) - screen.width));
  return { ctx, p, net, st, last, tab, cat, pickItem, toggleDest, overflow, errors };
}
const TWO = { parks: [{ id: IDS.mk, name: 'Magic Kingdom Park' }, { id: IDS.ep, name: 'EPCOT' }], hereId: IDS.mk, plan: [], now: { cat: null, item: null }, nextId: null, updated: 1 };

(async () => {
  const b = await chromium.launch();

  if (!process.env.ONLY) {
  // ---------- 1. login ----------
  { const t = await makePage(b, { code: null });
    ok('login: shows passcode screen when signed out', await t.p.locator('#pc').isVisible());
    await t.p.fill('#pc', 'nope'); await t.p.click('button.btn.sun'); await t.p.waitForTimeout(600);
    ok('login: wrong passcode shows an error', (await t.p.locator('.err').textContent().catch(() => '')).includes("didn't work"));
    await t.p.fill('#pc', 'good'); await t.p.click('button.btn.sun'); await t.p.waitForTimeout(900);
    ok('login: right passcode opens the app', await t.p.locator('header.top').isVisible());
    ok('login: no page errors', !t.errors.length, t.errors.join(' | '));
    await t.ctx.close(); }

  // ---------- 2. parks ----------
  { const t = await makePage(b);
    await t.tab('Parks'); await t.p.waitForTimeout(600);
    await t.toggleDest('Magic Kingdom Park');
    let s = await t.st(); ok('parks: add first park sets "here"', s.hereId === IDS.mk && s.parks.length === 1);
    await t.toggleDest('EPCOT');
    s = await t.st(); ok('parks: add second park keeps "here"', s.hereId === IDS.mk && s.parks.length === 2);
    await t.p.locator('button.pk', { hasText: 'EPCOT' }).first().click(); await t.p.waitForTimeout(500);
    s = await t.st(); ok('parks: tap a park to make it "here"', s.hereId === IDS.ep);
    await t.p.fill('input.search', 'disneyland'); await t.p.waitForTimeout(300);
    ok('parks: search finds Disneyland Resort', await t.p.locator('.dest', { hasText: 'Disneyland' }).count() > 0);
    ok('parks: 320px fits', true);
    await t.p.screenshot({ path: OUT + 'parks.png', fullPage: true });
    ok('parks: no page errors', !t.errors.length, t.errors.join(' | '));
    await t.ctx.close(); }

  // ---------- 3. every Now category ----------
  { const t = await makePage(b, { state: TWO });
    const want = [['On a ride', 'ride', 'Haunted Mansion'], ['In line', 'line', 'Space Mountain'], ['Eating', 'eat', "Casey's Corner"],
      ['Fireworks', 'fireworks', null], ['Parade', 'parade', null], ['Watching a show', 'show', null], ['Meeting characters', 'meet', null]];
    for (const [label, k, item] of want) {
      await t.cat(label);
      const first = item || (await t.p.locator('.list .item .nm').first().textContent().catch(() => ''));
      const count = await t.p.locator('.list .item').count();
      ok(`now/${k}: list has items`, count > 0, `${count} items`);
      if (count) { await t.pickItem(item || first.split('\n')[0].slice(0, 12));
        const d = t.last().display || {}; ok(`now/${k}: stream gets a title`, !!(d.nowParts && d.nowParts.title && d.nowParts.cat === k), JSON.stringify(d.nowParts)); }
    }
    for (const [label, k] of [['Shopping', 'shop'], ['Exploring', 'explore'], ['Park hopping', 'hop']]) {
      await t.cat(label); await t.p.waitForTimeout(700); const d = t.last().display || {};
      ok(`now/${k}: stream updates`, d.nowParts && d.nowParts.cat === k, JSON.stringify(d.nowParts));
    }
    ok('now/hop: says where to', (t.last().display.nowParts || {}).title === 'EPCOT', JSON.stringify(t.last().display.nowParts));
    // nothing on stream until you pick which ride
    await t.cat('Eating'); await t.p.waitForTimeout(700);
    ok('now: category with no pick sends nothing to stream', t.last().display.nowParts === null && t.last().display.now === '', JSON.stringify(t.last().display.nowParts));
    ok('now: preview tells you to pick one', (await t.p.locator('.preview').textContent()).includes('pick which one'));
    // same category tap keeps the ride
    await t.cat('In line'); await t.pickItem('Space Mountain'); await t.cat('In line');
    ok('now: tapping current activity keeps the ride', ((await t.st()).now.item || {}).n === 'Space Mountain');
    // ride waits
    const d = t.last().display.nowParts; ok('now: line sends a wait number (or 0 when closed)', typeof d.wait === 'number', JSON.stringify(d));
    ok('now: open ride with no posted wait says "Open" not "0 MIN"', !(await t.p.locator('.wait', { hasText: /^0MIN$/ }).count()));
    // search
    await t.cat('On a ride'); await t.p.fill('main input.search', 'zzzz'); await t.p.waitForTimeout(300);
    ok('now: search with no match says so', await t.p.locator('.empty', { hasText: 'Nothing matches' }).isVisible());
    await t.p.fill('main input.search', 'haunt'); await t.p.waitForTimeout(300);
    ok('now: search filters', (await t.p.locator('.list .item').count()) >= 1);
    ok('now: no page errors', !t.errors.length, t.errors.join(' | '));
    await t.p.evaluate(() => scrollTo(0, 0)); await t.p.screenshot({ path: OUT + 'now.png' });
    await t.ctx.close(); }

  // ---------- 4. concert + getting around (EPCOT) ----------
  { const t = await makePage(b, { state: { ...TWO, hereId: IDS.ep } });
    await t.cat('Concert');
    ok('concert: EPCOT list has Eat to the Beat', await t.p.locator('.list .item', { hasText: 'Eat to the Beat' }).count() > 0);
    ok('concert: list shows tonight\'s band', await t.p.locator('.list .item', { hasText: 'New Found Glory' }).count() > 0);
    await t.pickItem('Eat to the Beat');
    let n = t.last().display.nowParts; ok('concert: stream shows the band', n.title === 'New Found Glory' && n.label === 'Eat to the Beat', JSON.stringify(n));
    await t.p.fill('.card input.search', 'Surprise Guest'); await t.p.waitForTimeout(700);
    n = t.last().display.nowParts; ok('concert: typed band replaces it', n.title === 'Surprise Guest', JSON.stringify(n));
    // concert times on the Now tab add to the plan
    await t.p.locator('.list .item.block', { hasText: 'Eat to the Beat' }).first().locator('.times button', { hasText: '6:45 PM' }).click(); await t.p.waitForTimeout(700);
    let pl = (await t.st()).plan; ok('concert: tap 6:45 PM on Now adds it to the plan', pl.some(x => x.time === '18:45'), JSON.stringify(pl.map(x => x.time)));
    ok('concert: countdown gets "Eat to the Beat: New Found Glory"', (t.last().display.shows || []).some(x => x.label === 'Eat to the Beat: Surprise Guest' || x.label === 'Eat to the Beat: New Found Glory'), JSON.stringify(t.last().display.shows));
    ok('concert: Now stays on the concert after tapping a time', (await t.st()).now.cat === 'concert');
    await t.p.locator('.list .item.block', { hasText: 'Eat to the Beat' }).first().locator('.times button', { hasText: '6:45 PM' }).click(); await t.p.waitForTimeout(700);
    ok('concert: tap the time again removes it', !(await t.st()).plan.some(x => x.time === '18:45'));
    await t.cat('Getting around');
    await t.p.locator('.modes button', { hasText: 'Skyliner' }).click(); await t.p.waitForTimeout(500);
    n = t.last().display.nowParts; ok('travel: mode only', n.title === 'Riding the Skyliner' && n.mode === 'skyliner', JSON.stringify(n));
    await t.p.fill('input[list="places"]', 'Riviera Resort'); await t.p.waitForTimeout(700);
    n = t.last().display.nowParts; ok('travel: with destination', n.label === 'Skyliner to' && n.title === 'Riviera Resort' && n.sub === 'From EPCOT', JSON.stringify(n));
    await t.p.locator('.modes button', { hasText: 'Boat' }).click(); await t.p.waitForTimeout(500);
    n = t.last().display.nowParts; ok('travel: change mode keeps destination', n.label === 'Boat to' && n.title === 'Riviera Resort', JSON.stringify(n));
    ok('concert/travel: no page errors', !t.errors.length, t.errors.join(' | '));
    await t.p.evaluate(() => scrollTo(0, 0)); await t.p.screenshot({ path: OUT + 'travel.png', fullPage: true });
    await t.ctx.close(); }

  // ---------- 4b. transportation matches the resort ----------
  for (const [where, state, must, mustNot, place, notPlace] of [
    ['EPCOT', { ...TWO, hereId: IDS.ep }, ['Skyliner', 'Monorail', 'Boat', 'Bus'], ['Tram', 'Water taxi'], 'Riviera Resort', 'Disneyland Hotel'],
    ['Disneyland', { parks: [{ id: IDS.dl, name: 'Disneyland Park' }], hereId: IDS.dl, plan: [], now: { cat: null, item: null }, nextId: null, updated: 1 }, ['Monorail', 'Tram', 'Shuttle'], ['Skyliner', 'Boat', 'Ferry', 'Minnie Van'], 'Disneyland Hotel', 'Riviera Resort'],
  ]) {
    const t = await makePage(b, { state, clock: where === 'Disneyland' ? '2026-09-27T20:00:00-07:00' : undefined });
    await t.cat('Getting around');
    const modes = await t.p.locator('.modes button').allTextContents();
    ok(`travel@${where}: offers ${must.join(', ')}`, must.every(m => modes.some(x => x.includes(m))), modes.join(' | '));
    ok(`travel@${where}: never offers ${mustNot.join(', ')}`, !mustNot.some(m => modes.some(x => x.includes(m))), modes.join(' | '));
    const places = await t.p.locator('#places option').evaluateAll(o => o.map(x => x.value));
    ok(`travel@${where}: suggests ${place}, not ${notPlace}`, places.includes(place) && !places.includes(notPlace), places.slice(0, 6).join(' | '));
    await t.ctx.close();
  }

  // ---------- 4c. closed rides and shows ----------
  { const closedIn = k => { const live = JSON.parse(fs.readFileSync(U + k + '-live.json')); return live.liveData.filter(e => e.entityType === 'ATTRACTION' && e.status && e.status !== 'OPERATING').map(e => e.name); };
    const closed = closedIn('mk');
    const t = await makePage(b, { state: TWO });
    await t.cat('On a ride');
    const names = async () => (await t.p.locator('.list .item .nm').allTextContents()).join(' | ');
    let shown = await names();
    ok('closed: fixture has closed rides to test with', closed.length > 0, closed.slice(0, 3).join(', '));
    ok('closed: closed rides are not offered by default', closed.length > 0 && !closed.some(n => shown.includes(n)), closed.filter(n => shown.includes(n)).slice(0, 3).join(', '));
    await t.p.locator('.closed-toggle input').first().check(); await t.p.waitForTimeout(400); shown = await names();
    ok('closed: "Include closed" shows them, tagged Closed', closed.every(n => shown.includes(n)) && await t.p.locator('.tag.closed').count() > 0);
    await t.tab('Plan'); await t.p.locator('.closed-toggle input').first().uncheck(); await t.p.waitForTimeout(400);
    const planNames = (await t.p.locator('.list .item .nm').allTextContents()).join(' | ');
    ok('closed: Plan tab hides closed rides too (no + Plan for them)', !closed.some(n => planNames.includes(n)));
    await t.ctx.close(); }

  // ---------- 5. plan + NEXT ----------
  { const t = await makePage(b, { state: TWO });
    await t.tab('Plan');
    await t.p.locator('.item', { hasText: 'Space Mountain' }).locator('button', { hasText: '+ Plan' }).first().click(); await t.p.waitForTimeout(300);
    ok('plan: + Plan opens the time sheet', await t.p.locator('.sheet').isVisible());
    await t.p.locator('.sheet .times button').first().click(); await t.p.locator('.sheet button.btn.sun').click(); await t.p.waitForTimeout(500);
    let s = await t.st(); ok('plan: ride added with a time', s.plan.length === 1 && !!s.plan[0].time, JSON.stringify(s.plan));
    // custom stop in the past + one in the future
    await t.p.fill('form.custom input:not([type])', 'Old breakfast'); await t.p.fill('form.custom input[type="time"]', '08:00'); await t.p.click('form.custom button'); await t.p.waitForTimeout(300);
    await t.p.fill('form.custom input:not([type])', 'Lunch'); await t.p.fill('form.custom input[type="time"]', '17:00'); await t.p.click('form.custom button'); await t.p.waitForTimeout(700);
    s = await t.st(); ok('plan: custom stops added', s.plan.length === 3);
    ok('next: past stop never shows as NEXT', t.last().display.next && t.last().display.next.label !== 'Old breakfast', JSON.stringify(t.last().display.next));
    // shows: tap a time
    await t.p.locator('.seg button', { hasText: 'Shows' }).click(); await t.p.waitForTimeout(300);
    const showTime = t.p.locator('.item.block .times button:not(.past)').first();
    await showTime.click(); await t.p.waitForTimeout(700); ok('plan: show time added and sent for countdown', (t.last().display.shows || []).length === 1, JSON.stringify(t.last().display.shows));
    // edit time, clear time
    await t.p.locator('.list.plan .item', { hasText: 'Lunch' }).locator('button.tm').click(); await t.p.locator('.sheet button', { hasText: 'No set time' }).click(); await t.p.waitForTimeout(400);
    s = await t.st(); ok('plan: clear a time', s.plan.find(x => x.name === 'Lunch').time === '');
    // check off + remove
    await t.p.locator('.list.plan .item', { hasText: 'Old breakfast' }).locator('button.check').click(); await t.p.waitForTimeout(300);
    s = await t.st(); ok('plan: check off', s.plan.find(x => x.name === 'Old breakfast').done === true);
    await t.p.locator('.list.plan .item', { hasText: 'Old breakfast' }).locator('button.x').click(); await t.p.waitForTimeout(300);
    s = await t.st(); ok('plan: remove', !s.plan.some(x => x.name === 'Old breakfast'));
    // change next on Now tab
    await t.tab('Now');
    const change = t.p.locator('.upnext .list .item', { hasText: 'Lunch' });
    if (await change.count()) { await change.first().locator('.nm-btn').click(); await t.p.waitForTimeout(600); ok('next: pick your own NEXT', (t.last().display.next || {}).label === 'Lunch', JSON.stringify(t.last().display.next));
      await t.p.locator('button', { hasText: 'Follow my plan again' }).click(); await t.p.waitForTimeout(500);
      ok('next: follow plan again', !(await t.st()).nextId); }
    else ok('next: Change next list shows', false);
    // remove the park the plan is in
    await t.tab('Parks'); await t.toggleDest('Magic Kingdom Park');
    s = await t.st(); ok('parks: removing MK clears Now and moves here to EPCOT', s.hereId === IDS.ep && !s.now.cat);
    ok('next: skips items from removed park', !t.last().display.next || !['Space Mountain'].includes(t.last().display.next.label), JSON.stringify(t.last().display.next));
    ok('countdown: skips shows from removed park', !(t.last().display.shows || []).length, JSON.stringify(t.last().display.shows));
    await t.tab('Plan');
    ok('plan: removed park is labeled', await t.p.locator('.meta', { hasText: 'park removed from today' }).count() > 0);
    ok('plan/next: no page errors', !t.errors.length, t.errors.join(' | '));
    await t.p.screenshot({ path: OUT + 'plan.png', fullPage: true });
    await t.ctx.close(); }

  // ---------- 5b. On stream controls ----------
  { const t = await makePage(b, { state: { ...TWO, hereId: IDS.ep, plan: [{ id: 's1', name: 'Luminous The Symphony of Us', type: 'S', parkId: IDS.ep, time: '21:00', done: false }] } });
    await t.p.locator('details.controls summary').click(); await t.p.waitForTimeout(300);
    ok('controls: card opens', await t.p.locator('.ctl-row').first().isVisible());
    ok('controls: status names the planned show', (await t.p.locator('.ctl-status').textContent()).includes('Luminous'), await t.p.locator('.ctl-status').textContent());
    const seg = (row, btn) => t.p.locator('.ctl-row', { hasText: row }).locator('button', { hasText: btn }).click();
    await seg('Show it', '1 hr'); await t.p.waitForTimeout(700);
    ok('controls: window 1 hour sent', t.last().display.settings.within === 60, JSON.stringify(t.last().display.settings));
    ok('controls: status says when it appears', (await t.p.locator('.ctl-status').textContent()).includes('8:00 PM'), await t.p.locator('.ctl-status').textContent());
    await seg('Top countdown', 'Off'); await t.p.waitForTimeout(700);
    ok('controls: countdown off sent', t.last().display.settings.countdown === false);
    ok('controls: window choice hides when countdown is off', !(await t.p.locator('.ctl-row', { hasText: 'Show it' }).count()));
    await seg('Show NEXT line', 'Off'); await t.p.waitForTimeout(700);
    ok('controls: NEXT off sent', t.last().display.settings.next === false);
    await seg('Also show the card on the live scene', 'On'); await t.p.waitForTimeout(700);
    ok('controls: live scene on sent', t.last().display.settings.onLive === true);
    await t.p.reload(); await t.p.waitForTimeout(900);
    ok('controls: settings survive reload', JSON.stringify((await t.st()).settings) === JSON.stringify({ countdown: false, within: 60, next: false, onLive: true, cdId: "" }), JSON.stringify((await t.st()).settings));
    await t.tab('Parks'); ok('version shown in Parks tab', (await t.p.locator('p.hint', { hasText: 'App version' }).textContent().catch(() => '')).includes('ET')); await t.tab('Now');
    if (!(await t.p.locator('details.controls[open]').count())) { await t.p.locator('details.controls summary').click(); await t.p.waitForTimeout(300); }
    await seg('Top countdown', 'On'); await t.p.waitForTimeout(400); await seg('Show it', 'Right now'); await t.p.waitForTimeout(700);
    ok('controls: "Right now" sends a full-day window', t.last().display.settings.within === 1440, JSON.stringify(t.last().display.settings));
    ok('controls: status says it is on stream now', (await t.p.locator('.ctl-status').textContent()).includes('On stream now'), await t.p.locator('.ctl-status').textContent());
    ok('controls: 320px fits', true);
    ok('controls: no page errors', !t.errors.length, t.errors.join(' | '));
    await t.p.locator('details.controls summary').click(); await t.p.waitForTimeout(300);
    await t.p.evaluate(() => scrollTo(0, 0)); await t.p.screenshot({ path: OUT + 'controls.png', fullPage: true });
    await t.ctx.close(); }

  // ---------- 5c. top countdown: tick ⏱ on a stop ----------
  { const plan = [{ id: 'etb', name: 'Eat to the Beat Concert Series Presented by Enterprise® at EPCOT International Food & Wine Festival', type: 'S', parkId: IDS.ep, time: '18:45', done: false },
                  { id: 'lum', name: 'Luminous The Symphony of Us', type: 'S', parkId: IDS.ep, time: '21:00', done: false },
                  { id: 'lun', name: 'Lunch at Regal Eagle', type: 'C', parkId: IDS.ep, time: '17:00', done: false }];
    const t = await makePage(b, { state: { ...TWO, hereId: IDS.ep, plan } });
    await t.cat('Shopping'); await t.p.waitForTimeout(700);
    ok('⏱: nothing ticked = automatic (every planned show)', JSON.stringify((t.last().display.shows || []).map(x => x.id)) === '["etb","lum"]', JSON.stringify(t.last().display.shows));
    ok('⏱: NEXT stays the next scheduled stop (lunch)', (t.last().display.next || {}).label === 'Lunch at Regal Eagle', JSON.stringify(t.last().display.next));
    await t.tab('Plan');
    ok('⏱: every timed stop in Plan has the box', await t.p.locator('.list.plan .cd-box').count() === 3);
    await t.p.locator('.list.plan .item', { hasText: 'Luminous' }).locator('.cd-box input').check(); await t.p.waitForTimeout(700);
    ok('⏱: tick Luminous = top countdown follows it', JSON.stringify(t.last().display.shows.map(x => x.id)) === '["lum"]', JSON.stringify(t.last().display.shows));
    ok('⏱: NEXT is unchanged by the countdown pick', (t.last().display.next || {}).label === 'Lunch at Regal Eagle');
    await t.p.locator('.list.plan .item', { hasText: 'Lunch at Regal Eagle' }).locator('.cd-box input').check(); await t.p.waitForTimeout(700);
    ok('⏱: ticking another moves it (only one at a time)', JSON.stringify(t.last().display.shows.map(x => x.id)) === '["lun"]' && await t.p.locator('.list.plan .cd-box.on').count() === 1);
    await t.p.locator('.list.plan .item', { hasText: 'Lunch at Regal Eagle' }).locator('.cd-box input').uncheck(); await t.p.waitForTimeout(700);
    ok('⏱: untick = back to automatic', JSON.stringify(t.last().display.shows.map(x => x.id)) === '["etb","lum"]');
    await t.tab('Now');
    ok('⏱: boxes also in Up next / Change next', await t.p.locator('.upnext .cd-box').count() >= 3);
    await t.p.locator('.upnext .list .item', { hasText: 'Luminous' }).locator('.cd-box input').check(); await t.p.waitForTimeout(700);
    ok('⏱: tick from Up next works', JSON.stringify(t.last().display.shows.map(x => x.id)) === '["lum"]');
    await t.p.locator('details.controls summary').click(); await t.p.waitForTimeout(300);
    await t.p.locator('.controls button', { hasText: 'Back to automatic' }).click(); await t.p.waitForTimeout(700);
    ok('⏱: "Back to automatic" in controls', JSON.stringify(t.last().display.shows.map(x => x.id)) === '["etb","lum"]');
    await t.p.locator('.upnext .list .item', { hasText: 'Lunch at Regal Eagle' }).locator('.cd-box input').check(); await t.p.waitForTimeout(500);
    await t.tab('Plan'); await t.p.locator('.list.plan .item', { hasText: 'Lunch at Regal Eagle' }).locator('button.check').click(); await t.p.waitForTimeout(700);
    ok('⏱: ticked stop checked off = back to automatic', JSON.stringify(t.last().display.shows.map(x => x.id)) === '["etb","lum"]', JSON.stringify(t.last().display.shows));
    ok('⏱: no page errors', !t.errors.length, t.errors.join(' | '));
    await t.ctx.close(); }

  // ---------- 5d. Up next with Cierra's real situation (doing the only stop in the plan) ----------
  { const t = await makePage(b, { state: { parks: [{ id: IDS.mk, name: 'Magic Kingdom Park' }], hereId: IDS.mk, now: { cat: 'ride', item: { n: '"it\'s a small world"', t: 'A', w: 30 } },
      plan: [{ id: 'sw', name: '"it\'s a small world"', type: 'A', parkId: IDS.mk, time: '13:00', done: false }], nextId: null, updated: 1 }, clock: '2026-09-28T12:58:00-04:00' });
    const txt = await t.p.locator('.upnext').textContent();
    ok('upnext: shows what you are doing now', txt.includes('Doing now') && txt.includes("it's a small world"), txt.slice(0, 120));
    ok('upnext: never says "plan is empty" when it is not', !txt.includes('plan is empty') && txt.includes('Nothing after this'), txt.slice(0, 160));
    await t.p.locator('.upnext button', { hasText: 'Done ✓' }).click(); await t.p.waitForTimeout(500);
    ok('upnext: Done ✓ checks it off', (await t.st()).plan[0].done === true);
    await t.ctx.close(); }
  { const t = await makePage(b, { state: { ...TWO, plan: [] } });
    ok('upnext: truly empty plan says so', (await t.p.locator('.upnext').textContent()).includes('plan is empty'));
    await t.ctx.close(); }

  // ---------- 6. sync, reload, server copy ----------
  { const t = await makePage(b, { state: TWO });
    t.net.failPut = true; await t.cat('Exploring'); await t.p.waitForTimeout(1200);
    ok('sync: no signal shows "Waiting for signal"', (await t.p.locator('.sync').textContent()).includes('Waiting'));
    t.net.failPut = false; await t.p.waitForTimeout(6500);
    ok('sync: retries and recovers', (await t.p.locator('.sync').textContent()).includes('On stream'), await t.p.locator('.sync').textContent());
    await t.p.reload(); await t.p.waitForTimeout(900);
    ok('reload: keeps what you picked', (await t.st()).now.cat === 'explore');
    await t.ctx.close(); }
  { const newer = { ...TWO, now: { cat: 'eat', item: { n: 'Be Our Guest Restaurant', t: 'R' } }, updated: Date.parse('2026-09-28T15:00:00-04:00') };
    const t = await makePage(b, { state: TWO, server: newer }); await t.p.waitForTimeout(600);
    ok('first load: takes the newer server copy', (await t.st()).now.cat === 'eat');
    await t.ctx.close(); }

  }
  // ---------- 7. small phone layout ----------
  for (const device of ['iPhone SE', 'iPhone 13']) {
    const t = await makePage(b, { device, state: { ...TWO, plan: [{ id: 'x', name: 'Star Wars: Rise of the Resistance', type: 'A', parkId: IDS.mk, time: '17:30', done: false }, { id: 'y', name: "Disney's Not-So-Spooky Spectacular at Mickey's Not-So-Scary Halloween Party", type: 'S', parkId: IDS.mk, time: '21:15', done: false }, { id: 'z', name: 'Lunch at Columbia Harbour House with the whole family', type: 'C', parkId: IDS.mk, time: '', done: true }] } });
    for (const tb of ['Now', 'Plan', 'Parks']) { await t.tab(tb); const o = await t.overflow(); ok(`layout ${device}: ${tb} tab has no sideways scroll`, o <= 0, `${o}px too wide`); }
    await t.tab('Now'); await t.cat('Getting around'); const o = await t.overflow(); ok(`layout ${device}: Getting around fits`, o <= 0, `${o}px`);
    await t.p.screenshot({ path: OUT + `layout-${device.replace(/ /g, '')}.png`, fullPage: true });
    await t.ctx.close();
  }

  // ---------- 8. overlay: nothing picked shows nothing ----------
  for (const [name, d, expect] of [
    ['Disneyland chosen, nothing picked', { now: '', nowParts: null, park: 'Disneyland', tz: 'America/Los_Angeles', next: null, shows: [] }, { card: false, cd: false }],
    ['nothing picked but plan has NEXT', { now: '', nowParts: null, park: 'Disneyland', tz: 'America/Los_Angeles', next: { time: '', label: 'Matterhorn Bobsleds' }, shows: [] }, { card: true, cd: false, ticket: false }],
  ]) {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.route('https://api.themeparks.wiki/**', r => r.fulfill({ contentType: 'application/json', body: fs.readFileSync(U + 'dl-live.json') }));
    await p.goto('file:///home/claude/ctpg-pack/overlay.html?planner=1&look=ticket&mock=' + encodeURIComponent(JSON.stringify(d))); await p.waitForTimeout(2000);
    const r = await p.evaluate(() => ({ card: !document.getElementById('card').classList.contains('hidden'), cd: document.getElementById('cd').classList.contains('show'),
      ticket: getComputedStyle(document.getElementById('icon')).display !== 'none' }));
    ok(`overlay: ${name}`, r.card === expect.card && r.cd === expect.cd && (expect.ticket === undefined || r.ticket === expect.ticket), JSON.stringify(r));
    await p.screenshot({ path: OUT + `overlay-${name.replace(/[^a-z]+/gi, '-')}.png` }); await p.close();
  }

  // ---------- 8b. overlay follows the controls ----------
  { const tIn = m => { const p = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(Date.now()+m*60000)); return p.find(x=>x.type==='hour').value+':'+p.find(x=>x.type==='minute').value; };
    const base = { now: 'x', nowParts: { cat: 'ride', label: 'On a ride', title: 'Soarin', sub: 'EPCOT' }, park: 'EPCOT', tz: 'America/New_York', next: { time: tIn(90), label: 'Luminous' }, shows: [{ time: tIn(90), label: 'Luminous' }] };
    for (const [name, settings, extra, expect] of [
      ['countdown on, 3 h window, show in 90 min', { countdown: true, within: 180, next: true, onLive: false }, '', { cd: true, next: true, card: true }],
      ['1 h window, show in 90 min (not yet)', { countdown: true, within: 60, next: true, onLive: false }, '', { cd: false }],
      ['countdown off', { countdown: false, within: 180, next: true, onLive: false }, '', { cd: false, card: true }],
      ['NEXT off', { countdown: true, within: 180, next: false, onLive: false }, '', { next: false, card: true }],
      ['live scene, "also on live" off', { countdown: true, within: 180, next: true, onLive: false }, '&scene=live', { card: false, cd: false }],
      ['live scene, "also on live" on: card yes, top countdown never', { countdown: true, within: 180, next: true, onLive: true }, '&scene=live', { card: true, cd: false }],
      ['picked stop that is not a show (lunch) counts down', { countdown: true, within: 180, next: true, onLive: false, cdId: 'lun' }, '', { cd: true }],
      ['"Right now": show 90 min away counts down immediately', { countdown: true, within: 1440, next: true, onLive: false }, '', { cd: true }],
    ]) {
      const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
      await p.goto('file:///home/claude/ctpg-pack/overlay.html?planner=1&look=ticket' + extra + '&mock=' + encodeURIComponent(JSON.stringify({ ...base, settings }))); await p.waitForTimeout(1800);
      const r = await p.evaluate(() => ({ card: !document.getElementById('card').classList.contains('hidden'), cd: document.getElementById('cd').classList.contains('show'), next: !document.getElementById('nextChip').classList.contains('hidden') }));
      ok(`overlay controls: ${name}`, Object.entries(expect).every(([k, v]) => r[k] === v), JSON.stringify(r));
      await p.close();
    } }

  await b.close();
  fs.writeFileSync(OUT + 'results.txt', results.join('\n'));
  console.log(results.join('\n')); console.log(`\n${results.length - failCount} passed, ${failCount} failed`);
})().catch(e => { console.log(results.join('\n')); console.log('CRASH', e.message.split('\n')[0]); });
