"""Gives every 'Now:' scene a matching vertical scene, the same way your other scenes work
(e.g. CTPG -> CTPG Vertical): the vertical scene holds 'live' positioned like CTPG Vertical,
plus the Now/Next overlay in its 1080x1920 layout. Also removes the extra 'CTPG Starting Soon' scene.
Nothing else is touched. Run only while OBS is closed. Backup first. Safe to re-run."""
import json, copy, uuid, shutil, subprocess, sys, datetime, os, urllib.parse

PATH = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout:
    sys.exit("OBS is running. Close OBS first, then run this again.")
backup = os.path.join(r"C:\StreamerBot\ctpg-pack", f"Moblin.backup-{datetime.datetime.now():%Y%m%d-%H%M%S}.json")
shutil.copy2(PATH, backup); print("Backup:", backup)

j = json.load(open(PATH, encoding="utf-8"))
by = {s["name"]: s for s in j["sources"]}

# --- remove the extra Starting Soon scene I added (you already have starting/countdown/intro) ---
for name in ("CTPG Starting Soon", "CTPG Starting Soon screen"):
    if name in by:
        j["sources"] = [s for s in j["sources"] if s["name"] != name]
        print("Removed:", name)
j["scene_order"] = [o for o in j["scene_order"] if o["name"] != "CTPG Starting Soon"]
by = {s["name"]: s for s in j["sources"]}

tmpl_v = by["CTPG Vertical"]                      # your existing vertical banner scene = template
live_v_item = next(i for i in tmpl_v["settings"]["items"] if i["name"] == "live")
overlay_item_tmpl = next(i for i in tmpl_v["settings"]["items"] if i["name"] != "live")
max_order = max(s["settings"].get("order", 0) for s in j["sources"] if s.get("canvas_uuid") == tmpl_v["canvas_uuid"])

made = []
for s in list(j["sources"]):
    if s["id"] != "scene" or not s["name"].startswith("Now: ") or s.get("canvas_uuid") == tmpl_v["canvas_uuid"]:
        continue
    vname = s["name"] + " Vertical"
    if vname in by:
        print("Skip (exists):", vname); continue
    # find this scene's horizontal overlay source and make a vertical copy of it
    h_item = next(i for i in s["settings"]["items"] if i["name"] != "live")
    h_src = by[h_item["name"]]
    v_src = copy.deepcopy(h_src)
    v_src["name"] = h_src["name"] + " (Vertical)"
    v_src["uuid"] = str(uuid.uuid4())
    v_src["settings"] = dict(h_src["settings"], url=h_src["settings"]["url"] + "&layout=vertical", width=1080, height=1920)
    # vertical scene: live (same position as CTPG Vertical) + vertical overlay filling the canvas
    v = copy.deepcopy(tmpl_v)
    v["name"] = vname; v["uuid"] = str(uuid.uuid4()); v["hotkeys"] = {}; v["private_settings"] = {}
    li = copy.deepcopy(live_v_item); li["id"] = 1
    oi = copy.deepcopy(overlay_item_tmpl)
    oi.update({"name": v_src["name"], "source_uuid": v_src["uuid"], "id": 2, "locked": False, "visible": True,
               "bounds_type": 2, "bounds": {"x": 1080.0, "y": 1920.0}, "pos": {"x": 0.0, "y": 0.0}, "scale": {"x": 1.0, "y": 1.0}})
    max_order += 1
    v["settings"] = {"id_counter": 2, "custom_size": False, "items": [li, oi], "canvas_active": False, "order": max_order}
    j["sources"].extend([v_src, v])
    # link the horizontal scene to its vertical twin (same as your other scenes)
    s["settings"]["canvas"] = [{"width": 1080, "height": 1920, "scene": vname}]
    made.append(vname)

json.dump(j, open(PATH, "w", encoding="utf-8"), indent=4, ensure_ascii=False)
print("Created:", ", ".join(made) if made else "nothing")
