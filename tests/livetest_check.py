import json, os, sys, glob, importlib.util, subprocess
sys.stdout.reconfigure(encoding="utf-8")
c = os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json")
if os.path.exists(c):
    j = json.load(open(c, encoding="utf-8-sig"))
    print("obs-websocket: enabled", j.get("server_enabled"), "port", j.get("server_port"), "auth", j.get("auth_required"), "password set", bool(j.get("server_password")))
else: print("no obs-websocket config at", c)
for m in ("websockets", "websocket", "simpleobsws", "obsws_python"):
    print("python module", m, "installed" if importlib.util.find_spec(m) else "missing")
for p in (r"C:\Program Files\obs-studio\bin\64bit\obs64.exe", r"D:\OBS-Mobilin_old\obs-studio\bin\64bit\obs64.exe"):
    print(p, os.path.exists(p))
print("obs running:", "obs64.exe" in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout)
# will OBS start streaming/recording on launch? (profile + Autostarter)
g = os.path.expandvars(r"%APPDATA%\obs-studio\global.ini")
print("global.ini exists", os.path.exists(g))
for f in glob.glob(os.path.expandvars(r"%APPDATA%\obs-studio\basic\profiles\*\basic.ini")):
    t = open(f, encoding="utf-8-sig", errors="ignore").read()
    print("profile", os.path.basename(os.path.dirname(f)), "| has AutoStart/StreamOnStart lines:", [l for l in t.splitlines() if "start" in l.lower() and ("stream" in l.lower() or "record" in l.lower() or "replay" in l.lower())][:5])
t = open(g, encoding="utf-8-sig", errors="ignore").read() if os.path.exists(g) else ""
print("global start-related:", [l for l in t.splitlines() if any(k in l for k in ("SceneCollection=", "Profile=", "WarnBeforeStarting", "RecordWhenStreaming", "KeepRecording"))][:8])
print("processes of note:", [p for p in ("streamer.bot", "noalbs", "autostarter", "obs") if p in subprocess.run(["tasklist"], capture_output=True, text=True).stdout.lower()])
