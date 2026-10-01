"""Adds the new animated Low Data badge (lowdata.html) to low-data and low-data Vertical. Run with OBS CLOSED.
The old Low Data Icon / Image 3 are hidden, not deleted (show them again in OBS to go back).
Undo: copy the printed backup over Moblin.json."""
import json, os, shutil, subprocess, sys, time, uuid, copy
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout: sys.exit("OBS is running. Close it first.")
bak = P + ".bak-lowdatabadge-" + time.strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, bak); print("backup:", bak)
d = json.load(open(P, encoding="utf-8")); S = {s["name"]: s for s in d["sources"]}
URL = "file:///C:/StreamerBot/ctpg-pack/lowdata.html"
for scene, tmpl_scene, tmpl_item, name, url, (w, h) in (
        ("low-data", "Now", "Now/Next (Planner)", "Low Data Badge", URL, (1920, 1080)),
        ("low-data Vertical", "Now Vertical", "Now/Next (Planner) (Vertical)", "Low Data Badge (Vertical)", URL + "?layout=vertical", (1080, 1920))):
    if name not in S:
        src = copy.deepcopy(S[tmpl_item]); src["name"] = name; src["uuid"] = str(uuid.uuid4())
        src["settings"] = {**src["settings"], "url": url, "width": w, "height": h, "is_local_file": False, "shutdown": True, "restart_when_active": True}
        src["settings"].pop("webpage_control_level", None)
        for k in ("filters", "hotkeys"): src.pop(k, None)
        d["sources"].append(src); S[name] = src
    items = S[scene]["settings"]["items"]
    for it in items:
        if it["name"] in ("Low Data Icon", "Image 3"): it["visible"] = False
    if not any(it["name"] == name for it in items):
        it = copy.deepcopy(next(i for i in S[tmpl_scene]["settings"]["items"] if i["name"] == tmpl_item))
        it["name"] = name; it["source_uuid"] = S[name]["uuid"]; it["id"] = max(i["id"] for i in items) + 1; it["visible"] = True
        S[scene]["settings"]["id_counter"] = max(S[scene]["settings"].get("id_counter", 0), it["id"])
        items.append(it)
    print(scene, [(i["name"], i["visible"]) for i in items])
with open(P, "w", encoding="utf-8", newline="") as f: json.dump(d, f, indent=4, ensure_ascii=False)
json.load(open(P, encoding="utf-8")); print("Done. Open OBS.")
