"""OBS round 3 (Sept 28): retire the "live clone" transition scene. Run with OBS CLOSED:
    python C:\\StreamerBot\\ctpg-pack\\apply_obs_fix3.py
live clone only existed to give banners a Luma Wipe Out on the way back to live. The Transition Table now does that directly:
  CTPG -> Now / live and neimad -> Now / live: Luma Wipe Out 1050 ms   (same effect as banner -> live clone before)
  cmr-create -> Now: Fade 250 ms   (same as cmr-create -> live already had)
  dance -> Now / live: Fade 3000 ms   (same as the old Scene Switcher Dance rule)
Disneyland Weather (only lived in live clone) moves into live and live Vertical, hidden, same position.
Scene Switcher rules that pointed at live clone are updated; the two paused ones that only served live clone are removed.
Scenes "live clone" and "live clone Vertical" are deleted.
Undo: copy the printed backup over Moblin.json (OBS closed)."""
import json, os, shutil, subprocess, sys, time, copy
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout:
    sys.exit("OBS is running. Close OBS first, then run this again.")
bak = P + ".bak-fix3-" + time.strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, bak); print("backup:", bak)
d = json.load(open(P, encoding="utf-8")); out = []
S = {s["name"]: s for s in d["sources"]}
# 1. transition table
tt = d["modules"]["transition-table"]["transitions"]
tt[:] = [t for t in tt if t["to_scene"] != "live clone" and t["from_scene"] != "live clone"]
want = [("CTPG", "Now", "Luma Wipe Out", 1050), ("CTPG", "live", "Luma Wipe Out", 1050), ("neimad", "Now", "Luma Wipe Out", 1050), ("neimad", "live", "Luma Wipe Out", 1050),
        ("cmr-create", "Now", "Fade", 250), ("dance", "Now", "Fade", 3000), ("dance", "live", "Fade", 3000)]
for f, t, tr, ms in want:
    if not any(x["from_scene"] == f and x["to_scene"] == t for x in tt):
        tt.append({"canvas": "Main", "from_scene": f, "to_scene": t, "transition": tr, "duration": ms}); out.append(f"transition {f} -> {t}: {tr} {ms} ms")
# 2. Disneyland Weather into live / live Vertical
for src_scene, dst_scene in (("live clone", "live"), ("live clone Vertical", "live Vertical")):
    items = S[dst_scene]["settings"]["items"]
    if any(i["name"] == "Disneyland Weather" for i in items): continue
    it = copy.deepcopy(next(i for i in S[src_scene]["settings"]["items"] if i["name"] == "Disneyland Weather"))
    it["id"] = max(i["id"] for i in items) + 1; it["visible"] = False
    S[dst_scene]["settings"]["id_counter"] = max(S[dst_scene]["settings"].get("id_counter", 0), it["id"])
    pos = next(k for k, i in enumerate(items) if i["name"] == "Universal Weather") + 1
    items.insert(pos, it); out.append(f"Disneyland Weather added to {dst_scene} (hidden)")
# 3. Scene Switcher
macros = d["modules"]["advanced-scene-switcher"]["macros"]
ren = {"live clone": "live", "live clone Vertical": "live Vertical"}
for m in macros:
    if m["name"] in ("Turn off DL Weather", "Vertical: Disneyland Weather on"):
        for a in m["actions"]:
            n = a["sceneSelection"]["name"]
            if n in ren: a["sceneSelection"]["name"] = ren[n]; out.append(f"'{m['name']}': {n} -> {ren[n]}")
before = len(macros)
macros[:] = [m for m in macros if m["name"] not in ("clone to live", "neimad to live ")]
out.append(f"removed {before - len(macros)} paused rules (clone to live, neimad to live)")
# 4. delete the scenes
gone = {"live clone", "live clone Vertical"}
for s in d["sources"]:
    if s["id"] == "scene":
        for i in s["settings"]["items"]:
            assert i["name"] not in gone, f"{s['name']} still nests {i['name']}"
d["sources"] = [s for s in d["sources"] if s["name"] not in gone]
d["scene_order"] = [x for x in d["scene_order"] if x["name"] not in gone]
out.append("deleted scenes live clone and live clone Vertical")
with open(P, "w", encoding="utf-8", newline="") as f:
    json.dump(d, f, indent=4, ensure_ascii=False)
json.load(open(P, encoding="utf-8")); print("\n".join(out)); print("Done. Open OBS.")
