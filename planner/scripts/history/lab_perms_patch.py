import io
p = r"src\App.jsx"
s = io.open(p, encoding="utf-8").read()
def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (c, a[:80])
    s = s.replace(a, b)

rep('import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
    'import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";\nimport { PERMS } from "./perms.js";\n// what the signed-in person may change (Cierra: everything; a mod: what the owner dashboard gave them)\nconst CanCtx = createContext(() => true);')

# ---- Preview ----
rep('''function Preview({ d, ctl }) {
  const p = d.nowParts;''', '''function Preview({ d, ctl }) {
  const can = useContext(CanCtx);
  const p = d.nowParts;''')
rep('''{ctl && ctl.canDone && <span className="pv-btns"><button className="btn sun small" onClick={ctl.done}>✓ Done</button><button className="btn ghost small" onClick={ctl.pause}>Pause</button></span>}''',
    '''{ctl && ctl.canDone && (can("now.done") || can("now.pause")) && <span className="pv-btns">{can("now.done") && <button className="btn sun small" onClick={ctl.done}>✓ Done</button>}{can("now.pause") && <button className="btn ghost small" onClick={ctl.pause}>Pause</button>}</span>}''')
rep('''<button className="btn sun small pv-btn" onClick={ctl.resume}>Resume</button>''', '''{can("now.pause") && <button className="btn sun small pv-btn" onClick={ctl.resume}>Resume</button>}''')
rep('''<button className="btn ghost small pv-btn" onClick={ctl.done}>Clear</button>''', '''{can("now.done") && <button className="btn ghost small pv-btn" onClick={ctl.done}>Clear</button>}''')
rep('''{ctl && ctl.stages && <div''', '''{ctl && ctl.stages && can("now.detail") && <div''')
rep('''{ctl ? <button className="pv-next linkrow" onClick={ctl.pickNext}>''', '''{ctl && can("next") ? <button className="pv-next linkrow" onClick={ctl.pickNext}>''')
rep('''<button className="btn small pv-btn" onClick={ctl.start}>▶ Next</button>''', '''{can("now.set") && <button className="btn small pv-btn" onClick={ctl.start}>▶ Next</button>}''')
rep(''': ctl ? <button className="btn ghost small" onClick={ctl.pickNext}>+ Pick what's NEXT</button>''', ''': ctl && can("next") ? <button className="btn ghost small" onClick={ctl.pickNext}>+ Pick what's NEXT</button>''')

# ---- ShowRow times ----
rep('''return <button key={x} className={`time ${x < nowT ? "past" : ""} ${on ? "on" : ""}`} onClick={() => toggleShowTime(update, i, parkId, x)}>{on ? "✓ " : ""}{clock(x)}</button>;''',
    '''return <button key={x} className={`time ${x < nowT ? "past" : ""} ${on ? "on" : ""}`} disabled={!can(on ? "plan.remove" : "plan.add")} onClick={() => toggleShowTime(update, i, parkId, x)}>{on ? "✓ " : ""}{clock(x)}</button>;''')
rep('''function ShowRow({ i, sel, inPlan, onClick, tz, plan, parkId, update, nowT }) {
''', '''function ShowRow({ i, sel, inPlan, onClick, tz, plan, parkId, update, nowT }) {
  const can = useContext(CanCtx);
''')

# ---- CountdownBox ----
rep('''function CountdownBox({ S, update, p, chip }) {
  if (!p.time || p.done) return null;
  const on = !!p.cd;''', '''function CountdownBox({ S, update, p, chip }) {
  const can = useContext(CanCtx);
  if (!p.time || p.done) return null;
  const on = !!p.cd;
  if (!can("cd.pick")) return on ? <span className={`cd-box ro on ${chip ? "chip" : ""}`} title="Top countdown">⏱{chip ? " Top countdown" : ""}</span> : null;''')

# ---- StreamControls ----
rep('''function StreamControls({ S, display, update, tz }) {
  const set = display.settings;''', '''function StreamControls({ S, display, update, tz }) {
  const can = useContext(CanCtx);
  const set = display.settings;
  const cs = can("cd.settings"), ds = can("display");
  if (!cs && !ds && !can("cd.pick")) return null;''')
rep('''      <div className="ctl-row"><span>Top countdown</span><Seg k="countdown" opts={[[true, "On"], [false, "Off"]]} /></div>
      {set.countdown && <div className="ctl-row"><span>Show it <small className="dim">(before the show)</small></span><Seg k="within" opts={WINDOWS} /></div>}''',
'''      {cs && <div className="ctl-row"><span>Top countdown</span><Seg k="countdown" opts={[[true, "On"], [false, "Off"]]} /></div>}
      {cs && set.countdown && <div className="ctl-row"><span>Show it <small className="dim">(before the show)</small></span><Seg k="within" opts={WINDOWS} /></div>}''')
rep('''      <div className="ctl-row"><span>Show NEXT line</span><Seg k="next" opts={[[true, "On"], [false, "Off"]]} /></div>
      <div className="ctl-row"><span>Also show the card on the live scene</span><Seg k="onLive" opts={[[true, "On"], [false, "Off"]]} /></div>
      <p className="hint tight">The top countdown only ever shows in the Now scene. This switch just adds the Now card to the live scene.</p>''',
'''      {ds && <div className="ctl-row"><span>Show NEXT line</span><Seg k="next" opts={[[true, "On"], [false, "Off"]]} /></div>}
      {ds && <div className="ctl-row"><span>Also show the card on the live scene</span><Seg k="onLive" opts={[[true, "On"], [false, "Off"]]} /></div>}
      {ds && <p className="hint tight">The top countdown only ever shows in the Now scene. This switch just adds the Now card to the live scene.</p>}''')

# ---- NowTab ----
rep('''function NowTab({ S, here, data, parkData, display, update, q, setQ, showClosed, setShowClosed }) {
''', '''function NowTab({ S, here, data, parkData, display, update, q, setQ, showClosed, setShowClosed }) {
  const can = useContext(CanCtx);
''')
rep('''{!pickCat && N.cat === "travel" && (''', '''{!pickCat && N.cat === "travel" && can("now.detail") && (''')
rep('''{!pickCat && N.cat === "concert" && N.item && (''', '''{!pickCat && N.cat === "concert" && N.item && can("now.detail") && (''')
rep('''      <h2>Doing something else?</h2>
      <div className="cats">''', '''      {can("now.set") && <><h2>Doing something else?</h2>
      <div className="cats">''')
rep('''        </>
      )}
      <h2>Coming up''', '''        </>
      )}</>}
      <h2>Coming up''')
rep('''          <button className="btn small" aria-label={"Start " + p.name + " now"} onClick={() => act(s => startStop(s, p.id, "walk", true), "Now: ", "")}>▶</button>''',
    '''          {can("now.set") && <button className="btn small" aria-label={"Start " + p.name + " now"} onClick={() => act(s => startStop(s, p.id, "walk", true), "Now: ", "")}>▶</button>}''')

# ---- PlanTab ----
rep('''function PlanTab({ S, here, parkData, update, seg, setSeg, q, setQ, planParkId, setPlanParkId, showClosed, setShowClosed }) {
''', '''function PlanTab({ S, here, parkData, update, seg, setSeg, q, setQ, planParkId, setPlanParkId, showClosed, setShowClosed }) {
  const can = useContext(CanCtx);
''')
rep('''<button className={`check ${p.done ? "done" : ""}`} aria-label="Done" onClick=''', '''<button className={`check ${p.done ? "done" : ""}`} aria-label="Done" disabled={!can("plan.check")} onClick=''')
rep('''<button className={`tm ${p.time ? "" : "unset"}`} onClick={() => setSheet({ planId: p.id })}>''', '''<button className={`tm ${p.time ? "" : "unset"}`} disabled={!can("plan.time")} onClick={() => setSheet({ planId: p.id })}>''')
rep('''            <button className="x" aria-label="Remove" onClick=''', '''            {can("plan.remove") && <button className="x" aria-label="Remove" onClick=''')
rep('''if (s.cur === p.id) s.cur = null; return s; }, "Removed")}>×</button>''', '''if (s.cur === p.id) s.cur = null; return s; }, "Removed")}>×</button>}''')
rep('''      <form className="custom" onSubmit=''', '''      {can("plan.add") && <><form className="custom" onSubmit=''')
rep('''          {data && !pool.length && <div className="empty">Nothing matches.</div>}
        </div>
      </>}''', '''          {data && !pool.length && <div className="empty">Nothing matches.</div>}
        </div>
      </>}</>}''')
rep('''                  return <button key={x} className={`time ${x < t ? "past" : ""} ${on ? "on" : ""}`} onClick=''', '''                  return <button key={x} className={`time ${x < t ? "past" : ""} ${on ? "on" : ""}`} disabled={!can(on ? "plan.remove" : "plan.add")} onClick=''')

# ---- ParksTab ----
rep('''function ParksTab({ S, here, display, update, me }) {
''', '''function ParksTab({ S, here, display, update, me }) {
  const can = useContext(CanCtx);
''')
rep('''<button key={p.id} className={`pk ${here && p.id === here.id ? "here" : "on"}`} onClick={() => update(s => setHere(s, p.id), "Now at " + p.name)}>''',
    '''<button key={p.id} className={`pk ${here && p.id === here.id ? "here" : "on"}`} disabled={!can("park.here")} onClick={() => update(s => setHere(s, p.id), "Now at " + p.name)}>''')
rep('''      <h2>Parks today</h2>
      <Search value={q} onChange={setQ} placeholder="Search any park or resort…" />''', '''      {can("park.list") && <><h2>Parks today</h2>
      <Search value={q} onChange={setQ} placeholder="Search any park or resort…" />''')
rep('''      {dests && !q && <p className="hint">Showing Florida and California resorts. Search to find any other park.</p>}''',
    '''      {dests && !q && <p className="hint">Showing Florida and California resorts. Search to find any other park.</p>}</>}''')
rep('''      {me && me.role === "owner" && <p className="hint">Moderators''', '''      {me && me.role === "mod" && <div className="card gap mycan"><p className="label">What you can do</p>{(me.perms || []).length ? <ul>{PERMS.filter(x => (me.perms || []).includes(x.k)).map(x => <li key={x.k}><b>{x.l}</b> <span className="dim">{x.h}</span></li>)}</ul> : <p className="hint tight">You can watch what viewers see. Ask Cierra if you need to change something.</p>}</div>}
      {me && me.role === "owner" && <p className="hint">Moderators''')

# ---- App: provider, save rules, 403 ----
rep('''  const can = p => me.role === "owner" || (me.perms || []).includes("*") || (me.perms || []).includes(p);
''', '''  const can = useCallback(p => me.role === "owner" || (me.perms || []).includes("*") || (me.perms || []).includes(p), [me]);
  const canRef = useRef(can); canRef.current = can;
  // a mod with nothing but GO LIVE (or nothing at all) never saves; wait-time refreshes only from someone running NOW
  const writer = me.role === "owner" || (me.perms || []).some(k => k !== "scene");
''')
rep('''    if (lastWait.current !== null && w !== lastWait.current) { dirty.current = true; setS(s => ({ ...s })); }''',
    '''    const c = canRef.current;
    if (lastWait.current !== null && w !== lastWait.current && c && (c("now.set") || c("now.detail") || c("now.done"))) { dirty.current = true; setS(s => ({ ...s })); }''')
rep('''    if (!authed || !dirty.current) return;
    setSync("sending");''', '''    if (!authed || !dirty.current) return;
    if (!writer) { dirty.current = false; return; }
    setSync("sending");''')
rep('''      .catch(e => { if (e.auth) { setCode(""); setAuthed(false); return; } if (!stop) { setSync("waiting"); timer = setTimeout(attempt, 5000); } });''',
    '''      .catch(e => {
        if (e.auth) { setCode(""); setAuthed(false); return; }
        // not allowed: say so and go back to what's really on stream
        if (e.forbidden) { dirty.current = false; setSync("ok"); toast(e.message.replace(/^Not allowed: /, "You don't have: ")); fetchState().then(srv => srv && setS(normalize(srv))).catch(() => {}); return; }
        if (!stop) { setSync("waiting"); timer = setTimeout(attempt, 5000); }
      });''')
rep('''  }, [S, display, authed]);''', '''  }, [S, display, authed, writer]);''')
rep('''    <div className="app">
      {updateReady''', '''    <CanCtx.Provider value={can}><div className="app">
      {updateReady''')
rep('''      <div className={`toast ${toastMsg ? "show" : ""}`}>{toastMsg}{canUndo && <button className="undo" onClick={undo}>Undo</button>}</div>
    </div>
  );''', '''      <div className={`toast ${toastMsg ? "show" : ""}`}>{toastMsg}{canUndo && <button className="undo" onClick={undo}>Undo</button>}</div>
    </div></CanCtx.Provider>
  );''')
io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("app ok")
