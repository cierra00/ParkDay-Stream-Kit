# Read-only: which obs-websocket requests exist (canvas support?) and vendor requests for Aitum Vertical.
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
import obsws_python as obs
c = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))
cl = obs.ReqClient(host="localhost", port=c.get("server_port", 4455), password=c.get("server_password", ""), timeout=5)
v = cl.get_version()
print("obs", v.obs_version, "ws", v.obs_web_socket_version)
reqs = v.available_requests
print("canvas-related requests:", [r for r in reqs if "anvas" in r])
print("streaming:", cl.get_stream_status().output_active, "program:", cl.get_current_program_scene().current_program_scene_name)
try:
    r = cl.send("GetCanvasList", raw=True); print("canvases:", [(x.get("canvasName"), x.get("canvasUuid")) for x in r.get("canvases", [])])
except Exception as e: print("GetCanvasList error:", e)
try:
    r = cl.send("GetSceneItemList", {"sceneName": "live Vertical"}, raw=True); print("live Vertical via plain name:", [(i["sourceName"], i["sceneItemId"], i["sceneItemEnabled"]) for i in r["sceneItems"]][:14])
except Exception as e: print("plain name error:", e)
try:
    r = cl.send("GetSceneItemList", {"sceneUuid": None} if False else {"sceneName": "live Vertical", "canvasUuid": "292fcc0e-8af9-40f4-ad69-4f2b2cd3b312"}, raw=True); print("with canvasUuid:", [(i["sourceName"], i["sceneItemId"], i["sceneItemEnabled"]) for i in r["sceneItems"]][:14])
except Exception as e: print("canvasUuid error:", e)
for vendor in ("aitum-vertical-canvas", "aitum-vertical"):
    try:
        r = cl.send("CallVendorRequest", {"vendorName": vendor, "requestType": "version", "requestData": {}}, raw=True); print(vendor, "version:", r)
    except Exception as e: print(vendor, "error:", e)
