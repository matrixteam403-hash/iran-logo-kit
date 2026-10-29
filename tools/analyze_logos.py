#!/usr/bin/env python3
"""
Adds display hints to every entry of data/logos.json, based on its PNG file.

  tone     "light" when the logo would be hard to see on the site's dark tiles
           (dark navy / black logos). The site then shows it on a light tile.
           Omitted for logos that read well on dark.
  tint     dominant saturated colour of the logo (#rrggbb). Used for the soft glow
           behind the logo on dark tiles. Omitted for neutral (white/black/grey) logos.
  svgSize  size of the SVG file in bytes
  pngSize  size of the PNG file in bytes

A logo is considered "hard to see on dark" when both of these are true:
  * more than 40% of its visible pixels have too little contrast against the tile, and
  * more than 50% of its outline (edge pixels) has too little contrast against the tile,
    i.e. its silhouette disappears into the background.

Usage, from the repository root:   python3 tools/analyze_logos.py
Requires Pillow:                    pip install pillow
"""
import colorsys
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "logos.json")

TILE_RGB = (24, 25, 29)   # dark tile colour, keep in sync with --tile in styles.css
MIN_CONTRAST = 2.4        # minimum contrast for a pixel to count as readable
MAX_LOW_SHARE = 0.40      # share of unreadable pixels ...
MAX_LOW_EDGE = 0.50       # ... and of unreadable outline pixels that triggers a light tile
SAMPLE = 160              # analysis resolution (px)


def _lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(r, g, b):
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


TILE_L = luminance(*TILE_RGB)


def analyse(path):
    im = Image.open(path).convert("RGBA")
    im.thumbnail((SAMPLE, SAMPLE))
    w, h = im.size
    px = im.load()

    def opaque(x, y):
        return 0 <= x < w and 0 <= y < h and px[x, y][3] >= 128

    total = low = edges = low_edges = 0
    hues = {}
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            L = luminance(r, g, b)
            bad = (max(L, TILE_L) + 0.05) / (min(L, TILE_L) + 0.05) < MIN_CONTRAST
            total += 1
            low += bad
            if not (opaque(x - 1, y) and opaque(x + 1, y) and opaque(x, y - 1) and opaque(x, y + 1)):
                edges += 1
                low_edges += bad
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s >= 0.35 and v >= 0.30:
                acc = hues.setdefault(round(hh * 24) % 24, [0, 0, 0, 0])  # 15 degree buckets
                acc[0] += r
                acc[1] += g
                acc[2] += b
                acc[3] += 1
    if not total:
        return None, None
    light = low / total > MAX_LOW_SHARE and (low_edges / edges if edges else 0) > MAX_LOW_EDGE
    tint = None
    if hues:
        r, g, b, n = max(hues.values(), key=lambda a: a[3])
        if n / total >= 0.06:
            tint = "#%02x%02x%02x" % (round(r / n), round(g / n), round(b / n))
    return ("light" if light else None), tint


def main():
    with open(DATA, encoding="utf-8") as f:
        data = json.load(f)
    light = 0
    for x in data:
        png = os.path.join(ROOT, x["png"])
        svg = os.path.join(ROOT, x["svg"])
        for key in ("tone", "tint", "svgSize", "pngSize"):
            x.pop(key, None)
        tone, tint = analyse(png) if os.path.exists(png) else (None, None)
        if tone:
            x["tone"] = tone
            light += 1
        if tint:
            x["tint"] = tint
        x["svgSize"] = os.path.getsize(svg) if os.path.exists(svg) else 0
        x["pngSize"] = os.path.getsize(png) if os.path.exists(png) else 0
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(", ", ": "))
    print(f"{len(data)} logos analysed, {light} shown on light tiles", file=sys.stderr)


if __name__ == "__main__":
    main()
