# Render each weather page (800x600, transparent) with headless Edge to see where the widget sits. URLs are read, not printed.
import json, os, subprocess, glob, time
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
S = {s["name"]: s for s in json.load(open(P, encoding="utf-8"))["sources"]}
edge = next(p for p in glob.glob(r"C:\Program Files*\Microsoft\Edge\Application\msedge.exe"))
here = os.path.dirname(os.path.abspath(__file__))
for n in ("WDW Weather", "Universal Weather", "Disneyland Weather"):
    st = S[n]["settings"]; w, h = st.get("width", 800), st.get("height", 600)
    out = os.path.join(here, "wxr-" + n.split()[0].lower() + ".png")
    subprocess.run([edge, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
                    f"--window-size={w},{h}", "--virtual-time-budget=15000", f"--screenshot={out}", st["url"]], timeout=90, capture_output=True)
    print(n, w, h, os.path.exists(out) and os.path.getsize(out))
