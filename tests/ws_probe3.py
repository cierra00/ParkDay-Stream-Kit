# Read-only: actual sizes of nested scenes on the vertical canvas.
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
import obsws_python as obs
c = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))
cl = obs.ReqClient(host="localhost", port=c.get("server_port", 4455), password=c.get("server_password", ""), timeout=5)
V = "292fcc0e-8af9-40f4-ad69-4f2b2cd3b312"
for sc in ("Now Vertical", "live clone Vertical", "live Vertical"):
    for i in cl.send("GetSceneItemList", {"sceneName": sc, "canvasUuid": V}, raw=True)["sceneItems"]:
        t = i["sceneItemTransform"]
        if i["sourceName"] in ("live", "Belabox IRL", "live Vertical") or i["isGroup"]:
            print(sc, "|", i["sourceName"], "src", t["sourceWidth"], "x", t["sourceHeight"], "-> drawn", round(t["width"]), "x", round(t["height"]), "at", round(t["positionX"]), round(t["positionY"]), "bounds", t["boundsType"], t["boundsWidth"], t["boundsHeight"])
