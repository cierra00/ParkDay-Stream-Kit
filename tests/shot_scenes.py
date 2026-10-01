import json, os, sys, base64
sys.stdout.reconfigure(encoding="utf-8")
import obsws_python as obs
c = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))
cl = obs.ReqClient(host="localhost", port=c.get("server_port", 4455), password=c.get("server_password", ""), timeout=10)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "live"); os.makedirs(OUT, exist_ok=True)
print("program:", cl.get_current_program_scene().current_program_scene_name, "streaming:", cl.get_stream_status().output_active)
for sc in ("offline", "live", "Now", "subs"):
    r = cl.send("GetSourceScreenshot", {"sourceName": sc, "imageFormat": "jpg", "imageWidth": 960, "imageHeight": 540}, raw=True)
    open(os.path.join(OUT, f"now-{sc}.jpg"), "wb").write(base64.b64decode(r["imageData"].split(",", 1)[1]))
    items = cl.get_scene_item_list(sc).scene_items
    print(sc, [(i["sourceName"], i["sceneItemEnabled"]) for i in items])
for n in ("Browser 2", "New Subscriber"):
    print(n, cl.get_input_settings(n).input_settings)
