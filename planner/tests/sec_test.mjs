// Local test against `wrangler dev` with throwaway test codes (never the real ones)
const B = "http://127.0.0.1:8799";
const call = (path, code, opts = {}, ip = "10.0.0.1") => fetch(B + path, { ...opts, headers: { "content-type": "application/json", authorization: "Bearer " + code, "cf-connecting-ip": ip, ...(opts.headers || {}) } });
const out = [];
// 1) wrong-code lockout
const codes = [];
for (let i = 1; i <= 11; i++) codes.push((await call("/api/whoami", "WRONG-" + i)).status);
out.push("wrong codes 1-11 -> " + codes.join(","));
out.push("right owner code from the locked address -> " + (await call("/api/whoami", "TEST-OWNER")).status);
out.push("right owner code from another address -> " + (await call("/api/whoami", "TEST-OWNER", {}, "10.0.0.2")).status);
// 2) revoke kicks the live connection
const ADM = "TEST-ADMIN", MODCODE = "CASTLE-DUMBO-FIGMENT-4821";
let r = await call("/api/mods", ADM, { method: "PUT", body: JSON.stringify([{ id: "m1", name: "Jess", role: "mod", perms: ["scene", "now.set"], active: true, code: MODCODE }]) }, "10.0.0.3");
out.push("add mod -> " + r.status);
out.push("mod whoami -> " + JSON.stringify(await (await call("/api/whoami", MODCODE, {}, "10.0.0.3")).json()));
const ws = new WebSocket(B.replace("http", "ws") + "/api/ws?key=" + encodeURIComponent(MODCODE), { headers: { "cf-connecting-ip": "10.0.0.3" } });
const closed = new Promise(res => { ws.onclose = e => res(e.code); });
const msgs = []; ws.onmessage = e => msgs.push(String(e.data));
await new Promise(res => { ws.onopen = res; setTimeout(res, 3000); });
out.push("mod websocket open -> " + (ws.readyState === 1));
r = await call("/api/mods", ADM, { method: "PUT", body: JSON.stringify([{ id: "m1", name: "Jess", role: "mod", perms: ["scene", "now.set"], active: false }]) }, "10.0.0.3");
out.push("turn mod off -> " + r.status);
const code = await Promise.race([closed, new Promise(res => setTimeout(() => res("still open"), 15000))]);
out.push("mod websocket closed with -> " + code + ", got revoked msg: " + msgs.some(m => m.includes("revoked")));
out.push("turned-off mod whoami -> " + (await call("/api/whoami", MODCODE, {}, "10.0.0.3")).status);
// 3) permissions on save: mod with only now.set tries to add a plan stop
await call("/api/mods", ADM, { method: "PUT", body: JSON.stringify([{ id: "m1", name: "Jess", role: "custom", perms: ["now.set"], active: true, code: MODCODE }]) }, "10.0.0.3");
await call("/api/state", "TEST-OWNER", { method: "PUT", body: JSON.stringify({ v: 3, plan: [], parks: [], settings: {} }) }, "10.0.0.4");
r = await call("/api/state", MODCODE, { method: "PUT", body: JSON.stringify({ v: 3, plan: [{ id: "z", name: "Snack", type: "C", time: "15:00", done: false }], parks: [], settings: {} }) }, "10.0.0.3");
out.push("mod without 'Add stops' adds a stop -> " + r.status + " " + JSON.stringify(await r.json()));
r = await call("/api/perms", "", {}, "10.0.0.9");
out.push("/api/perms -> " + r.status);
console.log(out.join("\n"));
process.exit(0);
