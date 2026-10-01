import json, os, sys, subprocess, shutil, datetime, glob
sys.stdout.reconfigure(encoding="utf-8")
if "obs64.exe" in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout:
    sys.exit("OBS is running. Close OBS first; nothing changed.")
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
j = json.load(open(P, encoding="utf-8"))
SC = "CTPG Signal Lost"
# refuse if anything else refers to the scene
ass = json.dumps(j.get("modules", {}).get("advanced-scene-switcher", {}))
sb = "".join(open(f, encoding="utf-8", errors="ignore").read() for f in glob.glob(r"D:\OBS-Mobilin_old\OBS-CTPG\Streamer.bot-x64-1.0.1\data\*.json"))
if json.dumps(SC) in ass or json.dumps(SC) in sb: sys.exit("Something still uses this scene; nothing changed.")
BK = P + ".bak-signallost-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, BK); print("backup:", BK)
scene = next(s for s in j["sources"] if s["name"] == SC)
inner = {i.get("source_uuid") for i in scene["settings"]["items"]}
j["sources"] = [s for s in j["sources"] if s["name"] != SC]
used = {i.get("source_uuid") for s in j["sources"] if s.get("id") in ("scene", "group") for i in s["settings"].get("items", [])}
drop = [s["name"] for s in j["sources"] if s.get("uuid") in inner and s["uuid"] not in used and s.get("id") != "scene"]
j["sources"] = [s for s in j["sources"] if s["name"] not in drop]
j["scene_order"] = [o for o in j["scene_order"] if o.get("name") != SC]
for k in ("current_scene", "current_program_scene"):
    if j.get(k) == SC: j[k] = "live"
if json.dumps(SC) in json.dumps(j): print("NOTE: name still appears somewhere")
tmp = P + ".tmp"; json.dump(j, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=4)
json.load(open(tmp, encoding="utf-8")); os.replace(tmp, P)
print("removed scene:", SC, "| removed sources:", drop)
print("scene list:", [o["name"] for o in j["scene_order"]])
print("UNDO: close OBS, copy", BK, "over", P)
