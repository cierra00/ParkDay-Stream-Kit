# API: Worker, auth, permissions, WebSocket protocol

Source: `planner/worker/index.js`, `planner/src/perms.js`.

## 1. Auth resolution (`whoIs`)

Code comes from `Authorization: Bearer <code>` or `?key=<code>` (WS/overlay). Order, all compared with constant-time `safeEqual`:

| Match | Principal |
|---|---|
| `OWNER_PASS` | `{role:"owner", name:"Cierra", perms:["*"]}` |
| `ADMIN_PASS` | `{role:"admin", perms:[]}` (dashboard only) |
| `BOT_KEY` | `{role:"bot"}` |
| `OVERLAY_KEY` | `{role:"overlay"}` |
| sha256(code) == an active entry in R2 `mods.json` | `{role:"mod", id, name, perms: expandPerms(m.perms)}` |

Before `whoIs`, the Worker asks the DO `lockedFor(cf-connecting-ip)`; if locked -> **429** `{error:"Too many wrong codes. Try again in N min.", locked:true}`. A present-but-wrong code calls `failed(ip)`; missing code does not count.

## 2. Routes

| Method + path | Auth | Behavior |
|---|---|---|
| `GET /api/perms` | none | `{perms: PERMS, roles: ROLES}` |
| `GET /api/whoami` | any valid | `{role, name, perms}` |
| `GET /api/state` | any valid | R2 `state.json` (or `{}`) |
| `PUT /api/state` | owner, or mod with >=1 perm other than `scene` | Body <= 200,000 chars JSON. Mods: `missingPerm(perms, current, body)`; non-null -> **403** `{error:"Not allowed: <label>", missing}`. Sets `updated=Date.now()`, `updatedBy`. Writes R2, then `hub.broadcastState(body)` |
| `GET /api/mods` | owner or admin | List without `hash` |
| `PUT /api/mods` | owner or admin | Body: full list (max 25) `[{id,name,role,perms,active,code?}]`. `code` present -> new hash; else keep previous hash; entries with no hash dropped. `perms` = `expandPerms(...)` filtered to `PERM_KEYS`. Mods removed / turned off / re-hashed -> `hub.kick(ids)` |
| `POST /api/cmd` | owner or mod with perm = prefix of `action` (e.g. `scene.live` -> `scene`) | `hub.sendToBot({...cmd, by, role, at})`; 503 `{ok:false,error:"Streamer.bot is not connected (is the home PC on?)"}` if no bot socket |
| `GET /api/ws` | any valid | Upgrade required (426 otherwise). Forwards to DO with headers `x-role`, `x-name`, `x-id`, `x-perms` |
| anything else under `/api/` | | 404 |
| non-`/api/` | none | `env.ASSETS.fetch` (SPA; `/admin` serves `admin.html`) |

## 3. Durable Object `LiveHub` (single instance `idFromName("main")`, hibernation API)

| Method | Does |
|---|---|
| `fetch` | `acceptWebSocket(server, [role])`, attachment `{role,name,id,perms}`; immediately sends stored `botStatus` if any |
| auto-response | `"ping"` -> `"pong"` |
| `broadcastState(state)` | `{type:"state", state}` to every socket |
| `sendToBot(cmd)` | `{type:"cmd", ...cmd}` to sockets tagged `bot` |
| `webSocketMessage` | Only from role `bot` and type `status`/`result`: stores `botStatus` (status), re-broadcasts `{...data, at}` to owner/mod sockets. All other inbound messages ignored |
| `kick(ids)` | For mod sockets whose attachment id is in ids: send `{type:"revoked"}`, `close(4001,"revoked")` |
| `lockedFor(ip)` / `failed(ip)` | Storage key `fail:<ip>` -> `{n, first, until?}`; 10 within 15 min sets `until = now+15 min`; hourly `alarm()` deletes stale records |

## 4. WebSocket message types

| Direction | Message |
|---|---|
| server -> all | `{type:"state", state}` |
| server -> owner/mod | `{type:"status", scene, vertical, streaming, at}` / `{type:"result", ok, msg?, error?, scene?, action, by, at}` |
| server -> mod | `{type:"revoked"}` then close 4001 |
| server -> bot | `{type:"cmd", action:"scene.live", by, role, at}` |
| bot -> server | `{type:"status", scene, vertical, streaming}` / `{type:"result", ...}` |
| any -> server | `"ping"` (auto `"pong"`) |

## 5. Permissions (`perms.js`)

Keys: `scene`, `now.set`, `now.done`, `now.pause`, `now.detail`, `next`, `cd.pick`, `cd.settings`, `display`, `plan.add`, `plan.time`, `plan.check`, `plan.remove`, `park.here`, `park.list`. Legacy `plan` expands to all but `scene`.

`neededPerms(a, b)` returns groups of alternatives ("any one suffices") derived from a diff of server state `a` vs submitted `b`:

| Change | Any of |
|---|---|
| new stop | adhoc: `now.set`, `plan.add`; id == b.nextId: `next`, `plan.add`; else `plan.add` |
| removed stop | adhoc: `plan.remove`, `now.set`; else `plan.remove` |
| `done` toggled | `plan.check`, `now.done`, `now.set` |
| `time` changed | `plan.time` |
| `cd` toggled | `cd.pick` |
| `stage` changed | `now.detail`, `now.set`, `now.done` |
| `cat` or `item` changed | `now.detail`, `now.set` |
| `name`/`type`/`parkId`/`adhoc` changed | `plan.add` |
| `cur` -> null | `now.done`, `now.pause`, `now.set`, `plan.check`, `plan.remove`, `park.here`, `park.list` |
| `cur` -> old `paused` | `now.pause`, `now.set` |
| `cur` -> other | `now.set`, `now.done` |
| `paused` changed | `now.pause`, `now.set`, `now.done` |
| `nextId` changed | `next`, `now.set`, `now.done` |
| `hereId` changed | `park.here`, `park.list`, `now.set` |
| `parks` changed | `park.list` |
| `settings.next` / `settings.onLive` | `display` |
| other settings keys | `cd.settings` |
| unknown top-level key | `plan.add` |
| nothing but `display` changed | `now.set`, `now.detail`, `now.done` |

`missingPerm(perms, a, b)` -> null if every group has a match (or `*`), else label of the first missing group's first key.

Roles (presets, informational): `viewer` [], `mod` (default in /admin), `stream` [scene], `live`, `planner`, `cohost` (all). The role stored on a mod is cosmetic; enforcement uses `perms` only.

Known gap: `display` content is client-built and not validated against `plan`; a mod with any write perm can alter card text. Stale-base saves (client behind server) can produce false 403s for narrow-permission mods; the client recovers by refetching.
