# Off-air: grab what each weather page draws (800x600), to place it on the vertical canvas. Restores visibility.
import json, os, sys, time, base64
sys.stdout.reconfigure(encoding="utf-8")
import obsws_python as obs
c = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))
cl = obs.ReqClient(host="localhost", port=c.get("server_port", 4455), password=c.get("server_password", ""), timeout=10)
assert not cl.get_stream_status().output_active, "streaming - stop"
V = "292fcc0e-8af9-40f4-ad69-4f2b2cd3b312"
for src, scene, iid in (("WDW Weather", "live Vertical", 5), ("Universal Weather", "live Vertical", 6), ("Disneyland Weather", "live clone Vertical", 4)):
    print(src, cl.send("GetInputSettings", {"inputName": src}, raw=True)["inputSettings"].get("width"), "default size")
    cl.send("SetSceneItemEnabled", {"sceneName": scene, "canvasUuid": V, "sceneItemId": iid, "sceneItemEnabled": True}, raw=True)
    time.sleep(6)
    r = cl.send("GetSourceScreenshot", {"sourceName": src, "imageFormat": "png"}, raw=True)
    open(os.path.join(os.path.dirname(__file__), "wx-" + src.split()[0].lower() + ".png"), "wb").write(base64.b64decode(r["imageData"].split(",", 1)[1]))
    cl.send("SetSceneItemEnabled", {"sceneName": scene, "canvasUuid": V, "sceneItemId": iid, "sceneItemEnabled": False}, raw=True)
    print("saved", src)
