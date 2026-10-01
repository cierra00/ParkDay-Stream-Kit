# Sets the Now card look on the two planner overlay sources. Usage: python apply_look.py ticket|bar|sign|classic
import json, os, sys, shutil, datetime, subprocess, re
sys.stdout.reconfigure(encoding="utf-8")
look = (sys.argv[1] if len(sys.argv) > 1 else "ticket").lower()
if look not in ("ticket", "bar", "sign", "classic"): sys.exit("look must be ticket, bar, sign or classic")
if "obs64.exe" in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout:
    sys.exit("OBS is running. Close OBS first; nothing changed.")
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
BK = P + ".bak-look-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, BK); print("backup:", BK)
j = json.load(open(P, encoding="utf-8"))
n = 0
for s in j["sources"]:
    if s["name"] in ("Now/Next (Planner)", "Now/Next (Planner) (Vertical)"):
        u = re.sub(r"&look=[a-z]+", "", s["settings"]["url"])
        if look != "classic": u += "&look=" + look
        s["settings"]["url"] = u; n += 1
        print(s["name"], "->", u)
if n != 2: sys.exit(f"expected 2 planner sources, found {n}; nothing saved")
tmp = P + ".tmp"; json.dump(j, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=4)
json.load(open(tmp, encoding="utf-8")); os.replace(tmp, P); print("saved")
print("UNDO: close OBS, copy", BK, "over", P)
