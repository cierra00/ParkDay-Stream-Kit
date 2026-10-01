"""OBS round 4 (Sept 28): the vertical twins of subs, nick, cmr-create, CTPG, neimad and low-data nested the WIDE
live scene at 2x (a zoomed crop, none of the vertical overlays). They now nest live Vertical at full size, bottom layer,
like Now Vertical. Their own banners/images are untouched. Run with OBS CLOSED.
Undo: copy the printed backup over Moblin.json."""
import json, os, shutil, subprocess, sys, time
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout: sys.exit("OBS is running. Close it first.")
bak = P + ".bak-fix4-" + time.strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, bak); print("backup:", bak)
d = json.load(open(P, encoding="utf-8")); S = {s["name"]: s for s in d["sources"]}; LV = S["live Vertical"]
VW, VH = 1080, 1920
for sc in ("subs", "nick", "cmr-create", "CTPG", "neimad", "low-data"):
    items = S[sc + " Vertical"]["settings"]["items"]
    for it in items:
        if it["name"] == "live":
            it["name"] = "live Vertical"; it["source_uuid"] = LV["uuid"]
            it["pos"] = {"x": 0.0, "y": 0.0}; it["pos_rel"] = {"x": -VW / VH, "y": -1.0}
            it["scale"] = {"x": 1.0, "y": 1.0}; it["scale_rel"] = {"x": 1.0, "y": 1.0}; it["scale_ref"] = {"x": float(VW), "y": float(VH)}
            it["bounds_type"] = 0; it["bounds"] = {"x": 0.0, "y": 0.0}; it["bounds_rel"] = {"x": 0.0, "y": 0.0}
            it["crop_left"] = it["crop_top"] = it["crop_right"] = it["crop_bottom"] = 0; it["rot"] = 0.0
    i = next(k for k, it in enumerate(items) if it["name"] == "live Vertical")
    if i: items.insert(0, items.pop(i))
    print(sc + " Vertical:", [it["name"] for it in items])
with open(P, "w", encoding="utf-8", newline="") as f: json.dump(d, f, indent=4, ensure_ascii=False)
json.load(open(P, encoding="utf-8")); print("Done.")
