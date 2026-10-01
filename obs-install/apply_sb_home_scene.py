"""Streamer.bot conflict fixes (Sept 28). Run with Streamer.bot CLOSED:
    python C:\\StreamerBot\\ctpg-pack\\apply_sb_home_scene.py
- New action "CTPG Home Scene": remembers whether you are on Now or live (global ctpgHomeScene).
- CMR Banner Promo returns to that home scene instead of always "live".
- CTPG.com and Neimad go to "live clone" for 10 s (the transition), then back to the home scene.
  (The Scene Switcher macro "clone to live" is paused by apply_obs_conflict_fixes.py so the two don't race.)
- WDW Weather chat trigger also turns the weather on/off on the vertical canvas (live Vertical).
- Alert cards (sub, member, gift, milestone, superchat) max 44% of the width so they stay on the right, clear of the Now card.
Undo: copy the printed backup over data\\actions.json (Streamer.bot closed)."""
import json, base64, uuid, shutil, subprocess, sys, time
P = r"D:\OBS-Mobilin_old\OBS-CTPG\Streamer.bot-x64-1.0.1\data\actions.json"
if b"Streamer.bot" in subprocess.run(["tasklist"], capture_output=True).stdout:
    sys.exit("Streamer.bot is running. Close it first (File > Exit), then run this again.")
bak = P + ".bak-homescene-" + time.strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, bak); print("backup:", bak)
d = json.load(open(P, encoding="utf-8-sig"))
A = {a["name"]: a for a in d["actions"]}
dec = lambda s: base64.b64decode(s["byteCode"]).decode("utf-8")
enc = lambda t: base64.b64encode(t.encode("utf-8")).decode("ascii")
def code_sub(a): return [s for s in a["subActions"] if s.get("type") == 99999][0]
HOME = 'string _h = CPH.GetGlobalVar<string>("ctpgHomeScene", true); string _home = string.IsNullOrWhiteSpace(_h) ? "live" : _h;'
done = []
# 1. banners
for name in ("CMR Banner Promo", "CTPG.com", "Neimad"):
    s = code_sub(A[name]); t = dec(s)
    if "ctpgHomeScene" in t: done.append(name + ": already done"); continue
    old = "CPH.ObsSetScene(returnSceneName);"
    assert t.count(old) == 1, name
    if name == "CMR Banner Promo":
        new = HOME + " returnSceneName = _home; CPH.ObsSetScene(returnSceneName);"
    else:
        new = ('CPH.ObsSetScene("live clone"); CPH.Wait(10000); '
               'string _cur = CPH.ObsGetCurrentScene(); '
               'if (!string.IsNullOrWhiteSpace(_cur) && _cur.Equals("live clone", StringComparison.OrdinalIgnoreCase)) { '
               + HOME + ' returnSceneName = _home; CPH.ObsSetScene(returnSceneName); }')
    s["byteCode"] = enc(t.replace(old, new)); done.append(name + ": returns to home scene")
# 2. alerts
for name in ("Super-chat", "YouTube New Member", "YouTube Membership Gift", "YouTube Member Milestone", "YouTube New Subscriber"):
    s = code_sub(A[name]); t = dec(s)
    n = t.count("max-width: 80vw;")
    t = t.replace("max-width: 80vw;", "max-width: 44vw;").replace("max-width: 60vw;", "max-width: 40vw;")
    k = t.count(".name { ") 
    t = t.replace(".name { ", ".name { max-width: 40vw; overflow: hidden; text-overflow: ellipsis; ", 1) if "text-overflow: ellipsis; " not in t else t
    s["byteCode"] = enc(t); done.append(f"{name}: card width ({n}), long names trimmed ({min(k,1)})")
# 3. home scene tracker
if "CTPG Home Scene" not in A:
    tmpl = A["Neimad"]; obs = tmpl["triggers"][0]["obsId"]; ts = code_sub(tmpl)
    src = """using System;

public class CPHInline
{
    // Remembers which main scene you are on (Now or live) so banners, live clone and alerts return you there.
    public bool Execute()
    {
        string s = CPH.ObsGetCurrentScene();
        if (!string.IsNullOrWhiteSpace(s) &&
            (s.Equals("Now", StringComparison.OrdinalIgnoreCase) || s.Equals("live", StringComparison.OrdinalIgnoreCase)))
        {
            CPH.SetGlobalVar("ctpgHomeScene", s, true);
            CPH.LogInfo($"[HOME] Home scene is now '{s}'.");
        }
        return true;
    }
}
""".replace("\n", "\r\n")
    act = json.loads(json.dumps(tmpl)); act["id"] = str(uuid.uuid4()); act["name"] = "CTPG Home Scene"; act["concurrent"] = True
    act["triggers"] = [{"sceneName": sc, "obsId": obs, "id": str(uuid.uuid4()), "type": 14004, "enabled": True, "exclusions": []} for sc in ("Now", "live")]
    sub = json.loads(json.dumps(ts)); sub.update({"id": str(uuid.uuid4()), "name": "CTPG Home Scene", "byteCode": enc(src), "index": 0, "parentId": None})
    act["subActions"] = [sub]; d["actions"].append(act); done.append("CTPG Home Scene: added (triggers: scene Now, scene live)")
# 4. WDW weather on the vertical canvas too
s = code_sub(A["WDW Weather - Chat Trigger"]); t = dec(s)
if "SetVerticalWeather" not in t:
    on, off = "CPH.ObsSetSourceVisibility(sceneName, sourceName, true, 0);", "CPH.ObsSetSourceVisibility(sceneName, sourceName, false, 0);"
    assert t.count(on) == 1 and t.count(off) == 1
    t = t.replace(on, on + " SetVerticalWeather(sourceName, true);").replace(off, off + " SetVerticalWeather(sourceName, false);")
    method = """
    // The vertical canvas (Aitum Vertical) has its own copy of the weather in "live Vertical".
    private void SetVerticalWeather(string source, bool on)
    {
        try
        {
            string scene = "live Vertical";
            string canvas = "292fcc0e-8af9-40f4-ad69-4f2b2cd3b312"; // Aitum Vertical canvas
            string r = CPH.ObsSendRaw("GetSceneItemId", "{\\"sceneName\\":\\"" + scene + "\\",\\"canvasUuid\\":\\"" + canvas + "\\",\\"sourceName\\":\\"" + source + "\\"}", 0);
            var m = System.Text.RegularExpressions.Regex.Match(r ?? "", "sceneItemId\\\\D{1,4}(\\\\d+)");
            if (!m.Success) { CPH.LogWarn("[WDW WEATHER] vertical item not found: " + r); return; }
            CPH.ObsSendRaw("SetSceneItemEnabled", "{\\"sceneName\\":\\"" + scene + "\\",\\"canvasUuid\\":\\"" + canvas + "\\",\\"sceneItemId\\":" + m.Groups[1].Value + ",\\"sceneItemEnabled\\":" + (on ? "true" : "false") + "}", 0);
            CPH.LogInfo("[WDW WEATHER] vertical copy " + (on ? "on" : "off"));
        }
        catch (Exception ex) { CPH.LogWarn("[WDW WEATHER] vertical toggle failed: " + ex.Message); }
    }
""".replace("\n", "\r\n")
    k = t.rstrip().rfind("}")
    t = t[:k].rstrip() + "\r\n" + method + "}\r\n"
    s["byteCode"] = enc(t); done.append("WDW Weather - Chat Trigger: also toggles the vertical copy")
with open(P, "w", encoding="utf-8-sig", newline="") as f:
    json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
json.load(open(P, encoding="utf-8-sig"))
print("\n".join(done)); print("Done. Start Streamer.bot and check the log for compile errors on these actions.")
