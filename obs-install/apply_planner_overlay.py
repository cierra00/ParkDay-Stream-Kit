# Adds the Park Day planner overlay (overlay.html?planner=1) to "live" and "live Vertical".
# Copies look/size/position from the existing Now/Next - Riding items. Nothing is removed or hidden.
# Backs up first. Only runs while OBS is closed.
import json, os, sys, copy, uuid, shutil, datetime, subprocess
sys.stdout.reconfigure(encoding="utf-8")
if "obs64.exe" in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout:
    sys.exit("OBS is running. Close OBS first; nothing changed.")
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
BK = P + ".bak-planneroverlay-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
shutil.copy2(P, BK); print("backup:", BK)
j = json.load(open(P, encoding="utf-8")); S = {s["name"]: s for s in j["sources"]}
scenes = [s for s in j["sources"] if s.get("id") == "scene"]

def item_for(src_name):
    for sc in scenes:
        for it in sc["settings"].get("items", []):
            if it["name"] == src_name: return sc["name"], it
    sys.exit("template item not found: " + src_name)

plan = [
    ("live", "Now/Next (Planner)", "file:///C:/StreamerBot/ctpg-pack/overlay.html?planner=1", "Now/Next - Riding"),
    ("live Vertical", "Now/Next (Planner) (Vertical)", "file:///C:/StreamerBot/ctpg-pack/overlay.html?planner=1&layout=vertical", "Now/Next - Riding (Vertical)"),
]
for scene, name, url, tmpl_name in plan:
    if name in S: print("exists, skipped:", name); continue
    T = S[tmpl_name]
    src = copy.deepcopy(T); src["name"] = name; src["uuid"] = str(uuid.uuid4())
    src["settings"].update({"is_local_file": False, "url": url, "shutdown": True, "restart_when_active": True})
    j["sources"].append(src); S[name] = src
    tscene, titem = item_for(tmpl_name)
    items = S[scene]["settings"]["items"]
    it = copy.deepcopy(titem)
    it.update({"name": name, "source_uuid": src["uuid"], "visible": True, "id": max(i["id"] for i in items) + 1})
    anchor = next(i for i in items if i["name"] == "IRL Mix")   # above the camera, below the alerts
    items.insert(items.index(anchor) + 1, it)
    S[scene]["settings"]["id_counter"] = max(S[scene]["settings"].get("id_counter", 0), it["id"])
    print(f"{scene}: added '{name}' (look copied from '{tmpl_name}' in '{tscene}') -> {url}")
tmp = P + ".tmp"; json.dump(j, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=4)
json.load(open(tmp, encoding="utf-8")); os.replace(tmp, P); print("saved")
for n in ("live", "live Vertical"):
    print(n, "::", [(i["name"], i["visible"]) for i in S[n]["settings"]["items"]])
print("UNDO: close OBS, copy", BK, "over", P)
