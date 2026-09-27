"""One-off: copy the fonts used by the BitmapFonts prototype into fonts/ and write fonts/catalog.toml.

    uv run scripts/migrate_from_bitmapfonts.py ~/Projects/BitmapFonts

After this, fonts/catalog.toml is the source of truth; edit it by hand to add or change fonts.
"""
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)

from osdfont.fon import read_fon  # noqa: E402
from osdfont.glyphs import fingerprint, fits, load_source, reference_shapes, size_of  # noqa: E402
from osdfont.mcm import read_mcm  # noqa: E402

SRC = os.path.abspath(os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/Projects/BitmapFonts"))
sys.path.insert(0, os.path.join(SRC, "betaflight"))
import to_mcm as legacy  # noqa: E402

PC_URL = "https://int10h.org/oldschool-pc-fonts/"
PC_LICENSE = "CC BY-SA 4.0"


def readme_field(path, field):
    for line in open(os.path.join(os.path.dirname(path), "README.md"), encoding="utf-8"):
        m = re.match(rf"\s*-\s*{field}[^:]*:\s*(.+)", line)
        if m:
            return m.group(1).strip()
    return None


def short_license(text):
    """Map the vault's free-text license notes to a short label."""
    for pat, label in [("CC0", "CC0 1.0"), ("CC-BY 4.0", "CC BY 4.0"), ("CC-BY-SA", "CC BY-SA 4.0"),
                       ("SIL Open Font", "OFL 1.1"), ("OFL", "OFL 1.1"), ("GPL-3", "GPL-3.0"),
                       ("GPL-2", "GPL-2.0+ with font exception"), ("BSD-2", "BSD-2-Clause"),
                       ("WTFPL", "WTFPL"), ("MIT", "MIT"), ("Public domain", "Public domain"),
                       ("ermissive", "Permissive (see README)")]:
        if pat in text:
            return label
    return text


def title(slug):
    return re.sub(r"\b([a-z])", lambda m: m.group(1).upper(), slug.replace("-", " "))


def main():
    stock = read_mcm(os.path.join(HERE, "iconsets", "default.mcm"))
    reference = reference_shapes(stock)
    out = os.path.join(HERE, "fonts")
    entries, seen = [], set()
    for font in legacy.FONTS:
        path, group = font["file"], font["group"]
        slug = legacy.slug(font)
        ext = os.path.splitext(path)[1].lower()
        fmt = {".fon": "fon", ".bdf": "bdf", ".ttf": "outline", ".otb": "outline"}.get(ext, "sheet")
        e = {"id": slug, "collection": {"pc": "pc", "vault": "vault", "demoscene": "demoscene"}[group],
             "format": fmt}
        if fmt == "sheet":
            e.update(w=font["w"], h=font["h"])
            if font.get("cols"):
                e["cols"] = font["cols"]
            if font.get("first", 0x20) != 0x20:
                e["first"] = font["first"]
            if group == "demoscene":
                e["last"] = 0x5A  # demoscene sheets often carry credits after Z
        # copy the source file
        if group == "pc":
            rel = f"pc/{os.path.basename(path)}"
            e["name"] = read_fon(path)[0]["name"].removeprefix("Bm437 ")
            e.update(author="VileR", license=PC_LICENSE, url=PC_URL)
        elif group == "vault":
            rel = f"vault/{slug}/{os.path.basename(path)}"
            e["name"] = re.sub(r'^ASCII Bitmap Font "(.+)"$', r"\1", readme_field(path, "Font name") or title(slug))
            lic = readme_field(path, "License") or ""
            author = re.search(r"author: ([^)]+)\)", lic)
            e.update(author=author.group(1) if author else None, license=short_license(lic),
                     url=readme_field(path, "Source URL"))
        else:
            rel = f"demoscene/{os.path.basename(path)}"
            e.update(name=title(slug), author=None, license="Unknown", url=None)
        e["file"] = rel
        glyphs = load_source({**e, "file": path}, "/", reference)
        if not fits(glyphs):
            print(f"skip {slug}: {size_of(glyphs)} too big")
            continue
        fp = fingerprint(glyphs)
        if fp in seen:
            print(f"skip {slug}: same letters as an earlier font")
            continue
        seen.add(fp)
        dst = os.path.join(out, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)
        if group == "vault":
            shutil.copy2(os.path.join(os.path.dirname(path), "README.md"), os.path.join(os.path.dirname(dst), "README.md"))
        e["featured"] = slug in legacy.FEATURED
        entries.append(e)
    write_catalog(entries, os.path.join(out, "catalog.toml"))
    print(f"{len(entries)} fonts written")


def toml_value(k, v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return f"0x{v:02X}" if k in ("first", "last") else str(v)
    return '"' + str(v).replace("\\", "\\\\").replace('"', '\\"') + '"'


HEADER = """# Font catalog: one [[font]] per font. This file is the source of truth for build.py.
#
# id          url-safe identifier (also the .mcm file name)
# name        display name
# collection  pc | vault | demoscene
# format      fon | bdf | outline (pixel TTF/OTB) | sheet (PNG/BMP grid)
# file        path under fonts/
# w, h, cols  sheet cell size and glyphs per row (sheets only; cols defaults to image width / w)
# first       character code of the first cell (sheets, default 0x20)
# last        last character code to take (default 0x5F; demoscene sheets stop at 'Z')
# license, author, url   attribution shown on the site
# featured    part of the shortlist
#
# Skipped while migrating: 08X08-F3 (striped overlay), HT-DNXFT (non-ASCII order),
# SEGA Afterburner 4 and bloxxit (glyphs are solid tiles), Matrix Sans Screen (11px wide),
# Vircon32 CAD sheets (framed cells), fonts too big for 12x18, and exact duplicates.

"""

KEY_ORDER = ["id", "name", "collection", "format", "file", "w", "h", "cols", "first", "last",
             "license", "author", "url", "featured"]


def write_catalog(entries, path):
    with open(path, "w") as f:
        f.write(HEADER)
        for e in entries:
            f.write("[[font]]\n")
            for k in KEY_ORDER:
                if e.get(k) is not None:
                    v = e[k]
                    f.write(f"{k} = {toml_value(k, v)}\n")
            f.write("\n")


if __name__ == "__main__":
    main()
