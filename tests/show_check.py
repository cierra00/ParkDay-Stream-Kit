import json, sys, urllib.request, collections
sys.stdout.reconfigure(encoding="utf-8")
A = "https://api.themeparks.wiki/v1"
get = lambda u: json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "ctpg-planner"}), timeout=30))
KW = ("firework", "happily", "luminous", "fantasmic", "parade", "world of color", "wondrous", "harmonious", "nighttime", "spectacular", "starlight", "believe", "halloween screams", "boo-to-you", "cavalcade", "rivers of light", "kaleidoscope", "sky")
for name, pid in [("Magic Kingdom", "75ea578a-adc8-4116-a54d-dccb60765ef9"), ("EPCOT", "47f90d2c-e191-4239-a466-5892ef59a88b"),
                  ("Hollywood Studios", "288747d1-8b4f-4a64-867e-ea7c9b27bad8"), ("Disneyland", "7340550b-c14d-4def-80bb-acdb51d49a66")]:
    kids = get(f"{A}/entity/{pid}/children"); live = get(f"{A}/entity/{pid}/live")
    L = {e["id"]: e for e in live.get("liveData", [])}
    print(f"== {name}: children {collections.Counter(c['entityType'] for c in kids['children'])}")
    for c in kids["children"]:
        if any(k in c["name"].lower() for k in KW):
            e = L.get(c["id"], {})
            print(f"   {c['entityType']:11} {c['name'][:55]:55} showtimes={len(e.get('showtimes') or [])} status={e.get('status')}")
    # anything in live data with showtimes that is NOT in children (the app would miss it)
    kid_ids = {c["id"] for c in kids["children"]}
    for e in live.get("liveData", []):
        if e["id"] not in kid_ids and (e.get("showtimes") or any(k in e.get("name", "").lower() for k in KW)):
            print(f"   NOT IN CHILDREN: {e.get('entityType')} {e.get('name')} showtimes={len(e.get('showtimes') or [])}")
