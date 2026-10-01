# Read-only: where is the subs overlay (Browser 2) and what is on air
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
import obsws_python as obs
c = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))
cl = obs.ReqClient(host="localhost", port=c.get("server_port", 4455), password=c.get("server_password", ""), timeout=10)
print("streaming:", cl.get_stream_status().output_active, "| program:", cl.get_current_program_scene().current_program_scene_name)
try: print("preview:", cl.get_current_preview_scene().current_preview_scene_name)
except Exception as e: print("studio mode off")
for s in cl.get_scene_list().scenes:
    for i in cl.get_scene_item_list(s["sceneName"]).scene_items:
        if i["sourceName"] in ("Browser 2", "Like-Sub", "New Subscriber", "subs"): print(s["sceneName"], "|", i["sourceName"], "on" if i["sceneItemEnabled"] else "off")
