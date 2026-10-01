# Adds the new vertical BRB videos to pause Vertical and offline Vertical so they match horizontal.
# Keeps Halloween overlay and Media 2 (hidden, not deleted). Backs up Moblin.json first. Run only while OBS is closed.
import json, os, sys, copy, uuid, shutil, datetime, subprocess
sys.stdout.reconfigure(encoding="utf-8")
if subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout.find("obs64.exe") >= 0:
    sys.exit("OBS is running. Close OBS first; nothing changed.")
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
BK = P + f".bak-verticalbrb-{stamp}"
shutil.copy2(P, BK); print("backup:", BK)
j = json.load(open(P, encoding="utf-8"))
S = {s["name"]: s for s in j["sources"]}
plan = [
    # scene, template source (horizontal), new source name, new file, item to hide
    ("pause Vertical", "EPCOT - PAUSE", "EPCOT - PAUSE (Vertical)", "D:/OBS-Mobilin_old/brb/monorail-vertical.mp4", "Halloween overlay"),
    ("offline Vertical", "dca.mp4", "dca.mp4 (Vertical)", "D:/OBS-Mobilin_old/brb/dca-vertical.mp4", "Media 2"),
]
for scene, tmpl, newname, newfile, hide in plan:
    if newname in S: print("already exists, skipping:", newname); continue
    assert os.path.exists(newfile), newfile
    src = copy.deepcopy(S[tmpl]); src["name"] = newname; src["uuid"] = str(uuid.uuid4())
    src["settings"]["local_file"] = newfile
    j["sources"].append(src); S[newname] = src
    sc = S[scene]; items = sc["settings"]["items"]
    old = next(i for i in items if i["name"] == hide)
    new = copy.deepcopy(old); new["name"] = newname; new["source_uuid"] = src["uuid"]
    new["id"] = max(i["id"] for i in items) + 1; new["visible"] = True
    new["bounds_type"] = 2; new["bounds"] = {"x": 1080.0, "y": 1920.0}; new["pos"] = {"x": 0.0, "y": 0.0}; new["scale"] = {"x": 1.0, "y": 1.0}
    items.insert(items.index(old) + 1, new)
    old["visible"] = False
    sc["settings"]["id_counter"] = max(sc["settings"].get("id_counter", 0), new["id"])
    print(f"{scene}: added '{newname}' ({newfile}), hid '{hide}'")
tmp = P + ".tmp"
json.dump(j, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=4)
json.load(open(tmp, encoding="utf-8"))  # validate
os.replace(tmp, P); print("saved", P)
print("UNDO: close OBS, then copy", BK, "over", P)
