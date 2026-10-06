"""Build the Kenney 1-Bit icon set (iconsets/kenney.mcm) from Kenney's 1-Bit Pack (CC0 1.0).

Tiles come from iconsets/kenney/monochrome-transparent.png (16x16 tiles, 1 px apart). Each tile is
cropped to the 12 px cell width and placed in rows 1-16 of the 18-row cell with a black outline.
Slots without a fitting Kenney tile (units, bar pieces, stick overlay, horizon bars, ...) keep the
shapes drawn by make_cc0.py (including the 16 home arrows, which need one consistent style). Slot numbers follow Betaflight's osd_symbols.h.

    uv run iconsets/make_kenney.py   # writes iconsets/kenney.mcm and iconsets/kenney-preview.png
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

import make_cc0 as cc0  # noqa: E402
from osdfont.mcm import BLACK, CH, CW, TRANSPARENT, WHITE, mcm_text  # noqa: E402

SHEET = np.asarray(Image.open(os.path.join(HERE, "kenney", "monochrome-transparent.png")).convert("RGBA"))[..., 3] > 128
T = 16


def tile(col, row):
    return SHEET[row * (T + 1):row * (T + 1) + T, col * (T + 1):col * (T + 1) + T].copy()


def cell(mask, top=1, vcentre=False):
    """A 16x16 mask as an outlined cell: content centred horizontally (clipped equally if wider than 12)."""
    ys, xs = np.nonzero(mask)
    g = cc0.Glyph()
    x0 = (xs.min() + xs.max() + 1 - CW) // 2
    if vcentre:
        top = (CH - (ys.max() - ys.min() + 1)) // 2 - ys.min()
    for y, x in zip(ys, xs):
        g.px(x - x0, y + top)
    return g.finish()


def heart(level):
    """Battery gauge as a heart: level 6 = full ... 0 = empty. The filled heart rises inside the outline."""
    full, outline = tile(39, 10), tile(40, 10)
    ys, xs = np.nonzero(full | outline)
    top, bottom = ys.min(), ys.max() + 1
    cut = bottom - round(level * (bottom - top) / 6)
    fill = full.copy()
    fill[:cut] = False
    return cell(outline | fill)


LETTERS = {}
for i in range(13):
    LETTERS[0x41 + i] = (35 + i, 18)
LETTERS[0x4E] = (35, 19)
for i in range(12):
    LETTERS[0x4F + i] = (36 + i, 19)
for i in range(10):
    LETTERS[0x30 + i] = (35 + i, 17)
LETTERS.update({0x3A: (45, 17), 0x2E: (46, 17), 0x25: (47, 17), 0x23: (35, 20), 0x2B: (36, 20),
                0x2D: (37, 20), 0x3D: (40, 20)})

_ys, _xs = np.nonzero(np.any([tile(*LETTERS[c]) for c in range(0x41, 0x5B)], axis=0))
BOX = (slice(_ys.min(), _ys.max() + 1), slice(_xs.min(), _xs.max() + 1))


def letter(ch):
    return tile(*LETTERS[ord(ch)])[BOX]


def heading_letter(ch):
    g = cc0.Glyph()
    for x in (1, 5, 9):
        g.rect(x, 0, x, 1)
    m = letter(ch)
    oy, ox = 6, (CW - m.shape[1]) // 2
    for y, x in zip(*np.nonzero(m)):
        g.px(ox + x, oy + y)
    return g.finish()


def logo():
    """288x72 boot logo: OSD FONTS in Kenney letters at 3x, CC0 line in Tom Thumb at 2x."""
    W, H = 288, 72
    fg = np.zeros((H, W), bool)

    def stamp(text, glyph_of, scale, y, adv):
        x = (W - adv * scale * len(text) + scale) // 2
        for ch in text:
            g = glyph_of(ch)
            if g is not None:
                big = np.kron(g, np.ones((scale, scale), bool))
                fg[y:y + big.shape[0], x:x + big.shape[1]] |= big
            x += adv * scale

    stamp("OSD FONTS", lambda ch: letter(ch) if ord(ch) in LETTERS else None, 3, 6, 10)
    stamp("KENNEY CC0", lambda ch: cc0.TINY.get(ord(ch)), 2, 46, 4)
    fg[40:42, 24:264] = True
    p = np.pad(fg, 1)
    grown = np.zeros_like(fg)
    for dy in range(3):
        for dx in range(3):
            grown |= p[dy:dy + H, dx:dx + W]
    img = np.full((H, W), TRANSPARENT, np.uint8)
    img[grown] = BLACK
    img[fg] = WHITE
    return [img[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW] for r in range(4) for c in range(24)]


def build():
    chars = cc0.build()
    S = {
        0x05: cell(tile(41, 16)), 0x10: cell(tile(42, 16)), 0x79: cell(tile(40, 12)),
        0x75: cell(tile(23, 20)), 0x76: cell(tile(25, 20)), 0x77: cell(tile(24, 20)), 0x78: cell(tile(26, 20)),
        0x18: heading_letter("N"), 0x19: heading_letter("S"), 0x1A: heading_letter("E"), 0x1B: heading_letter("W"),
    }
    for i in range(7):  # 0x90 full ... 0x96 empty
        S[0x90 + i] = heart(6 - i)
    for code, c in LETTERS.items():
        S[code] = cell(tile(*c), vcentre=True)
    for code, c in S.items():
        chars[code] = c
    for i, t in enumerate(logo()):
        chars[0xA0 + i] = t
    return chars


if __name__ == "__main__":
    chars = build()
    with open(os.path.join(HERE, "kenney.mcm"), "w", newline="") as f:
        f.write(mcm_text(chars))
    cc0.preview(chars, os.path.join(HERE, "kenney-preview.png"))
    print("wrote iconsets/kenney.mcm and iconsets/kenney-preview.png")
