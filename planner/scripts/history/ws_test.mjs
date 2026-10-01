import fs from "node:fs";
const k = JSON.parse(fs.readFileSync("C:/StreamerBot/ctpg-planner/.keys.json", "utf8").replace(/^﻿/, "")).OVERLAY_KEY;
const ws = new WebSocket("wss://planner.cruiseandthemeparkguide.com/api/ws?key=" + encodeURIComponent(k));
const t = setTimeout(() => { console.log("timeout"); process.exit(1); }, 10000);
ws.onopen = () => { console.log("ws open"); ws.send("ping"); };
ws.onmessage = e => { console.log("got:", String(e.data).slice(0, 40)); if (e.data === "pong") { clearTimeout(t); ws.close(); console.log("ping/pong OK"); process.exit(0); } };
ws.onerror = e => console.log("ws error", e.message || "");
