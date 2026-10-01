"""Streamer.bot round 3 (Sept 28): banners no longer use "live clone". Run with Streamer.bot CLOSED:
    python C:\\StreamerBot\\ctpg-pack\\apply_sb_fix3.py
CTPG.com and Neimad now switch straight back to your home scene (Now or live) after the 2-minute banner.
The Luma Wipe Out look comes from OBS's Transition Table (CTPG/neimad -> Now/live), set by apply_obs_fix3.py.
Undo: copy the printed backup over data\\actions.json (Streamer.bot closed)."""
import json, base64, shutil, subprocess, sys, time
P = r"D:\OBS-Mobilin_old\OBS-CTPG\Streamer.bot-x64-1.0.1\data\actions.json"
if b"Streamer.bot" in subprocess.run(["tasklist"], capture_output=True).stdout:
    sys.exit("Streamer.bot is running. Close it first (File > Exit), then run this again.")
bak = P + ".bak-fix3-" + time.strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, bak); print("backup:", bak)
d = json.load(open(P, encoding="utf-8-sig")); A = {a["name"]: a for a in d["actions"]}
HOME = 'string _h = CPH.GetGlobalVar<string>("ctpgHomeScene", true); string _home = string.IsNullOrWhiteSpace(_h) ? "live" : _h;'
OLD = ('CPH.ObsSetScene("live clone"); CPH.Wait(10000); string _cur = CPH.ObsGetCurrentScene(); '
       'if (!string.IsNullOrWhiteSpace(_cur) && _cur.Equals("live clone", StringComparison.OrdinalIgnoreCase)) { ' + HOME + ' returnSceneName = _home; CPH.ObsSetScene(returnSceneName); }')
NEW = HOME + ' returnSceneName = _home; CPH.ObsSetScene(returnSceneName);   // Luma Wipe Out comes from the OBS Transition Table'
for name in ("CTPG.com", "Neimad"):
    s = A[name]["subActions"][0]; t = base64.b64decode(s["byteCode"]).decode("utf-8")
    if OLD in t:
        t = t.replace(OLD, NEW).replace('string returnSceneName = "live clone";', 'string returnSceneName = "live";   // replaced by your home scene (Now or live) at the end')
        s["byteCode"] = base64.b64encode(t.encode("utf-8")).decode("ascii"); print(name + ": goes straight back to the home scene")
    else: print(name + ": already done or not found")
with open(P, "w", encoding="utf-8-sig", newline="") as f:
    json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
json.load(open(P, encoding="utf-8-sig")); print("Done. Start Streamer.bot.")
