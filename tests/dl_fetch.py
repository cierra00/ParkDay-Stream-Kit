import json, urllib.request, sys
sys.stdout.reconfigure(encoding="utf-8")
for pid, tag in (("7340550b-c14d-4def-80bb-acdb51d49a66", "dl"), ("832fcd51-ea19-4e77-85c7-75d5843b127c", "dca")):
    for kind in ("children", "live"):
        d = urllib.request.urlopen(urllib.request.Request(f"https://api.themeparks.wiki/v1/entity/{pid}/{kind}", headers={"User-Agent": "Mozilla/5.0"}), timeout=20).read()
        open(rf"C:\StreamerBot\ctpg-pack\lab\{tag}-{kind}.json", "wb").write(d)
    live = json.load(open(rf"C:\StreamerBot\ctpg-pack\lab\{tag}-live.json", encoding="utf-8"))["liveData"]
    ch = json.load(open(rf"C:\StreamerBot\ctpg-pack\lab\{tag}-children.json", encoding="utf-8"))["children"]
    print(tag, "children", len(ch), "live", len(live))
    for x in live:
        n = x["name"]
        if any(k in n.lower() for k in ("firework", "scream", "projection", "world of color", "halloween", "believe", "wondrous", "villains", "parade", "fantasmic")):
            print("  LIVE", x.get("entityType"), x.get("status"), n, [s.get("startTime", "")[11:16] for s in (x.get("showtimes") or [])][:5])
    for x in ch:
        n = x["name"]
        if any(k in n.lower() for k in ("firework", "scream", "projection", "world of color", "halloween", "believe", "wondrous", "villains", "fantasmic")):
            print("  CHILD", x.get("entityType"), n)
