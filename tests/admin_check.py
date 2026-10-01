import re, urllib.request, json
s = open(r"C:\StreamerBot\ctpg-pack\planner_key.js", encoding="utf-8").read()
url = re.search(r"url\s*[:=]\s*['\"]([^'\"]+)", s).group(1)
for path in ("/admin", "/admin.html"):
    r = urllib.request.urlopen(urllib.request.Request(url + path, headers={"User-Agent": "Mozilla/5.0"}), timeout=15)
    b = r.read().decode("utf-8", "ignore"); print(path, r.status, re.search(r"<title>(.*?)</title>", b).group(1))
try:
    urllib.request.urlopen(urllib.request.Request(url + "/api/mods", headers={"User-Agent": "Mozilla/5.0", "authorization": "Bearer nope"}), timeout=15)
except Exception as e: print("mods with bad code ->", e)
