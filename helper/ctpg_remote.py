"""CTPG remote: lets the Park Day planner's GO LIVE button switch OBS on this PC.
Keeps one connection open to the planner (as "Streamer.bot"/bot role, using BOT_KEY from ctpg-planner/.keys.json),
waits for commands, and reports which scene is on air. Only command it obeys: scene.live -> the 'live' scene
on the main canvas and 'live Vertical' on the vertical canvas. Log: remote.log next to this file.
Run:  pythonw ctpg_remote.py      (test the OBS part alone:  python ctpg_remote.py --test-live)"""
import json, os, re, sys, time, threading, logging
import websocket          # websocket-client (comes with obsws_python)
import obsws_python as obs

HERE = os.path.dirname(os.path.abspath(__file__))
# own logger only: the OBS library logs its connection settings (password included), so it never writes here
_lg = logging.getLogger("ctpg-remote"); _lg.setLevel(logging.INFO); _lg.propagate = False
_h = logging.FileHandler(os.path.join(HERE, "remote.log"), encoding="utf-8"); _h.setFormatter(logging.Formatter("%(asctime)s %(message)s")); _lg.addHandler(_h)
for _n in ("obsws_python", "websocket"): logging.getLogger(_n).setLevel(logging.CRITICAL)
log = _lg.info
KEYS = json.load(open(r"C:\StreamerBot\ctpg-planner\.keys.json", encoding="utf-8"))
URL = re.search(r"url:\s*'([^']+)'", open(r"C:\StreamerBot\ctpg-pack\planner_key.js", encoding="utf-8").read()).group(1)
WS_URL = URL.replace("https://", "wss://") + "/api/ws?key=" + KEYS["BOT_KEY"]
VERTICAL = "292fcc0e-8af9-40f4-ad69-4f2b2cd3b312"   # Aitum Vertical canvas

def obs_client():
    c = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))
    return obs.ReqClient(host="localhost", port=c.get("server_port", 4455), password=c.get("server_password", ""), timeout=5)

def status():
    try:
        cl = obs_client()
        v = ""
        try: v = (cl.send("CallVendorRequest", {"vendorName": "aitum-vertical-canvas", "requestType": "current_scene", "requestData": {}}, raw=True).get("responseData") or {}).get("scene", "")
        except Exception: pass
        return {"type": "status", "scene": cl.get_current_program_scene().current_program_scene_name, "vertical": v, "streaming": cl.get_stream_status().output_active}
    except Exception as e:
        return {"type": "status", "scene": "", "streaming": None, "error": "OBS not reachable"}

def go_live():
    cl = obs_client()
    before = cl.get_current_program_scene().current_program_scene_name
    cl.set_current_program_scene("live")
    vert = "ok"
    try:   # the Aitum Vertical canvas has its own switch
        r = cl.send("CallVendorRequest", {"vendorName": "aitum-vertical-canvas", "requestType": "switch_scene", "requestData": {"scene": "live Vertical"}}, raw=True)
        if not (r.get("responseData") or {}).get("success", True): vert = "vertical said no"
    except Exception as e: vert = "vertical not switched (" + str(e)[:60] + ")"
    log(f"GO LIVE: {before} -> live; vertical {vert}")
    return {"ok": True, "scene": "live", "msg": "Switched to LIVE" + ("" if vert == "ok" else " (main only)"), "from": before}

def run():
    def send(ws, d):
        try: ws.send(json.dumps(d))
        except Exception: pass
    def on_open(ws):
        log("connected to planner"); send(ws, status())
        def beat():
            while getattr(ws, "keep", True):
                time.sleep(30); send(ws, status())
        ws.keep = True; threading.Thread(target=beat, daemon=True).start()
    def on_message(ws, msg):
        if msg == "pong": return
        try: d = json.loads(msg)
        except Exception: return
        if d.get("type") != "cmd": return
        who = d.get("by", "?")
        if d.get("action") == "scene.live":
            try: res = go_live()
            except Exception as e: res = {"ok": False, "error": "OBS: " + str(e)[:80]}
        else:
            res = {"ok": False, "error": "Unknown command"}
        log(f"cmd {d.get('action')} by {who}: {res}")
        send(ws, {"type": "result", "action": d.get("action"), "by": who, **res}); send(ws, status())
    def on_close(ws, *a): ws.keep = False; log("disconnected")
    while True:
        try:
            app = websocket.WebSocketApp(WS_URL, header=["User-Agent: ctpg-remote"], on_open=on_open, on_message=on_message, on_close=on_close)
            app.run_forever(ping_interval=25, ping_payload="ping")
        except Exception as e:
            log("error: " + str(e)[:120])
        time.sleep(5)

if __name__ == "__main__":
    if "--test-live" in sys.argv: print(go_live()); print(status())
    elif "--status" in sys.argv: print(status())
    else: run()
