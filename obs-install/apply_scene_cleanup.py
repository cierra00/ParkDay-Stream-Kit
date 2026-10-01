# Scene cleanup (approved 2026-09-27):
#  1. One "Now" scene (+ "Now Vertical"): live + planner card. Made from Now: Riding so the vertical link stays.
#  2. Planner card taken off live and live Vertical.
#  3. The other 22 Now: scenes and all 24 per-label Now/Next sources removed.
#  4. Hidden leftovers removed: old pause/offline videos, vertical doubles, empty "Scene".
# Media files on disk are not touched. Backs up first. Only runs while OBS is closed.
import json, os, sys, shutil, datetime, subprocess
sys.stdout.reconfigure(encoding="utf-8")
if "obs64.exe" in subprocess.run(["tasklist", "/FI", "IMAGENAME eq obs64.exe"], capture_output=True, text=True).stdout:
    sys.exit("OBS is running. Close OBS first; nothing changed.")
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
BK = P + ".bak-scenecleanup-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
shutil.copy2(P, BK); print("backup:", BK)
j = json.load(open(P, encoding="utf-8"))
S = lambda: {s["name"]: s for s in j["sources"]}
by = S(); log = []

# ---- 1. Now scene ----
now_h, now_v = by["Now: Riding"], by["Now: Riding Vertical"]
card_h, card_v = by["Now/Next (Planner)"], by["Now/Next (Planner) (Vertical)"]
for sc, card, old in ((now_h, card_h, "Now/Next - Riding"), (now_v, card_v, "Now/Next - Riding (Vertical)")):
    it = next(i for i in sc["settings"]["items"] if i["name"] == old)
    it["name"], it["source_uuid"], it["visible"] = card["name"], card["uuid"], True
now_h["name"], now_v["name"] = "Now", "Now Vertical"
now_h["settings"]["canvas"] = [{"width": 1080, "height": 1920, "scene": "Now Vertical"}]
renamed = {"Now: Riding": "Now", "Now: Riding Vertical": "Now Vertical"}
log.append("made 'Now' + 'Now Vertical' (live + planner card)")

# ---- 2. card off live ----
for scn, card in (("live", card_h), ("live Vertical", card_v)):
    items = by[scn]["settings"]["items"]
    by[scn]["settings"]["items"] = [i for i in items if i.get("source_uuid") != card["uuid"]]
log.append("removed planner card from live and live Vertical")

# ---- 3 + 4. what to remove ----
del_scenes = {s["name"] for s in j["sources"] if s.get("id") == "scene" and s["name"].startswith("Now: ")} | {"Scene"}
del_items = {  # scene -> item names to remove
    "pause": {"EPCOT - PAUSE"}, "pause Vertical": {"EPCOT - PAUSE", "Halloween overlay", "EPCOT - PAUSE (Vertical)"},
    "offline": {"dca.mp4"}, "offline Vertical": {"Media 2", "dca.mp4 (Vertical)"},
    "cmr-create Vertical": {"cmrcreate-banner"}, "nick Vertical": {"nick-img"}, "ending Vertical": {"Member Thank You Page"},
}
for scn, names in del_items.items():
    items = by[scn]["settings"]["items"]
    gone = [i["name"] for i in items if i["name"] in names and not i["visible"]]
    by[scn]["settings"]["items"] = [i for i in items if not (i["name"] in names and not i["visible"])]
    log.append(f"{scn}: removed hidden {gone}")
dead_uuids = {s["uuid"] for s in j["sources"] if s["name"] in del_scenes}
j["sources"] = [s for s in j["sources"] if s["name"] not in del_scenes]
log.append(f"removed {len(del_scenes)} scenes: " + ", ".join(sorted(del_scenes)))

# drop any source no longer used by any scene/group (only among the ones this cleanup touched)
candidates = {n for s in j["sources"] for n in [s["name"]] if n.startswith("Now/Next - ")} | \
             {"EPCOT - PAUSE", "dca.mp4", "Halloween overlay", "Media 2", "EPCOT - PAUSE (Vertical)", "dca.mp4 (Vertical)",
              "cmrcreate-banner", "nick-img", "Member Thank You Page"}
used = {i.get("source_uuid") for s in j["sources"] if s.get("id") in ("scene", "group") for i in s["settings"].get("items", [])}
drop = [s for s in j["sources"] if s["name"] in candidates and s["uuid"] not in used]
kept = sorted(c for c in candidates if c in S() and c not in {d["name"] for d in drop})
j["sources"] = [s for s in j["sources"] if s not in drop]
log.append(f"removed {len(drop)} unused sources: " + ", ".join(sorted(d['name'] for d in drop)))
if kept: log.append("kept (still used elsewhere): " + ", ".join(kept))

# ---- fix every place that names a scene (scene order, current scene, canvases, transitions) ----
def fix(o):
    if isinstance(o, dict):
        for k, v in list(o.items()):
            if isinstance(v, str):
                if v in renamed and k in ("name", "current_scene", "current_program_scene", "scene", "preview_scene"): o[k] = renamed[v]
                elif v in del_scenes and k in ("current_scene", "current_program_scene", "preview_scene"): o[k] = "live"
            else: fix(v)
    elif isinstance(o, list):
        for v in o: fix(v)
for key in [k for k in j if k != "sources"]: fix(j[key])
def prune_order(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == "scene_order" and isinstance(v, list): o[k] = [x for x in v if x.get("name") not in del_scenes]
            else: prune_order(v)
    elif isinstance(o, list):
        for v in o: prune_order(v)
prune_order({k: v for k, v in j.items() if k != "sources"})
for so in j.get("scene_order", []):
    if so.get("name") in renamed: so["name"] = renamed[so["name"]]

# ---- checks ----
by = S(); uu = {s["uuid"] for s in j["sources"]}
broken = [(s["name"], i["name"]) for s in j["sources"] if s.get("id") in ("scene", "group") for i in s["settings"].get("items", []) if i.get("source_uuid") and i["source_uuid"] not in uu]
if broken: sys.exit("ABORT, items pointing at missing sources: %s (nothing saved)" % broken)
txt = json.dumps({k: v for k, v in j.items()})
leftover = [n for n in del_scenes if json.dumps(n) in txt]
tmp = P + ".tmp"; json.dump(j, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=4)
json.load(open(tmp, encoding="utf-8")); os.replace(tmp, P)
print("\n".join(log)); print("saved")
if leftover: print("NOTE: still mentioned somewhere:", leftover)
scenes = [s for s in j["sources"] if s.get("id") == "scene"]
print(f"scenes now: {len(scenes)}  sources now: {len(j['sources'])}")
for n in ("Now", "Now Vertical", "live", "live Vertical"):
    print(n, "::", [(i["name"], i["visible"]) for i in by[n]["settings"]["items"]])
print("UNDO: close OBS, copy", BK, "over", P)
