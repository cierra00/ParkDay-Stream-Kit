import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
j = json.load(open(P, encoding="utf-8")); S = {s["name"]: s for s in j["sources"]}
for n in ("live", "live Vertical"):
    sc = S.get(n)
    print("==", n, "exists" if sc else "MISSING")
    if not sc: continue
    for i in sc["settings"]["items"]:
        src = next((s for s in j["sources"] if s.get("uuid") == i.get("source_uuid")), None) or S.get(i["name"], {})
        st = src.get("settings", {})
        extra = st.get("url") or st.get("local_file") or ""
        if "access_token" in extra or "key=" in extra: extra = "(masked)"
        print(f"  [{'on ' if i['visible'] else 'off'}] {i['name']}  <{src.get('id','?')}>  {extra[:110]}  pos={i.get('pos')} bounds={i.get('bounds')} bt={i.get('bounds_type')}")
print("== sources using overlay.html")
for s in j["sources"]:
    u = s.get("settings", {}).get("url", "") or ""
    if "overlay.html" in u: print("  ", s["name"], "->", u[:140])
