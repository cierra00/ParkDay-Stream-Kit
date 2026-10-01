# DATA-MODEL: state v3 and behavioral rules

Source: `planner/src/App.jsx`. Persisted as one JSON document in R2 key `state.json`, cached on the phone in localStorage key `parkday-state`.

## 1. Document shape

```jsonc
{
  "v": 3,
  "parks":  [{ "id": "<themeparks.wiki park uuid>", "name": "Magic Kingdom Park", "dest": "Walt Disney World® Resort" }],
  "hereId": "<park id>",               // park currently at; setHere() clears cur when it changes
  "plan": [ Stop, ... ],               // THE list; everything references ids in it
  "cur": "<stop id>|null",             // NOW
  "nextId": "<stop id>|null",          // hand-pinned NEXT (cleared when that stop starts)
  "paused": "<stop id>|null",          // NOW taken off stream; resumeNow restores
  "settings": { "countdown": true, "within": 180, "next": true, "onLive": false, "cdId": "" },
  "updated": 1790000000000,            // ms epoch, set by client on every change; server overwrites on PUT
  "updatedBy": "Cierra",               // set by server
  "display": Display                   // derived, see OVERLAY-CONTRACT.md; recomputed by client every render
}
```

### Stop

| Field | Type | Meaning |
|---|---|---|
| `id` | string (8 chars base36) | `uid()` |
| `name` | string | Park entity name as given by ThemeParks.wiki, or free text |
| `type` | `A` ride, `S` show, `R` restaurant, `C` custom stop, `Q` quick activity (category-only, e.g. Shopping) |
| `parkId` | string or "" | Stops whose park is not in `parks` are hidden from NEXT/lists (`inTripOf`) |
| `time` | `HH:MM` or "" | Park-local. Empty sorts last (`byTime` uses "99:99") |
| `done` | bool | Checked off |
| `cat` | category key | `ride eat fireworks parade concert show meet shop explore hop travel custom` (legacy `line` migrates to `ride` + stage `line`) |
| `stage` | `walk` / `line` / `doing` | Only meaningful for NOW with a named item; `Q`/`C` forced to `doing` |
| `item` | object or null | Extra: `w` posted wait, `band` concert override, `mode` travel mode, `to` travel destination |
| `cd` | bool | Top countdown target; at most one true (setting one clears others) |
| `adhoc` | bool | Created by a quick pick (goNow). Dropped when replaced without finishing |

## 2. Migration: `normalize(S0)`

- Merges defaults (`BLANK`, `SETTINGS`), deep-copies plan.
- `v === 3`: return. `v === 2`: `toV3`. Older (v1): `settings.cdId` -> `cd:true` on that stop; old `now:{cat,item}` becomes a plan stop (reusing an open stop with the same name) and `cur`; then `toV3`.
- `toV3`: `cat:"line"` -> `cat:"ride", stage:"line"`; resets `nextId`, `paused`; sets `v:3`.

## 3. Derivations

| Function | Rule |
|---|---|
| `nowStop(S)` | stop with id `cur` and not done, else null |
| `nextItem(S,tz)` | if `nextId` points at an open, in-trip stop that is not `cur` -> it. Else earliest (by time) open, in-trip stop that is not `cur` and not `paused`, with `time` empty or `>= now - GRACE(30)` |
| `nowOf(S)` | `{cat, stage, item}`; cat defaults via `catForPlan` (R->eat, A->meet if /meet/ else line, S->meet/concert/parade/fireworks/show by regex) but a legacy `line` cat becomes `ride` |
| `countdownStops(S)` | stops with `cd && !done && time && inTrip`, first one only |
| `buildDisplay(S, here, data)` | see OVERLAY-CONTRACT.md |

## 4. Mutations (all pure on a structuredClone, wrapped by `update(fn,msg)` which sets `updated`, marks dirty, stores undo snapshot)

| Function | Effect |
|---|---|
| `startStop(s,id,stage,finish)` | old NOW: if `finish` -> done=true; else if old.adhoc -> removed. New: done=false, stage set, `cur=id`, `paused=null`, clears `nextId` if it was this id |
| `finishNow(s,tz)` | NOW done, `cur=null`, `paused=null`; then if NEXT has a time, is at `hereId` (or no park), and `-GRACE <= minutesUntil <= SOON(5)` -> `startStop(next,"walk",false)` |
| `startNext(s,tz)` | `startStop(nextItem,"walk",true)` |
| `pauseNow(s)` | `paused=cur`, `cur=null` |
| `resumeNow(s)` | `cur=paused` if still open; `paused=null` |
| `setNext(s,tz,f)` | `f.planId` -> pin it. Else reuse the open stop with same name/type/park (and time if given) closest to now, or push a new stop; pin it |
| `goNow(s,tz,here,f)` | Reuse closest same-name open stop at this park (update cat/item) else push `{..., time: now, adhoc:true}`; `startStop(...,f.stage,false)` |
| `setHere(s,id)` | if changed: `hereId=id`, `cur=null` |
| Plan list ✓ | toggles `done`; if checking the current NOW, `cur=null` |
| Plan list × | removes stop; clears `cur` if it was NOW |
| ⏱ box | `plan.forEach(x => x.cd = v && x.id === p.id)` |
| Stage buttons | `nowStop.stage = k` (and legacy `cat line` -> `ride`) |

## 5. Save pipeline

1. `update()` -> React state -> localStorage copy.
2. Effect: if dirty and the user is a writer (owner, or mod with any non-`scene` perm), after 400 ms `PUT /api/state` with `{...S, display}`.
3. Success: dirty=false, pill "On stream ✓". Network error: pill "Waiting for signal", retry in 5 s. 401: sign out. 403: toast "You don't have: <perm>", refetch server state.
4. Incoming WS `{type:"state"}`: applied only when not dirty and `state.updated > local.updated`.
5. Wait-time changes in `display.nowParts.wait` mark dirty only for users with `now.set|now.detail|now.done`.

## 6. Park data (client only)

`loadPark(id)` merges `/entity/{id}/children` (names, types, timezone) and `/entity/{id}/live` (status, standby wait, showtimes for today in park tz). Item: `{id, n, t, o: operating?, w: wait|null, x: ["HH:MM"...], s: status}`. `isClosed(i)` = status present and not `OPERATING`. Current park refreshed every 120 s while visible.
