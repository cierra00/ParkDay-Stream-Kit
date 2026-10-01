import json, os, sys, time
import obsws_python as obs
c = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))
cl = obs.ReqClient(host="localhost", port=c.get("server_port", 4455), password=c.get("server_password", ""), timeout=10)
assert not cl.get_stream_status().output_active
prog = lambda: cl.get_current_program_scene().current_program_scene_name
start = prog()
for home in ("Now", "nick"):
    cl.set_current_program_scene(home); time.sleep(3); cl.set_current_program_scene("dance"); t0 = time.time(); seq = []
    while time.time() - t0 < 90:
        time.sleep(0.5); p = prog()
        if not seq or seq[-1][0] != p: seq.append((p, round(time.time() - t0, 1)))
        if p != "dance": break
    print(("PASS" if seq[-1][0] == home else "FAIL"), f"Dance from {home}:", seq, flush=True)
cl.set_current_program_scene("offline"); print("restored", prog())
