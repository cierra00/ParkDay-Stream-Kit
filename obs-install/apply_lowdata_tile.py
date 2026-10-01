"""Puts the Low Data Mode tile video (low-data-classic.webm) into low-data and low-data Vertical as looping Media Sources.
Run with OBS CLOSED. The old Low Data Badge browser sources are hidden, not deleted.
Undo: copy the printed backup over Moblin.json."""
import json, os, shutil, subprocess, sys, time, uuid, copy
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
if len(sys.argv) > 1: P = sys.argv[1]
try:
    if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout: sys.exit("OBS is running. Close it first.")
except FileNotFoundError: pass
bak = P + ".bak-lowdatatile-" + time.strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, bak); print("backup:", bak)
d = json.load(open(P, encoding="utf-8")); S = {s["name"]: s for s in d["sources"]}
FILE = "C:/StreamerBot/ctpg-pack/low-data-classic.webm"
# (scene, old badge, new name, pos, scale, pos_rel, scale_rel)
PLAN = (("low-data", "Low Data Badge", "Low Data Tile", (0.0, 1520.0), 1.0, (-1.7777777910232544, 0.40740740299224854), 0.5),
        ("low-data Vertical", "Low Data Badge (Vertical)", "Low Data Tile (Vertical)", (0.0, 1432.0), 0.625, (-0.5625, 0.49166667461395264), 0.625))
for scene, old, name, pos, sc, prel, srel in PLAN:
    if name not in S:
        src = copy.deepcopy(S[old]); src["name"] = name; src["uuid"] = str(uuid.uuid4())
        src["id"] = src["versioned_id"] = "ffmpeg_source"
        src["settings"] = {"local_file": FILE, "is_local_file": True, "looping": True, "restart_on_activate": True,
                           "close_when_inactive": False, "hw_decode": False, "clear_on_media_end": False}
        for k in ("filters", "hotkeys", "private_settings"): src.pop(k, None)
        src["muted"] = True
        d["sources"].append(src); S[name] = src
    items = S[scene]["settings"]["items"]
    for it in items:
        if it["name"] == old: it["visible"] = False
    if not any(it["name"] == name for it in items):
        it = copy.deepcopy(next(i for i in items if i["name"] == old))
        it.update(name=name, source_uuid=S[name]["uuid"], id=max(i["id"] for i in items) + 1, visible=True, bounds_type=0)
        it["pos"] = {"x": pos[0], "y": pos[1]}; it["scale"] = {"x": sc, "y": sc}
        it["pos_rel"] = {"x": prel[0], "y": prel[1]}; it["scale_rel"] = {"x": srel, "y": srel}
        S[scene]["settings"]["id_counter"] = max(S[scene]["settings"].get("id_counter", 0), it["id"])
        items.append(it)
    print(scene, [(i["name"], i["visible"]) for i in items])
with open(P, "w", encoding="utf-8", newline="") as f: json.dump(d, f, indent=4, ensure_ascii=False)
json.load(open(P, encoding="utf-8")); print("Done. Open OBS.")
