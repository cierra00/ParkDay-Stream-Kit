# Renders typewriter "BE RIGHT BACK!" frames matching the original BRB videos. Writes only to ctpg-pack\brb_text\.
import os, sys, subprocess
from PIL import Image, ImageDraw, ImageFont
OUT = r"C:\StreamerBot\ctpg-pack\brb_text"; os.makedirs(OUT, exist_ok=True)
PREV = r"C:\StreamerBot\ctpg-pack\previews"
FONT = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Windows\Fonts\LeagueSpartan-VariableFont_wght.ttf")
mode = sys.argv[1] if len(sys.argv) > 1 else "sample"

if mode == "sample":
    # Sample colors inside the letters of the originals (text band, 4K frame at 3 s).
    for k in ("dca", "monorail"):
        im = Image.open(os.path.join(PREV, f"{k}-textzoom.jpg")).convert("RGB")
        # "B" of BE: interior stem around x=225..245; sample top, middle, bottom of the stem, and the outline
        for label, (x, y) in {"stem_top": (232, 175), "stem_mid": (232, 255), "stem_bot": (232, 335), "outline": (203, 255)}.items():
            print(k, label, im.getpixel((x, y)))
    sys.exit()

W, H = 1080, 1920
TEXT = "BE RIGHT BACK!"
LINES = [(0, 8), (9, 14)]
F = ImageFont.truetype(FONT, 190)
try: F.set_variation_by_axes([700])
except Exception as e: print("variation:", e)
LH = 200
STY = {
    "dca": dict(top=(146, 232, 86), bot=(142, 230, 83), stroke=(54, 12, 14), y=1440),
    "monorail": dict(top=(170, 98, 118), bot=(248, 214, 58), stroke=(54, 12, 14), y=1300),
}
if len(sys.argv) > 2:
    import json; STY.update(json.loads(open(sys.argv[2]).read()))
def pos():
    p = {}
    for li, (a, b) in enumerate(LINES):
        w = F.getlength(TEXT[a:b]); x0 = (W - w) / 2
        for i in range(a, b): p[i] = (x0 + F.getlength(TEXT[a:i]), li)
    return p
P = pos()
def render(n, st):
    txt = Image.new("L", (W, H), 0); stk = Image.new("L", (W, H), 0)
    dt, ds = ImageDraw.Draw(txt), ImageDraw.Draw(stk)
    tops = []
    for i in range(n):
        if TEXT[i] == " ": continue
        x, li = P[i]; y = st["y"] + li * LH
        ds.text((x, y), TEXT[i], font=F, fill=255, stroke_width=11, stroke_fill=255)
        dt.text((x, y), TEXT[i], font=F, fill=255)
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    s = Image.new("RGBA", (W, H), tuple(st["stroke"]) + (255,)); s.putalpha(stk); out.alpha_composite(s)
    g = Image.new("RGBA", (W, H)); gd = ImageDraw.Draw(g)
    for li in range(2):
        bb = F.getbbox("BE RIGHT"); y0 = st["y"] + li * LH + bb[1]; y1 = st["y"] + li * LH + bb[3]
        for y in range(y0 - 5, y1 + 6):
            t = min(1, max(0, (y - y0) / max(1, y1 - y0)))
            c = tuple(int(st["top"][k] + (st["bot"][k] - st["top"][k]) * t) for k in range(3))
            gd.line([(0, y), (W, y)], fill=c + (255,))
    g.putalpha(txt); out.alpha_composite(g)
    return out
# Reveal schedule measured from the originals at 10 fps: (seconds, characters shown)
SCHED = [(0.6, 1), (0.7, 2), (0.9, 4), (1.1, 5), (1.2, 6), (1.4, 7), (1.5, 8), (1.8, 10), (1.9, 11), (2.0, 12), (2.1, 13), (2.3, 14)]
for k, st in STY.items():
    d = os.path.join(OUT, k); os.makedirs(d, exist_ok=True)
    for _, n in SCHED: render(n, st).save(os.path.join(d, f"n{n:02d}.png"))
    if mode == "preview":
        bg = Image.open(os.path.join(PREV, f"{k}-plain.jpg")).convert("RGBA")
        bg.alpha_composite(render(14, st)); bg.convert("RGB").resize((540, 960)).save(os.path.join(PREV, f"{k}-newtext-preview.jpg"), quality=88)
print("rendered", list(STY))
