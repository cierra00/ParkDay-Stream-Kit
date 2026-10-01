"""Shows sample Super Chat, Dance Time and New Subscriber alerts for ~8 s by writing sample pages into the alert files,
screenshots the vertical canvas (live Vertical), then puts the original files back. Posts nothing to chat.
Refuses to run while streaming."""
import json, os, sys, base64, time, shutil
sys.stdout.reconfigure(encoding="utf-8")
import obsws_python as obs
c = json.load(open(os.path.expandvars(r"%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json"), encoding="utf-8-sig"))
cl = obs.ReqClient(host="localhost", port=c.get("server_port", 4455), password=c.get("server_password", ""), timeout=10)
if cl.get_stream_status().output_active: sys.exit("Streaming is on. Not testing.")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "live"); os.makedirs(OUT, exist_ok=True)
CSS = """body{margin:0;background:transparent;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif}
.card{position:absolute;bottom:6%;right:4%;display:inline-flex;flex-direction:column;align-items:flex-start;width:fit-content;max-width:44vw;padding:18px 26px 18px 22px;border-radius:16px;background:linear-gradient(160deg,rgba(8,45,140,.97),rgba(3,18,66,.97));border:2px solid var(--c);box-shadow:0 14px 45px rgba(0,0,0,.8)}
.kicker{font-size:22px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:var(--c);margin-bottom:8px;margin-left:8px;white-space:nowrap}
.name{font-size:40px;font-weight:900;color:#fff;margin-left:8px;white-space:nowrap}
.amount{display:inline-block;margin-top:10px;margin-left:8px;padding:6px 16px;border-radius:999px;background:var(--c);font-size:24px;font-weight:800;color:#fff}
.msg{margin-top:8px;font-size:22px;color:rgba(255,255,255,.85);margin-left:8px}
.banner{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:inline-flex;flex-direction:column;align-items:center;padding:34px 60px;border-radius:24px;background:linear-gradient(160deg,rgba(8,45,140,.97),rgba(3,18,66,.97));border:3px solid #ffe600;text-align:center}
.dkicker{font-size:28px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#ffe600;margin-bottom:10px}
.dtitle{font-size:52px;font-weight:900;color:#fff;white-space:nowrap}.dsub{margin-top:10px;font-size:24px;color:rgba(255,255,255,.85)}"""
def page(body): return f"<!DOCTYPE html><html><head><meta charset='UTF-8'><style>{CSS}</style></head><body>{body}</body></html>"
FILES = {r"C:\StreamerBot\superchat_alert.html": page('<div class="card" style="--c:#ff5252"><div class="kicker">Super Chat (TEST)</div><div class="name">DisneyFan2024</div><div class="amount">$5.00</div><div class="msg">Love the stream! Ride Space next!</div></div>'),
         r"C:\StreamerBot\dance_time.html": page('<div class="banner"><div class="dkicker">Dance Time (TEST)</div><div class="dtitle">Super Chat #5!</div><div class="dsub">Thanks for keeping the party going!</div></div>'),
         r"C:\StreamerBot\community_alert.html": page('<div class="card" style="--c:#ffb000"><div class="kicker">New Subscriber (TEST)</div><div class="name">ParkHopper88</div><div class="amount">Welcome!</div></div>')}
orig = {f: open(f, "rb").read() for f in FILES}
try:
    for f, html in FILES.items(): open(f, "w", encoding="utf-8").write(html)
    for n in ("Superchat", "5th SC", "New Subscriber"):
        try: cl.send("PressInputPropertiesButton", {"inputName": n, "propertyName": "refreshnocache"})
        except Exception as e: print("refresh", n, e)
    time.sleep(4)
    for name, uid in (("live-Vertical", "6dc15695-c0df-4f55-9237-804cc50d66ba"),):
        r = cl.send("GetSourceScreenshot", {"sourceUuid": uid, "imageFormat": "png", "imageWidth": 540, "imageHeight": 960}, raw=True)
        p = os.path.join(OUT, f"alerts-{name}.png"); open(p, "wb").write(base64.b64decode(r["imageData"].split(",", 1)[1])); print("saved", p)
finally:
    for f, b in orig.items(): open(f, "wb").write(b)
    time.sleep(1)
    for n in ("Superchat", "5th SC", "New Subscriber"):
        try: cl.send("PressInputPropertiesButton", {"inputName": n, "propertyName": "refreshnocache"})
        except Exception: pass
    print("originals restored")
