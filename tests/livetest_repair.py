# Repairs the saved plan (PowerShell read the UTF-8 reply as Latin-1) and puts the exact original back on the server.
import json, sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
F = r"C:\StreamerBot\ctpg-planner\livetest-saved-state.json"
bad = open(F, encoding="utf-8-sig").read()
fixed = bad.encode("latin-1").decode("utf-8")          # exact reverse of the mis-decode
orig = json.loads(fixed)
def walk(o, out):
    if isinstance(o, dict): [walk(v, out) for v in o.values()]
    elif isinstance(o, list): [walk(v, out) for v in o]
    elif isinstance(o, str) and any(ord(c) > 127 for c in o): out.append(o)
    return out
print("non-ASCII text in the original plan:", walk(orig, []))
assert "Â" not in fixed and "â€" not in fixed, "still garbled"
open(r"C:\StreamerBot\ctpg-planner\livetest-saved-state.fixed.json", "w", encoding="utf-8").write(fixed)
keys = json.load(open(r"C:\StreamerBot\ctpg-planner\.keys.json", encoding="utf-8-sig"))
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CTPG-livetest"}
r = urllib.request.Request("https://planner.cruiseandthemeparkguide.com/api/state", data=fixed.encode("utf-8"), method="PUT",
                           headers={"Authorization": "Bearer " + keys["TEST_KEY"], "Content-Type": "application/json; charset=utf-8", **UA})
print("restore:", json.load(urllib.request.urlopen(r, timeout=20)))
back = urllib.request.urlopen(urllib.request.Request("https://planner.cruiseandthemeparkguide.com/api/state?key=" + keys["OVERLAY_KEY"], headers=UA), timeout=20).read().decode("utf-8")
b = json.loads(back)
same = {k: b.get(k) == orig.get(k) for k in ("parks", "hereId", "plan", "now", "nextId", "display")}
print("server matches the original:", same)
print("label now:", b["display"]["nowParts"]["label"])
