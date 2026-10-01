# LIVE re-test of the live-scene copy (cases 8 and 9) with a visible debug readout. Restores plan, source link and scene; closes OBS.
import json, os, sys, time, base64, subprocess, urllib.request, datetime, shutil
from zoneinfo import ZoneInfo
import obsws_python as obs
sys.stdout.reconfigure(encoding="utf-8")
OUT = r"C:\StreamerBot\ctpg-pack\lab\live"; BASE = "https://planner.cruiseandthemeparkguide.com"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CTPG-livetest"}
keys = json.load(open(r"C:\StreamerBot\ctpg-planner\.keys.json", encoding="utf-8-sig")); TK = keys["TEST_KEY"]
pw = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))["server_password"]
# save the current plan as real UTF-8 text this time
saved = urllib.request.urlopen(urllib.request.Request(BASE + "/api/state?key=" + keys["OVERLAY_KEY"], headers=UA), timeout=20).read().decode("utf-8")
open(r"C:\StreamerBot\ctpg-planner\livetest-saved-state2.json", "w", encoding="utf-8").write(saved)
def put(body):
    data = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
    r = urllib.request.Request(BASE + "/api/state", data=data, method="PUT", headers={"Authorization": "Bearer " + TK, "Content-Type": "application/json; charset=utf-8", **UA})
    return json.load(urllib.request.urlopen(r, timeout=20))
ET = ZoneInfo("America/New_York"); t = lambda m: (datetime.datetime.now(ET) + datetime.timedelta(minutes=m)).strftime("%H:%M")
def body(onLive):
    return {"display": {"now": "Soarin' Around the World", "nowParts": {"cat": "ride", "label": "On a ride", "title": "Soarin' Around the World", "sub": "EPCOT", "wait": 45},
            "park": "EPCOT", "tz": "America/New_York", "next": {"time": t(40), "label": "Lunch at Regal Eagle"}, "shows": [],
            "settings": {"countdown": True, "within": 180, "next": True, "onLive": onLive}}}
exe = r"C:\Program Files\obs-studio\bin\64bit\obs64.exe"
pass   # Cierra opens OBS herself (it needs admin rights)
cl = None
for _ in range(400):
    try: cl = obs.ReqClient(host="localhost", port=4455, password=pw, timeout=5); break
    except Exception: time.sleep(2)
orig = None
for _ in range(60):
    try: orig = cl.get_current_program_scene().scene_name; break
    except Exception: time.sleep(2)
print("OBS ready. scene was:", orig)
SRC = "Now/Next (on live)"
url0 = cl.get_input_settings(SRC).input_settings["url"]
def shot(name):
    r = cl.get_source_screenshot("live", "png", 1280, 720, -1)
    open(os.path.join(OUT, name + ".png"), "wb").write(base64.b64decode(r.image_data.split(",", 1)[1]))
try:
    cl.set_input_settings(SRC, {"url": url0 + "&debug=show"}, True)       # temporary: visible debug readout
    put(body(False))
    cl.set_current_program_scene("live"); time.sleep(8); shot("r8-live-off")
    put(body(True)); time.sleep(5); shot("r9-live-on-5s"); time.sleep(10); shot("r9-live-on-15s")
    put(body(False)); time.sleep(5); shot("r10-live-off-again-5s")
    print("shots saved")
finally:
    try: cl.set_input_settings(SRC, {"url": url0}, True); print("source link restored:", cl.get_input_settings(SRC).input_settings["url"] == url0)
    except Exception as e: print("LINK RESTORE FAILED", e)
    try: put(saved.encode("utf-8")); print("plan restored")
    except Exception as e: print("PLAN RESTORE FAILED", e)
    try: cl.set_current_program_scene(orig); print("scene restored:", orig)
    except Exception as e: print("scene restore failed", e)
    back = urllib.request.urlopen(urllib.request.Request(BASE + "/api/state?key=" + keys["OVERLAY_KEY"], headers=UA), timeout=20).read().decode("utf-8")
    a, b = json.loads(saved), json.loads(back)
    print("plan matches original:", all(a.get(k) == b.get(k) for k in ("parks", "hereId", "plan", "now", "nextId", "display", "settings")))
    time.sleep(2); subprocess.run(["powershell", "-NoProfile", "-Command", "(Get-Process obs64 -ErrorAction SilentlyContinue).CloseMainWindow() | Out-Null"]); time.sleep(10)
    print("OBS closed:", "obs64.exe" not in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout)
