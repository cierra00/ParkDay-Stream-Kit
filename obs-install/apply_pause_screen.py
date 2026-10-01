# Adds the new Offline Screen (offline.html, direction B) to offline and offline Vertical.
# Hides the Mickey videos (kept). Music untouched. Backs up first. Only runs while OBS is closed.
import json, os, sys, copy, uuid, shutil, datetime, subprocess
sys.stdout.reconfigure(encoding="utf-8")
if "obs64.exe" in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout:
    sys.exit("OBS is running. Close OBS first; nothing changed.")
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
BK = P + ".bak-pausescreen-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
shutil.copy2(P, BK); print("backup:", BK)
j = json.load(open(P, encoding="utf-8")); S = {s["name"]: s for s in j["sources"]}
T = S["CTPG Signal Lost screen"]
plan = [
    ("pause", "Pause Screen", "file:///C:/StreamerBot/ctpg-pack/offline.html?mode=pause", 1920, 1080, "EPCOT - PAUSE", "CTPG Signal Lost", "CTPG Signal Lost screen"),
    ("pause Vertical", "Pause Screen (Vertical)", "file:///C:/StreamerBot/ctpg-pack/offline.html?mode=pause&layout=vertical", 1080, 1920, "EPCOT - PAUSE (Vertical)", "pause Vertical", "EPCOT - PAUSE (Vertical)"),
]
for scene, name, url, w, h, hide, tmpl_scene, tmpl_item in plan:
    if name in S: print("exists, skipped:", name); continue
    src = copy.deepcopy(T); src["name"] = name; src["uuid"] = str(uuid.uuid4())
    src["settings"].update({"is_local_file": False, "url": url, "width": w, "height": h, "shutdown": True, "restart_when_active": True})
    j["sources"].append(src); S[name] = src
    items = S[scene]["settings"]["items"]
    tmpl = copy.deepcopy(next(i for i in S[tmpl_scene]["settings"]["items"] if i["name"] == tmpl_item))
    tmpl.update({"name": name, "source_uuid": src["uuid"], "visible": True, "id": max(i["id"] for i in items) + 1})
    old = next(i for i in items if i["name"] == hide)
    items.insert(items.index(old) + 1, tmpl)
    old["visible"] = False
    S[scene]["settings"]["id_counter"] = max(S[scene]["settings"].get("id_counter", 0), tmpl["id"])
    print(f"{scene}: added '{name}' -> {url}; hid '{hide}'")
tmp = P + ".tmp"; json.dump(j, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=4)
json.load(open(tmp, encoding="utf-8")); os.replace(tmp, P); print("saved")
for n in ("pause", "pause Vertical"):
    print(n, "::", [(i["name"], i["visible"]) for i in S[n]["settings"]["items"]])
print("UNDO: close OBS, copy", BK, "over", P)

