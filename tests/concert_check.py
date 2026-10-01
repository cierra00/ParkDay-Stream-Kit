import json, sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
A = "https://api.themeparks.wiki/v1"
get = lambda u: json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "ctpg-planner"}), timeout=30))
EP = "47f90d2c-e191-4239-a466-5892ef59a88b"
kids = get(f"{A}/entity/{EP}/children"); live = get(f"{A}/entity/{EP}/live")
json.dump(kids, open(r"C:\StreamerBot\ctpg-pack\lab\ep-children.json", "w", encoding="utf-8"))
json.dump(live, open(r"C:\StreamerBot\ctpg-pack\lab\ep-live.json", "w", encoding="utf-8"))
KW = ("beat", "concert", "garden rocks", "american gardens", "band", "rock", "music", "live", "stage", "jam", "sing", "drum", "pianist", "orchestra")
print("== EPCOT shows (all), with showtimes today")
L = {e["id"]: e for e in live.get("liveData", [])}
for c in kids["children"]:
    if c["entityType"] != "SHOW": continue
    e = L.get(c["id"], {})
    st = e.get("showtimes") or []
    types = sorted({s.get("type", "") for s in st})
    print(f"  {'*' if any(k in c['name'].lower() for k in KW) else ' '} {c['name'][:70]:70} times={len(st)} types={types}")
print("== anything in live data not in children, or with extra fields")
for e in live.get("liveData", []):
    extra = set(e) - {"id", "name", "entityType", "parkId", "externalId", "status", "lastUpdated", "queue", "showtimes", "operatingHours", "forecast"}
    if extra or any(k in e.get("name", "").lower() for k in ("beat", "concert", "garden")):
        print("  ", e.get("entityType"), e.get("name"), "extra:", extra, "| showtimes sample:", (e.get("showtimes") or [])[:2])
# also check the Eat to the Beat / American Gardens entity directly
for c in kids["children"]:
    if any(k in c["name"].lower() for k in ("beat", "american gardens", "garden rocks")):
        d = get(f"{A}/entity/{c['id']}")
        print("== entity detail:", c["name"]); print(json.dumps(d, ensure_ascii=False)[:1500])
