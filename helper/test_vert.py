import sys, time; sys.path.insert(0, r"C:\StreamerBot\ctpg-pack\remote")
import ctpg_remote as R
cl = R.obs_client()
for vn in ("aitum-vertical-canvas", "vertical-canvas"):
    for rt, data in (("current_scene", {}), ("get_scenes", {})):
        try: print(vn, rt, str(cl.send("CallVendorRequest", {"vendorName": vn, "requestType": rt, "requestData": data}, raw=True))[:300])
        except Exception as e: print(vn, rt, "ERR", str(e)[:120])
