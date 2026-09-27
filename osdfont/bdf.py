"""Minimal readers for BDF bitmap fonts and pixel-outline TTF/OTB fonts."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def read_bdf(path, codes=range(32, 127)):
    """Return {code: bool array} with every glyph placed in the font bounding box."""
    wanted, glyphs = set(codes), {}
    fbb = None
    code = bbx = rows = None
    for line in open(path, encoding="latin-1"):
        key, _, rest = line.strip().partition(" ")
        if key == "FONTBOUNDINGBOX":
            fbb = list(map(int, rest.split()))
        elif key == "ENCODING":
            code = int(rest.split()[0])
        elif key == "BBX":
            bbx = list(map(int, rest.split()))
        elif key == "BITMAP":
            rows = []
        elif key == "ENDCHAR":
            if code in wanted:
                glyphs[code] = place(fbb, bbx, rows)
            code = bbx = rows = None
        elif rows is not None:
            rows.append(key)
    return glyphs


def place(fbb, bbx, rows):
    fw, fh, fx, fy = fbb
    w, h, x, y = bbx
    out = np.zeros((fh, fw), bool)
    top = (fh + fy) - (h + y)
    left = x - fx
    for r, hexrow in enumerate(rows):
        bits = bin(int(hexrow, 16))[2:].zfill(len(hexrow) * 4)[:w]
        for c, b in enumerate(bits):
            if b == "1" and 0 <= top + r < fh and 0 <= left + c < fw:
                out[top + r, left + c] = True
    return out


SAMPLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def pixel_size(path):
    """Smallest size at which a pixel-outline font renders without grey (anti-aliased) pixels."""
    for size in range(5, 33):
        try:
            font = ImageFont.truetype(path, size)
        except OSError:  # bitmap-only fonts (OTB) only load at their strike sizes
            continue
        img = Image.new("L", (size * len(SAMPLE) * 2, size * 3), 0)
        ImageDraw.Draw(img).text((size, size), SAMPLE, font=font, fill=255)
        a = np.asarray(img)
        ink = (a > 0).sum()
        if ink and ((a > 30) & (a < 225)).sum() / ink < 0.01:
            return size
    raise ValueError(f"no pixel-exact size for {path}")


def read_outline(path, codes=range(32, 127)):
    """Render a pixel-outline TTF/OTB at its native pixel size, 1-bit, on a shared baseline."""
    size = pixel_size(path)
    font = ImageFont.truetype(path, size)
    glyphs = {}
    for code in codes:
        img = Image.new("1", (size * 3, size * 3), 0)
        draw = ImageDraw.Draw(img)
        draw.fontmode = "1"
        draw.text((size, size * 2), chr(code), font=font, fill=1, anchor="ls")
        glyphs[code] = np.asarray(img, dtype=bool)
    return glyphs, size
