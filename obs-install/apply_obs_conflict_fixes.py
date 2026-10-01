"""OBS conflict fixes (Sept 28). Run with OBS CLOSED:
    python C:\\StreamerBot\\ctpg-pack\\apply_obs_conflict_fixes.py
- Scene Switcher "neimad to live " paused: Streamer.bot's Neimad action owns the 2-minute banner.
- Scene Switcher "clone to live" paused: Streamer.bot now leaves live clone after 10 s and goes back to your home scene (Now or live).
- Scene Switcher "Dance": when the dance video ends, go back to the PREVIOUS scene (Now or live) instead of always live.
- "Now/Next (on live)" and its vertical twin may read which scene is on air (page permission: read user info),
  so the live copy hides inside Now (no double card) and stays up during banners when you came from Now.
- VERTICAL WEATHER: the weather items on the vertical canvas sat off the right edge (copied from the wide layout), so they could
  never be seen. They move to the top right of the vertical frame (above the vertical countdown).
- VERTICAL WEATHER: new Scene Switcher rules copy the weather to vertical: when WDW / Universal / Disneyland Weather comes on,
  it also comes on in live Vertical (Disneyland: live clone Vertical). The 2-minute auto-off rules now also turn off the vertical copy.
- Now Vertical and live clone Vertical nested the WIDE live scene at the wrong size (a 2x zoomed crop with none of the vertical
  overlays). They now nest live Vertical, so vertical Now shows the vertical camera, weather, alerts and card like live Vertical.
Undo: copy the printed backup over Moblin.json (OBS closed)."""
import json, os, shutil, subprocess, sys, time
P = os.path.expandvars(r"%APPDATA%\obs-studio\basic\scenes\Moblin.json")
if b"obs64.exe" in subprocess.run(["tasklist"], capture_output=True).stdout:
    sys.exit("OBS is running. Close OBS first, then run this again.")
bak = P + ".bak-conflicts-" + time.strftime("%Y%m%d-%H%M%S"); shutil.copy2(P, bak); print("backup:", bak)
d = json.load(open(P, encoding="utf-8"))
M = {m["name"]: m for m in d["modules"]["advanced-scene-switcher"]["macros"]}
out = []
for n in ("neimad to live ", "clone to live"):
    M[n]["pause"] = True; out.append(f"paused macro '{n.strip()}'")
for a in M["Dance"]["actions"]:
    if a.get("id") == "scene_switch":
        a["sceneSelection"] = {"type": 2, "name": "", "canvasSelection": "Main"}; out.append("Dance now returns to the previous scene")
S = {s["name"]: s for s in d["sources"]}
for n in ("Now/Next (on live)", "Now/Next (on live) (Vertical)"):
    S[n]["settings"]["webpage_control_level"] = 2; out.append(f"'{n}' can read the current scene")

# ---------- vertical canvas: weather ----------
import copy, uuid
VW, VH, VCANVAS = 1080, 1920, "Aitum Vertical"
def place(it, x, y, sc):
    it["pos"] = {"x": x, "y": y}; it["pos_rel"] = {"x": (x - VW / 2) / (VH / 2), "y": (y - VH / 2) / (VH / 2)}
    it["scale"] = {"x": sc, "y": sc}; it["scale_rel"] = {"x": sc, "y": sc}; it["scale_ref"] = {"x": float(VW), "y": float(VH)}
# where the widget sits inside each 800x600 weather page (measured from a render): left, top, right, bottom
BOX = {"WDW Weather": (76, 92, 239, 184), "Universal Weather": (77, 93, 238, 183), "Disneyland Weather": (76, 92, 239, 184)}
SC, RIGHT, TOP = 2.3, 1044, 60     # widget ~375 x 212 px, top right, clear of the vertical countdown (starts at 290)
for scn in ("live Vertical", "live clone Vertical"):
    for it in S[scn]["settings"]["items"]:
        if it["name"] in BOX:
            l, t, r, b = BOX[it["name"]]; place(it, RIGHT - r * SC, TOP - t * SC, SC); out.append(f"{scn}: {it['name']} moved on screen (top right)")
# nest live Vertical instead of the wide live scene
LV = S["live Vertical"]
for scn in ("Now Vertical", "live clone Vertical"):
    for it in S[scn]["settings"]["items"]:
        if it["name"] == "live":
            it["name"] = "live Vertical"; it["source_uuid"] = LV["uuid"]; place(it, 0.0, 0.0, 1.0)
            it["bounds_type"] = 0; it["bounds"] = {"x": 0.0, "y": 0.0}; it["bounds_rel"] = {"x": 0.0, "y": 0.0}
            it["crop_left"] = it["crop_top"] = it["crop_right"] = it["crop_bottom"] = 0
            out.append(f"{scn}: now nests live Vertical (was the wide live scene at 2x)")
    items = S[scn]["settings"]["items"]                     # camera at the bottom, like the wide live clone
    for i, it in enumerate(items):
        if it["name"] == "live Vertical" and i != 0:
            items.insert(0, items.pop(i)); out.append(f"{scn}: live Vertical moved to the bottom layer"); break
# Scene Switcher: copy weather on to vertical, and turn the vertical copy off with the 2-minute rules
MIRROR = {"WDW Weather": "live Vertical", "Universal Weather": "live Vertical", "Disneyland Weather": "live clone Vertical"}
OFF = {"Turn off wdw Weather": "WDW Weather", "Univesal Weather OFF": "Universal Weather", "Turn off DL Weather": "Disneyland Weather"}
macros = d["modules"]["advanced-scene-switcher"]["macros"]
for mname, src in OFF.items():
    m = M[mname]
    if not any(a.get("sceneSelection", {}).get("canvasSelection") == VCANVAS for a in m["actions"]):
        a = copy.deepcopy(m["actions"][0]); a["sceneSelection"] = {"type": 0, "name": MIRROR[src], "canvasSelection": VCANVAS}
        a["sceneItemSelection"]["item"] = src; a["action"] = 1; m["actions"].append(a); out.append(f"'{mname}' also turns off the vertical copy")
    new = f"Vertical: {src} on"
    if new not in M:
        n = copy.deepcopy(m); n["name"] = new; n["pause"] = False
        n["dockSettings"]["dockId"] = "advss-macro-dock-" + str(uuid.uuid4())
        n["conditions"] = [copy.deepcopy(m["conditions"][0])]
        n["conditions"][0]["durationModifier"]["time_constraint"] = 0       # as soon as the weather is on air
        n["actions"] = [copy.deepcopy(m["actions"][0])]
        n["actions"][0]["sceneSelection"] = {"type": 0, "name": MIRROR[src], "canvasSelection": VCANVAS}
        n["actions"][0]["action"] = 0                                          # show
        macros.insert(macros.index(m) + 1, n); M[new] = n; out.append(f"added rule '{new}'")
with open(P, "w", encoding="utf-8", newline="") as f:
    json.dump(d, f, indent=4, ensure_ascii=False)
json.load(open(P, encoding="utf-8"))
print("\n".join(out)); print("Done. Open OBS.")
