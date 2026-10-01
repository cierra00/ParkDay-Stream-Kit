# LIVE end-to-end test: real planner server -> real OBS scenes. Restores your plan and OBS scene afterwards, then closes OBS.
import json, os, sys, time, base64, subprocess, urllib.request, datetime
from zoneinfo import ZoneInfo
import obsws_python as obs
sys.stdout.reconfigure(encoding="utf-8")
OUT = r"C:\StreamerBot\ctpg-pack\lab\live"; os.makedirs(OUT, exist_ok=True)
BASE = "https://planner.cruiseandthemeparkguide.com"
keys = json.load(open(r"C:\StreamerBot\ctpg-planner\.keys.json", encoding="utf-8-sig"))
TK = keys["TEST_KEY"]
pw = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))["server_password"]
saved = open(r"C:\StreamerBot\ctpg-planner\livetest-saved-state.json", encoding="utf-8").read()

def put(body):
    r = urllib.request.Request(BASE + "/api/state", data=json.dumps(body).encode(), method="PUT", headers={"Authorization": "Bearer " + TK, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CTPG-livetest"})
    return json.load(urllib.request.urlopen(r, timeout=20))
ET = ZoneInfo("America/New_York")
t = lambda m: (datetime.datetime.now(ET) + datetime.timedelta(minutes=m)).strftime("%H:%M")
S = lambda **k: {"countdown": True, "within": 180, "next": True, "onLive": False, **k}
def disp(parts=None, next_=None, shows=(), settings=None):
    return {"display": {"now": parts["title"] if parts else "", "nowParts": parts, "park": "EPCOT", "parkId": "47f90d2c-e191-4239-a466-5892ef59a88b",
            "tz": "America/New_York", "next": next_, "shows": list(shows), "settings": settings or S()}}
ride = {"cat": "ride", "label": "On a ride", "title": "Soarin' Around the World", "sub": "EPCOT", "wait": 45}
concert = {"cat": "concert", "label": "Eat to the Beat", "title": "New Found Glory", "sub": "EPCOT"}
sky = {"cat": "travel", "label": "Skyliner to", "title": "Riviera Resort", "sub": "From EPCOT", "mode": "skyliner"}
lunch = {"time": t(40), "label": "Lunch at Regal Eagle"}
etb = {"time": t(25), "label": "Eat to the Beat: New Found Glory"}
CASES = [
    ("1-nothing", "Now", disp()),
    ("2-ride-wait-next", "Now", disp(ride, lunch)),
    ("3-concert-countdown", "Now", disp(concert, etb, [etb])),
    ("4-next-off", "Now", disp(ride, lunch, settings=S(next=False))),
    ("5-countdown-off", "Now", disp(concert, etb, [etb], S(countdown=False))),
    ("6-window-30min-show-in-50", "Now", disp(concert, {"time": t(50), "label": "Luminous"}, [{"time": t(50), "label": "Luminous"}], S(within=30))),
    ("7-skyliner", "Now", disp(sky, lunch)),
    ("8-live-scene-onLive-off", "live", disp(ride, lunch)),
    ("9-live-scene-onLive-on", "live", disp(ride, lunch, settings=S(onLive=True))),
]
VERT = {"2-ride-wait-next", "3-concert-countdown", "7-skyliner", "9-live-scene-onLive-on"}

# ---- start OBS minimized and connect ----
exe = r"C:\Program Files\obs-studio\bin\64bit\obs64.exe"
started = True   # OBS was closed when handed over: always close it at the end
if "obs64.exe" not in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout:
    subprocess.Popen([exe, "--minimize-to-tray", "--disable-shutdown-check"], cwd=os.path.dirname(exe)); started = True
cl = None
for _ in range(60):
    try: cl = obs.ReqClient(host="localhost", port=4455, password=pw, timeout=5); break
    except Exception: time.sleep(2)
if not cl: sys.exit("could not connect to OBS")
orig = None
for _ in range(60):
    try: orig = cl.get_current_program_scene().scene_name; break
    except Exception: time.sleep(2)
if orig is None: sys.exit("OBS never became ready")
print("OBS up. program scene was:", orig, "| streaming:", cl.get_stream_status().output_active)
time.sleep(4)

def shot(src, name, w, h):
    try:
        r = cl.get_source_screenshot(src, "png", w, h, -1)
        data = r.image_data.split(",", 1)[1]
        open(os.path.join(OUT, name + ".png"), "wb").write(base64.b64decode(data)); return "ok"
    except Exception as e: return "FAIL " + str(e)[:80]

cur = None
try:
    for name, scene, body in CASES:
        if scene != cur:
            cl.set_current_program_scene(scene); cur = scene; time.sleep(6)   # browser source reloads on activation
        put(body); time.sleep(5)
        a = shot(scene, name, 1280, 720)
        b = shot(scene + " Vertical", name + "-vertical", 540, 960) if name in VERT else "-"
        print(f"{name:32} scene={scene:5} horizontal={a} vertical={b}")
finally:
    # ---- restore everything ----
    try:
        s = json.loads(saved); put(s); print("plan restored")
    except Exception as e: print("RESTORE PLAN FAILED:", e)
    try: cl.set_current_program_scene(orig); print("scene restored:", orig)
    except Exception as e: print("scene restore failed:", e)
    if started:
        time.sleep(2); subprocess.run(["taskkill", "/IM", "obs64.exe"], capture_output=True)
        for _ in range(20):
            if "obs64.exe" not in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout: break
            time.sleep(1.5)
        print("OBS closed:", "obs64.exe" not in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout)
