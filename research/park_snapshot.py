# Read-only: snapshot of ThemeParks.wiki data (rides, shows, restaurants, waits, show times) for the app prototype.
import json, urllib.request, sys
sys.stdout.reconfigure(encoding="utf-8")
PARKS = {"Hollywood Studios": "288747d1-8b4f-4a64-867e-ea7c9b27bad8", "EPCOT": "47f90d2c-e191-4239-a466-5892ef59a88b",
         "Magic Kingdom": "75ea578a-adc8-4116-a54d-dccb60765ef9", "Animal Kingdom": "1c84a229-8862-4648-9c71-378ddd2c7693"}
def get(u):
    return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "ctpg-planner-prototype"}), timeout=30).read())
out = {}
for name, pid in PARKS.items():
    kids = get(f"https://api.themeparks.wiki/v1/entity/{pid}/children")
    live = {e["id"]: e for e in get(f"https://api.themeparks.wiki/v1/entity/{pid}/live").get("liveData", [])}
    items = []
    for c in kids.get("children", []):
        t = c.get("entityType")
        if t not in ("ATTRACTION", "SHOW", "RESTAURANT"): continue
        L = live.get(c["id"], {})
        wait = ((L.get("queue") or {}).get("STANDBY") or {}).get("waitTime")
        times = [s.get("startTime") for s in (L.get("showtimes") or []) if s.get("startTime")]
        items.append({"id": c["id"], "name": c["name"], "type": t, "status": L.get("status"), "wait": wait, "times": times[:12]})
    out[name] = {"id": pid, "items": sorted(items, key=lambda i: (i["type"], i["name"]))}
    print(name, {t: sum(1 for i in items if i["type"] == t) for t in ("ATTRACTION", "SHOW", "RESTAURANT")})
open(r"C:\StreamerBot\ctpg-pack\park_snapshot.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False))
