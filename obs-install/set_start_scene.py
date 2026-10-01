# Sets the scene OBS opens on (main + vertical) to offline. Run with OBS CLOSED.
import json, os, shutil, time, subprocess, sys
if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout: sys.exit("OBS is running. Close it first.")
t = time.strftime("%Y%m%d-%H%M%S")
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
V = os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\vertical-canvas\config.json")
shutil.copy2(P, P + ".bak-startscene-" + t); shutil.copy2(V, V + ".bak-startscene-" + t)
d = json.load(open(P, encoding="utf-8")); print("main was:", d.get("current_program_scene"))
d["current_scene"] = d["current_program_scene"] = "offline"
with open(P, "w", encoding="utf-8", newline="") as f: json.dump(d, f, indent=4, ensure_ascii=False)
raw = open(V, "rb").read(); bom = raw.startswith(b"\xef\xbb\xbf"); s = raw.decode("utf-8-sig")
old, new = '"current_scene":"subs Vertical"', '"current_scene":"offline Vertical"'
print("vertical replaced:", s.count(old)); s = s.replace(old, new); json.loads(s)
open(V, "wb").write((b"\xef\xbb\xbf" if bom else b"") + s.encode("utf-8"))
print("main now:", json.load(open(P, encoding="utf-8"))["current_program_scene"], "| backups .bak-startscene-" + t)
