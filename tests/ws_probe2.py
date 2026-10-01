# Off-air check: vertical weather items (position) and whether SetSceneItemEnabled works on the Aitum canvas. Restores state.
import json, os, sys, time
sys.stdout.reconfigure(encoding="utf-8")
import obsws_python as obs
c = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))
cl = obs.ReqClient(host="localhost", port=c.get("server_port", 4455), password=c.get("server_password", ""), timeout=5)
assert not cl.get_stream_status().output_active, "streaming - stop"
V = "292fcc0e-8af9-40f4-ad69-4f2b2cd3b312"
for scene, canvas in (("live Vertical", V), ("live clone Vertical", V), ("live", None), ("live clone", None)):
    p = {"sceneName": scene}; 
    if canvas: p["canvasUuid"] = canvas
    items = cl.send("GetSceneItemList", p, raw=True)["sceneItems"]
    for i in items:
        if "Weather" in i["sourceName"]:
            t = i["sceneItemTransform"]
            print(scene, "|", i["sourceName"], "id", i["sceneItemId"], "on", i["sceneItemEnabled"], "pos", round(t["positionX"]), round(t["positionY"]), "size", round(t["width"]), "x", round(t["height"]), "scale", round(t["scaleX"], 2))
r = cl.send("GetSceneItemId", {"sceneName": "live Vertical", "canvasUuid": V, "sourceName": "WDW Weather"}, raw=True); iid = r["sceneItemId"]; print("GetSceneItemId ok:", iid)
cl.send("SetSceneItemEnabled", {"sceneName": "live Vertical", "canvasUuid": V, "sceneItemId": iid, "sceneItemEnabled": True}, raw=True)
time.sleep(0.5)
print("after enable:", cl.send("GetSceneItemEnabled", {"sceneName": "live Vertical", "canvasUuid": V, "sceneItemId": iid}, raw=True))
cl.send("SetSceneItemEnabled", {"sceneName": "live Vertical", "canvasUuid": V, "sceneItemId": iid, "sceneItemEnabled": False}, raw=True)
print("restored:", cl.send("GetSceneItemEnabled", {"sceneName": "live Vertical", "canvasUuid": V, "sceneItemId": iid}, raw=True))
print("vertical canvas video:", [ (x.get("canvasName"), x.get("canvasVideoSettings") or x.get("videoSettings")) for x in cl.send("GetCanvasList", raw=True)["canvases"]])
