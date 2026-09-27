"""Build the website data from fonts/catalog.toml and iconsets/.

    uv run build.py            # site/data/*.json, site/f/<id>.html + .png, site/sitemap.xml

site/data/fonts.json      catalog + raw 1-bit text glyphs (the browser places them in cells)
site/data/iconsets.json   icon sets (256 packed glyphs each) + symbol groups
site/f/<id>.html          one crawlable page per font, with a PNG preview
"""
import html
import json
import os
import sys
import tomllib

import numpy as np
from PIL import Image

from osdfont.glyphs import (build_font, fingerprint, fits, is_native, legibility, load_source,
                            reference_shapes, size_of)
from osdfont.mcm import BLACK, CH, CW, GLYPHS, TRANSPARENT, WHITE, pack, read_mcm

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, "site")
BASE_URL = "https://over9kfpv.github.io/osd-fonts/"
COLLECTIONS = {
    "pc": "IBM PC ROM fonts",
    "vault": "Terminal & game fonts",
    "cc0": "CC0 collection (OpenGameArt)",
    "demoscene": "Demoscene (unknown authors)",
}


def parse_codes(specs):
    codes = []
    for s in specs:
        a, _, b = s.partition("-")
        codes += range(int(a, 16), int(b or a, 16) + 1)
    return codes


def load_groups():
    groups = tomllib.load(open(os.path.join(ROOT, "iconsets", "groups.toml"), "rb"))["group"]
    taken = set()
    for g in groups:
        g["codes"] = parse_codes(g["codes"])
        if taken & set(g["codes"]):
            raise ValueError(f"group {g['id']} overlaps another group: {sorted(taken & set(g['codes']))}")
        taken |= set(g["codes"])
    rest = [g for g in groups if g["id"] == "other"][0]
    rest["codes"] = [c for c in range(GLYPHS) if c not in taken]
    return groups


def load_iconsets():
    meta = tomllib.load(open(os.path.join(ROOT, "iconsets", "iconsets.toml"), "rb"))["iconset"]
    for s in meta:
        s["chars"] = read_mcm(os.path.join(ROOT, "iconsets", s["file"]))
    return meta


def load_catalog():
    return tomllib.load(open(os.path.join(ROOT, "fonts", "catalog.toml"), "rb"))["font"]


def load_fonts(catalog, reference):
    """Load every font, enforcing the catalog rules: unique ids, fits 12x18, no duplicate letters."""
    fonts, ids, prints = [], set(), {}
    for e in catalog:
        if e["id"] in ids:
            raise ValueError(f"duplicate id {e['id']}")
        ids.add(e["id"])
        glyphs = load_source(e, os.path.join(ROOT, "fonts"), reference)
        if not fits(glyphs):
            raise ValueError(f"{e['id']}: {size_of(glyphs)} does not fit a 12x18 cell with outline")
        fp = fingerprint(glyphs)
        if fp in prints:
            raise ValueError(f"{e['id']}: same letters as {prints[fp]}")
        prints[fp] = e["id"]
        fonts.append((e, glyphs, legibility(glyphs, reference)))
    return fonts


PREVIEW_TEXT = ("ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "0123456789.:-")
PALETTE = {BLACK: (0, 0, 0), WHITE: (255, 255, 255), TRANSPARENT: (58, 72, 86)}


def preview_png(chars, path, scale=2):
    cols = max(len(t) for t in PREVIEW_TEXT)
    img = np.zeros((len(PREVIEW_TEXT) * CH, cols * CW, 3), np.uint8)
    img[:] = PALETTE[TRANSPARENT]
    for r, line in enumerate(PREVIEW_TEXT):
        for i, ch in enumerate(line):
            cell = chars[ord(ch)]
            for v, rgb in PALETTE.items():
                img[r * CH:(r + 1) * CH, i * CW:(i + 1) * CW][cell == v] = rgb
    Image.fromarray(img).resize((img.shape[1] * scale, img.shape[0] * scale), Image.NEAREST).save(path, optimize=True)


FONT_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{name} · OSD Fonts</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{name} · Betaflight OSD font">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{base}f/{id}.png">
<link rel="canonical" href="{base}f/{id}.html">
<link rel="icon" href="../assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="../assets/style.css">
<script>try {{ const t = localStorage.getItem("osdf-theme"); if (t) document.documentElement.dataset.theme = t }} catch (e) {{}}</script>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a class="logo" href="../index.html"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="5" width="28" height="22" rx="6" fill="currentColor"/><path fill="var(--ground)" d="M13 10h6v2h-6zM11 12h2v10h-2zM19 12h2v10h-2zM13 16h6v2h-6z"/><circle cx="25.5" cy="9.5" r="1.7" fill="var(--accent)"/></svg>OSD Fonts</a>
    <nav class="nav" aria-label="Main"><a href="../index.html#fonts">Retro fonts</a><a href="../mix.html">Mix fonts &amp; icons</a><a href="../editor.html">Font editor</a><a href="../install.html">Install</a><a href="https://github.com/Over9kfpv/osd-fonts">GitHub</a></nav>
  </header>
  <main class="font-page">
    <div>
      <p class="eyebrow">{collection}</p>
      <h1>{name}</h1>
      <p class="lede">{desc}</p>
      <div class="ctas"><a class="btn accent" href="../index.html#{id}">Try it on the OSD</a><a class="btn ghost" href="../mix.html?font={id}">Mix with icons →</a><a class="btn ghost" href="../editor.html?font={id}">Edit</a></div>
    </div>
    <div class="bundle">
      <img class="font-preview" src="{id}.png" width="{pw}" height="{ph}" alt="{name}: A to Z and 0 to 9 as they appear on the OSD">
      <dl class="meta">{meta}</dl>
    </div>
  </main>
  <footer class="site">
    <p>Free downloads · Open source. Each font keeps its own license; icons come from Betaflight Configurator (GPL-3.0).</p>
    <p><a href="../install.html">How to install</a> · <a href="https://github.com/Over9kfpv/osd-fonts">Source on GitHub</a> · <a href="https://over9kfpv.github.io/stickbeats/">Stickbeats</a></p>
  </footer>
</div>
<script type="module" src="../assets/theme.js"></script>
</body>
</html>
"""


def font_page(e, glyphs, native, png_size):
    w, h = size_of(glyphs)
    how = "used at native size" if native else "centred 1:1, or doubled in height if you pick Tall"
    desc = (f"{e['name']} as a Betaflight analog OSD font: {w}×{h} px letters, {how}, "
            f"with a black outline and the stock Betaflight symbols.")
    rows = [("Collection", COLLECTIONS[e["collection"]]), ("Letter size", f"{w}×{h} px"),
            ("License", e["license"]), ("Author", e.get("author") or "Unknown"),
            ("Source", f'<a href="{html.escape(e["url"])}">{html.escape(e["url"])}</a>' if e.get("url") else "—")]
    meta = "".join(f"<dt>{k}</dt><dd>{v if k == 'Source' else html.escape(v)}</dd>" for k, v in rows)
    return FONT_PAGE.format(name=html.escape(e["name"]), desc=html.escape(desc), id=e["id"], base=BASE_URL,
                            collection=COLLECTIONS[e["collection"]], meta=meta, pw=png_size[0], ph=png_size[1])


def main():
    iconsets = load_iconsets()
    stock = [s for s in iconsets if s["id"] == "default"][0]["chars"]
    reference = reference_shapes(stock)
    groups = load_groups()
    fonts = load_fonts(load_catalog(), reference)

    os.makedirs(os.path.join(SITE, "data"), exist_ok=True)
    os.makedirs(os.path.join(SITE, "f"), exist_ok=True)
    out_fonts = []
    for e, glyphs, score in fonts:
        native = is_native(glyphs)
        w, h = size_of(glyphs)
        chars = build_font(glyphs, stock, "small")
        png = os.path.join(SITE, "f", f"{e['id']}.png")
        preview_png(chars, png)
        with open(os.path.join(SITE, "f", f"{e['id']}.html"), "w") as f:
            f.write(font_page(e, glyphs, native, Image.open(png).size))
        out_fonts.append({
            "id": e["id"], "name": e["name"], "collection": e["collection"],
            "license": e["license"], "author": e.get("author"), "url": e.get("url"),
            "featured": e.get("featured", False), "size": f"{w}x{h}", "native": bool(native),
            "score": round(float(score), 3),
            "glyphs": {str(c): ["".join("1" if p else "0" for p in row) for row in g] for c, g in glyphs.items()},
        })
    with open(os.path.join(SITE, "data", "fonts.json"), "w") as f:
        json.dump({"collections": COLLECTIONS, "fonts": out_fonts}, f, separators=(",", ":"))
    with open(os.path.join(SITE, "data", "iconsets.json"), "w") as f:
        json.dump({
            "license": "GPL-3.0 (Betaflight Configurator)",
            "groups": [{k: g[k] for k in ("id", "name", "about", "codes")} for g in groups],
            "iconsets": [{"id": s["id"], "name": s["name"], "glyphs": pack(s["chars"])} for s in iconsets],
        }, f, separators=(",", ":"))
    pages = ["", "mix.html", "editor.html", "install.html"] + [f"f/{e['id']}.html" for e, _, _ in fonts]
    with open(os.path.join(SITE, "sitemap.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        f.writelines(f"  <url><loc>{BASE_URL}{p}</loc></url>\n" for p in pages)
        f.write("</urlset>\n")
    print(f"{len(fonts)} fonts, {len(iconsets)} icon sets, {len(groups)} groups -> site/", file=sys.stderr)


if __name__ == "__main__":
    main()
