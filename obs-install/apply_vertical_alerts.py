"""Moves the alert overlays on the vertical (mobile) canvas so they stop colliding. Run with OBS CLOSED.
 - 5th SC (dance banner): centered, upper-middle (was almost fully off the left edge)
 - Superchat card: right side, just above the New Subscriber card (was top-right, under the weather)
 - New Subscriber: unchanged
Horizontal scenes are not touched. Undo: copy the printed backup over Moblin.json."""
import json, os, shutil, subprocess, sys, time
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
if len(sys.argv) > 1: P = sys.argv[1]
try:
    if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout: sys.exit("OBS is running. Close it first.")
except FileNotFoundError: pass
bak = P + ".bak-vertalerts-" + time.strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, bak); print("backup:", bak)
d = json.load(open(P, encoding="utf-8")); S = {s["name"]: s for s in d["sources"]}
NEW = {"5th SC": (-461.0, -340.0, 1.043), "Superchat": (-966.0, 3.0, 1.106)}
W, H = 1080.0, 1920.0
for it in S["live Vertical"]["settings"]["items"]:
    if it["name"] in NEW:
        x, y, s = NEW[it["name"]]; ref = it.get("scale_ref", {"x": W, "y": H})
        print("before", it["name"], it["pos"], it["scale"])
        it["pos"] = {"x": x, "y": y}; it["scale"] = {"x": s, "y": s}
        it["pos_rel"] = {"x": (x - W / 2) / (H / 2), "y": (y - H / 2) / (H / 2)}
        it["scale_rel"] = {"x": s * ref["x"] / W, "y": s * ref["y"] / H}
        print("after ", it["name"], it["pos"], it["scale"])
with open(P, "w", encoding="utf-8", newline="") as f: json.dump(d, f, indent=4, ensure_ascii=False)
json.load(open(P, encoding="utf-8")); print("Done. Open OBS.")
