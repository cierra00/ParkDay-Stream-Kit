"""OBS fix round 2 (Sept 28, after the live test). Run with OBS CLOSED:
    python C:\\StreamerBot\\ctpg-pack\\apply_obs_fix2.py
- Scene Switcher "Dance" paused: its "previous scene" always went to "offline". Streamer.bot "CTPG Dance Return" does it now.
- Scene Switcher "Turn off DL Weather" hid the item in "live", but Disneyland Weather only exists in "live clone",
  so it never turned off. It now hides it in "live clone" (and the vertical copy).
Undo: copy the printed backup over Moblin.json (OBS closed)."""
import json, os, shutil, subprocess, sys, time
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout:
    sys.exit("OBS is running. Close OBS first, then run this again.")
bak = P + ".bak-fix2-" + time.strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, bak); print("backup:", bak)
d = json.load(open(P, encoding="utf-8"))
M = {m["name"]: m for m in d["modules"]["advanced-scene-switcher"]["macros"]}
M["Dance"]["pause"] = True; print("paused 'Dance'")
for a in M["Turn off DL Weather"]["actions"]:
    if a["sceneSelection"].get("canvasSelection") == "Main" and a["sceneSelection"]["name"] == "live":
        a["sceneSelection"]["name"] = "live clone"; print("'Turn off DL Weather' now hides it in live clone")
with open(P, "w", encoding="utf-8", newline="") as f:
    json.dump(d, f, indent=4, ensure_ascii=False)
json.load(open(P, encoding="utf-8")); print("Done. Open OBS.")
