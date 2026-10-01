# OFF-AIR: does the live-scene copy of the card read the program scene inside real OBS?
# Temporarily adds &debug=show&mock=... to "Now/Next (on live)", takes screenshots, then puts the exact link back.
import json, os, sys, time, base64, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
import obsws_python as obs
c = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))
cl = obs.ReqClient(host="localhost", port=c.get("server_port", 4455), password=c.get("server_password", ""), timeout=10)
assert not cl.get_stream_status().output_active, "STREAMING - abort"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "live"); os.makedirs(OUT, exist_ok=True)
SRC = "Now/Next (on live)"
orig = cl.get_input_settings(SRC).input_settings["url"]; start = cl.get_current_program_scene().current_program_scene_name
disp = {"now": "Space Mountain", "nowParts": {"cat": "ride", "label": "On a ride", "title": "Space Mountain", "sub": "Magic Kingdom"}, "park": "Magic Kingdom",
        "tz": "America/New_York", "next": None, "shows": [], "settings": {"countdown": True, "within": 180, "next": True, "onLive": False}}
try:
    cl.set_input_settings(SRC, {"url": orig + "&debug=show&mock=" + urllib.parse.quote(json.dumps(disp))}, True)
    for sc in ("Now", "nick", "Now", "subs", "live"):
        cl.set_current_program_scene(sc); time.sleep(4)
        for name, what in (("copy", SRC), ("program", sc)):
            r = cl.send("GetSourceScreenshot", {"sourceName": what, "imageFormat": "jpg", "imageWidth": 960, "imageHeight": 540}, raw=True)
            open(os.path.join(OUT, f"livecopy-{sc}-{name}.jpg"), "wb").write(base64.b64decode(r["imageData"].split(",", 1)[1]))
        print("shot", sc, "program now:", cl.get_current_program_scene().current_program_scene_name, flush=True)
finally:
    cl.set_input_settings(SRC, {"url": orig}, True)
    cl.set_current_program_scene("offline")
    print("restored link:", cl.get_input_settings(SRC).input_settings["url"] == orig, "program:", cl.get_current_program_scene().current_program_scene_name)
