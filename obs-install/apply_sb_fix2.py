"""Streamer.bot fix round 2 (Sept 28, after the live test). Run with Streamer.bot CLOSED:
    python C:\\StreamerBot\\ctpg-pack\\apply_sb_fix2.py
- "CTPG Home Scene" had two scene triggers (Now, live); in the test only the LAST one ever fired. Split into
  "CTPG Home Scene (Now)" and "CTPG Home Scene (live)", one trigger each.
- New "CTPG Dance Return": when the dance video ends, go back to your home scene (Now or live). The Scene Switcher
  "previous scene" option always went to "offline" in the test, so that rule is paused by apply_obs_fix2.py.
Undo: copy the printed backup over data\\actions.json (Streamer.bot closed)."""
import json, base64, uuid, shutil, subprocess, sys, time
P = r"D:\OBS-Mobilin_old\OBS-CTPG\Streamer.bot-x64-1.0.1\data\actions.json"
if b"Streamer.bot" in subprocess.run(["tasklist"], capture_output=True).stdout:
    sys.exit("Streamer.bot is running. Close it first (File > Exit), then run this again.")
bak = P + ".bak-fix2-" + time.strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, bak); print("backup:", bak)
d = json.load(open(P, encoding="utf-8-sig"))
A = {a["name"]: a for a in d["actions"]}
enc = lambda t: base64.b64encode(t.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8")).decode("ascii")
done = []
def make(name, src, scene, template):
    act = json.loads(json.dumps(template)); act["id"] = str(uuid.uuid4()); act["name"] = name; act["concurrent"] = True
    trig = json.loads(json.dumps(template["triggers"][0])); trig.update({"sceneName": scene, "id": str(uuid.uuid4())})
    act["triggers"] = [trig]
    sub = json.loads(json.dumps(template["subActions"][0])); sub.update({"id": str(uuid.uuid4()), "name": name, "byteCode": enc(src), "index": 0, "parentId": None})
    act["subActions"] = [sub]; d["actions"].append(act); A[name] = act; done.append(f"added '{name}' (trigger: scene {scene})")
HOME_SRC = open(__file__.replace("apply_sb_fix2.py", "sb_home_scene.cs"), encoding="utf-8").read()
DANCE_SRC = open(__file__.replace("apply_sb_fix2.py", "sb_dance_return.cs"), encoding="utf-8").read()
old = A.get("CTPG Home Scene")
if old:
    for sc in ("Now", "live"):
        if f"CTPG Home Scene ({sc})" not in A: make(f"CTPG Home Scene ({sc})", HOME_SRC, sc, old)
    d["actions"] = [a for a in d["actions"] if a["name"] != "CTPG Home Scene"]; done.append("removed the two-trigger 'CTPG Home Scene'")
if "CTPG Dance Return" not in A:
    tmpl = A["CTPG Home Scene (Now)"]; make("CTPG Dance Return", DANCE_SRC, "dance", tmpl)
with open(P, "w", encoding="utf-8-sig", newline="") as f:
    json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
json.load(open(P, encoding="utf-8-sig"))
print("\n".join(done)); print("Done. Start Streamer.bot.")
