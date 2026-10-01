import re, json, urllib.request, sys
s = open(r"C:\StreamerBot\ctpg-pack\planner_key.js", encoding="utf-8").read()
url = re.search(r"url\s*[:=]\s*['\"]([^'\"]+)", s).group(1)
for path in ("/version.json?t=1", "/"):
    r = urllib.request.urlopen(urllib.request.Request(url + path, headers={"User-Agent": "Mozilla/5.0 ctpg-check"}), timeout=15).read().decode("utf-8", "ignore")
    print(path, r[:300].replace("\n", " ") if path != "/" else re.findall(r"assets/index-[\w-]+\.js", r))
