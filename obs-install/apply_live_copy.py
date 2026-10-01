# Adds a copy of the planner card to "live" and "live Vertical" (link has &scene=live).
# It stays hidden unless "Also show on the live scene" is On in the app. Backs up first. Only runs while OBS is closed.
import json, os, sys, copy, uuid, shutil, datetime, subprocess
sys.stdout.reconfigure(encoding="utf-8")
if "obs64.exe" in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout:
    sys.exit("OBS is running. Close OBS first; nothing changed.")
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
BK = P + ".bak-livecopy-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, BK); print("backup:", BK)
j = json.load(open(P, encoding="utf-8")); S = {s["name"]: s for s in j["sources"]}
plan = [("live", "Now", "Now/Next (Planner)", "Now/Next (on live)"),
        ("live Vertical", "Now Vertical", "Now/Next (Planner) (Vertical)", "Now/Next (on live) (Vertical)")]
for scene, now_scene, tmpl, name in plan:
    if name in S: print("exists, skipped:", name); continue
    src = copy.deepcopy(S[tmpl]); src["name"] = name; src["uuid"] = str(uuid.uuid4())
    src["settings"]["url"] = S[tmpl]["settings"]["url"] + "&scene=live"
    src["settings"].update({"shutdown": True, "restart_when_active": True})
    j["sources"].append(src); S[name] = src
    tit = next(i for i in S[now_scene]["settings"]["items"] if i["name"] == tmpl)
    items = S[scene]["settings"]["items"]
    it = copy.deepcopy(tit); it.update({"name": name, "source_uuid": src["uuid"], "visible": True, "id": max(i["id"] for i in items) + 1})
    anchor = next(i for i in items if i["name"] == "IRL Mix")   # above the camera, below the alerts
    items.insert(items.index(anchor) + 1, it)
    S[scene]["settings"]["id_counter"] = max(S[scene]["settings"].get("id_counter", 0), it["id"])
    print(f"{scene}: added '{name}' -> {src['settings']['url']}")
tmp = P + ".tmp"; json.dump(j, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=4)
json.load(open(tmp, encoding="utf-8")); os.replace(tmp, P); print("saved")
for n in ("live", "live Vertical"): print(n, "::", [(i["name"], i["visible"]) for i in S[n]["settings"]["items"]])
print("UNDO: close OBS, copy", BK, "over", P)
