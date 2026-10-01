"""Adds "Now: ..." scenes (live scene + Now/Next overlay) to the Moblin OBS scene collection.
Run only while OBS is closed. Makes a backup first. Safe to re-run (skips scenes that already exist)."""
import json, copy, uuid, shutil, subprocess, sys, datetime, urllib.parse, os

PATH = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
OVERLAY = "file:///C:/StreamerBot/ctpg-pack/overlay.html"
SCENES = ["Rope Drop", "Riding", "In Line", "Eats", "Shopping", "Parade", "Fireworks", "Walking", "Characters", "Show"]

if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout:
    sys.exit("OBS is running. Close OBS first, then run this again.")

backup = PATH.replace(".json", f".backup-{datetime.datetime.now():%Y%m%d-%H%M%S}.json")
shutil.copy2(PATH, backup)
print("Backup:", backup)

j = json.load(open(PATH, encoding="utf-8"))
by_name = {s["name"]: s for s in j["sources"]}
tmpl_scene = by_name["CTPG"]
tmpl_browser = by_name["Browser 2"]
live_item = next(i for i in tmpl_scene["settings"]["items"] if i["name"] == "live")

order = [o["name"] for o in j["scene_order"]]
insert_at = order.index("live") + 1
added = []

for label in SCENES:
    scene_name = f"Now: {label}"
    src_name = f"Now/Next - {label}"
    if scene_name in by_name:
        print("Skip (exists):", scene_name); continue

    # browser source
    b = copy.deepcopy(tmpl_browser)
    b["name"] = src_name
    b["uuid"] = str(uuid.uuid4())
    b["mixers"] = 0
    b["settings"] = {
        "is_local_file": False,
        "url": OVERLAY + "?now=" + urllib.parse.quote(label),
        "width": 1920, "height": 1080,
        "shutdown": True, "restart_when_active": True, "reroute_audio": True,
    }
    b["hotkeys"] = {"ObsBrowser.Refresh": []}
    b["private_settings"] = {}

    # scene: live (locked, full frame) + overlay on top
    s = copy.deepcopy(tmpl_scene)
    s["name"] = scene_name
    s["uuid"] = str(uuid.uuid4())
    li = copy.deepcopy(live_item); li["id"] = 1
    oi = copy.deepcopy(live_item); oi.update({"name": src_name, "source_uuid": b["uuid"], "id": 2, "locked": False})
    s["settings"] = {"id_counter": 2, "custom_size": False, "items": [li, oi]}
    s["hotkeys"] = {}
    s["private_settings"] = {}

    j["sources"].extend([b, s])
    j["scene_order"].insert(insert_at + len(added), {"name": scene_name})
    added.append(scene_name)

json.dump(j, open(PATH, "w", encoding="utf-8"), indent=4, ensure_ascii=False)
print("Added:", ", ".join(added) if added else "nothing")
