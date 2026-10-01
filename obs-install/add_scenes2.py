"""Round 2: two event 'Now:' scenes + full-screen Starting Soon and Signal Lost scenes.
Run only while OBS is closed. Backup goes to C:\\StreamerBot\\ctpg-pack. Safe to re-run."""
import json, copy, uuid, shutil, subprocess, sys, datetime, urllib.parse, os

PATH = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
BASE = "file:///C:/StreamerBot/ctpg-pack/"
# (scene name, source name, url, include live underneath)
NEW = [
    ("Now: Food & Wine",      "Now/Next - Food & Wine",      BASE + "overlay.html?now=" + urllib.parse.quote("Food & Wine Festival") + "&sub=EPCOT", True),
    ("Now: Halloween Party",  "Now/Next - Halloween Party",  BASE + "overlay.html?now=" + urllib.parse.quote("Not-So-Scary Halloween Party"), True),
    ("CTPG Starting Soon",    "CTPG Starting Soon screen",   BASE + "screens.html?screen=starting", False),
    ("CTPG Signal Lost",      "CTPG Signal Lost screen",     BASE + "screens.html?screen=signal", False),
]

if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout:
    sys.exit("OBS is running. Close OBS first, then run this again.")

backup = os.path.join(r"C:\StreamerBot\ctpg-pack", f"Moblin.backup-{datetime.datetime.now():%Y%m%d-%H%M%S}.json")
shutil.copy2(PATH, backup); print("Backup:", backup)

j = json.load(open(PATH, encoding="utf-8"))
by_name = {s["name"]: s for s in j["sources"]}
tmpl_scene, tmpl_browser = by_name["CTPG"], by_name["Browser 2"]
live_item = next(i for i in tmpl_scene["settings"]["items"] if i["name"] == "live")
order = [o["name"] for o in j["scene_order"]]
added = []

for scene_name, src_name, url, with_live in NEW:
    if scene_name in by_name: print("Skip (exists):", scene_name); continue
    b = copy.deepcopy(tmpl_browser)
    b.update({"name": src_name, "uuid": str(uuid.uuid4()), "mixers": 0, "hotkeys": {"ObsBrowser.Refresh": []}, "private_settings": {}})
    b["settings"] = {"is_local_file": False, "url": url, "width": 1920, "height": 1080,
                     "shutdown": True, "restart_when_active": True, "reroute_audio": True}
    s = copy.deepcopy(tmpl_scene)
    s.update({"name": scene_name, "uuid": str(uuid.uuid4()), "hotkeys": {}, "private_settings": {}})
    items = []
    if with_live:
        li = copy.deepcopy(live_item); li["id"] = 1; items.append(li)
    oi = copy.deepcopy(live_item); oi.update({"name": src_name, "source_uuid": b["uuid"], "id": len(items) + 1, "locked": False})
    items.append(oi)
    s["settings"] = {"id_counter": len(items), "custom_size": False, "items": items}
    j["sources"].extend([b, s])
    # event scenes go after the other Now: scenes; screens go next to 'starting' / 'low-data'
    anchor = "Now: Show" if with_live else ("starting" if "Starting" in scene_name else "low-data")
    names = [o["name"] for o in j["scene_order"]]
    pos = names.index(anchor) + 1 if anchor in names else len(names)
    j["scene_order"].insert(pos, {"name": scene_name})
    added.append(scene_name)

json.dump(j, open(PATH, "w", encoding="utf-8"), indent=4, ensure_ascii=False)
print("Added:", ", ".join(added) if added else "nothing")
print([o["name"] for o in j["scene_order"]])
