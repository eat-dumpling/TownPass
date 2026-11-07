# 去掉洋紅背景、修邊、裁切、縮成 WebP。用法：python key.py <in.png> <out.webp> [maxw]
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
maxw = int(sys.argv[3]) if len(sys.argv) > 3 else 384
im = Image.open(src).convert('RGBA')
px = im.load()
w, h = im.size
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        # 洋紅程度：r、b 高、g 低
        m = min(r, b) - g
        if m > 150 and r > 170 and b > 170:
            px[x, y] = (0, 0, 0, 0)
        elif m > 40:
            # 邊緣：半透明，並把洋紅色偏拿掉
            k = (m - 40) / 110
            a2 = int(255 * (1 - min(1, k)))
            gg = g
            px[x, y] = (min(r, gg + 40), gg, min(b, gg + 40), min(a, a2))
bbox = im.getbbox()
im = im.crop(bbox)
if im.width > maxw:
    im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
im.save(dst, 'WEBP', quality=88, method=6)
print(dst, im.size, bbox)
