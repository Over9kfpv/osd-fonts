"""Turn a font source into text glyphs and place them in 12x18 OSD cells.

Only the text slots are replaced (TEXT_CODES); every symbol comes from an icon set.
"""
import os

import numpy as np
from PIL import Image

from .bdf import read_bdf, read_outline
from .fon import read_fon
from .mcm import BLACK, CH, CW, TRANSPARENT, WHITE

FIRST = 0x20
KEEP_SYMBOL = {0x24}  # '$' holds Betaflight's checkered-flag symbol
TEXT_CODES = [c for c in range(0x20, 0x60) if c not in KEEP_SYMBOL]
REF_CODES = [ord(c) for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"]


# ---------- shape comparison ----------

def normalize(glyphs, size=(8, 12)):
    """Crop A-Z/0-9 to their shared ink box and resample, for shape comparison."""
    present = {c: glyphs[c] for c in REF_CODES if c in glyphs and glyphs[c].any()}
    if not present:
        return {}
    ys, xs = np.nonzero(np.any(list(present.values()), axis=0))
    box = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
    return {c: np.asarray(Image.fromarray(g[box].astype(np.uint8) * 255).resize(size, Image.BILINEAR)) > 127
            for c, g in present.items()}


def reference_shapes(stock):
    """Normalised letters of the stock Betaflight font, the yardstick for legibility()."""
    return normalize({c: stock[c] == WHITE for c in REF_CODES})


def legibility(glyphs, reference):
    """Mean IoU of A-Z/0-9 against the stock Betaflight letters (missing glyphs count as 0)."""
    scores = [(a & reference[c]).sum() / max((a | reference[c]).sum(), 1)
              for c, a in normalize(glyphs).items()]
    return sum(scores) / len(REF_CODES)


# ---------- loaders ----------

def slice_sheet(on, w, h, cols, first, last):
    cols = cols or on.shape[1] // w
    rows = on.shape[0] // h
    glyphs = {}
    for i in range(cols * rows):
        code = first + i
        if code > last:
            break
        if code < FIRST:
            continue  # control-character slots would overwrite Betaflight symbols
        x, y = (i % cols) * w, (i // cols) * h
        g = on[y:y + h, x:x + w]
        if g.shape == (h, w) and (g.any() or code == FIRST):
            glyphs[code] = g
    return glyphs


def load_sheet(path, w, h, cols, first, last, reference):
    """Slice a PNG/BMP sheet. Multicolour sheets carry shadows, grids and gradients, so every
    luminance cutoff is tried and the one whose letters best match the stock shapes wins."""
    src = Image.open(path).convert("RGBA")
    flat = Image.new("RGBA", src.size, (255, 0, 255, 255))  # transparent sheets: key colour behind
    flat.alpha_composite(src)
    im = np.array(flat.convert("RGB")).astype(int)
    key = im[..., 0] << 16 | im[..., 1] << 8 | im[..., 2]
    vals, counts = np.unique(key, return_counts=True)
    ink = key != vals[counts.argmax()]  # everything that isn't the background colour
    lum = im @ [299, 587, 114] // 1000
    best = None
    for cut in np.unique(lum[ink]):
        glyphs = slice_sheet(ink & (lum >= cut), w, h, cols, first, last)
        score = legibility(glyphs, reference)
        if best is None or score > best[0] + 0.01:  # prefer the most inclusive cutoff on ties
            best = (score, glyphs)
    return best[1]


def load_source(entry, root, reference):
    """Raw text glyphs for a catalog entry, cropped to the font's ink box."""
    path = os.path.join(root, entry["file"])
    last = entry.get("last", 0x5F)
    fmt = entry["format"]
    if fmt == "sheet":
        glyphs = load_sheet(path, entry["w"], entry["h"], entry.get("cols"), entry.get("first", FIRST),
                            last, reference)
    else:
        if fmt == "fon":
            glyphs = read_fon(path)[0]["glyphs"]
        elif fmt == "bdf":
            glyphs = read_bdf(path)
        elif fmt == "outline":
            glyphs, _ = read_outline(path)
        else:
            raise ValueError(f"{entry['id']}: unknown format {fmt}")
        glyphs = {c: g for c, g in glyphs.items() if FIRST <= c <= last}
        if fmt == "outline":
            # Outline fonts can have stray tall glyphs; clip to the letter box plus 2 descender rows.
            ys = np.nonzero(np.any([glyphs[c] for c in REF_CODES], axis=(0, 2)))[0]
            glyphs = {c: g[ys.min():ys.max() + 3] for c, g in glyphs.items()}
    return crop_to_ink(glyphs)


def crop_to_ink(glyphs):
    ys, xs = np.nonzero(np.any(list(glyphs.values()), axis=0))
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return {c: g[y0:y1, x0:x1] for c, g in glyphs.items()}


def size_of(glyphs):
    return max(g.shape[1] for g in glyphs.values()), max(g.shape[0] for g in glyphs.values())


def fits(glyphs):
    w, h = size_of(glyphs)
    return w + 2 <= CW and h + 2 <= CH


def is_native(glyphs):
    """Already tall enough: doubling would not fit, so the font is used 1:1."""
    return size_of(glyphs)[1] * 2 + 2 > CH


def fingerprint(glyphs):
    return b"".join(np.packbits(glyphs[c]).tobytes() + bytes(glyphs[c].shape) for c in sorted(glyphs))


# ---------- placing glyphs in cells ----------

def render(g, mode):
    """Place a raw glyph in a 12x18 cell: optional 2x vertical, centred, 1px black outline."""
    if mode == "tall" and g.shape[0] * 2 + 2 <= CH:
        g = np.repeat(g, 2, axis=0)
    h, w = g.shape
    if h + 2 > CH or w + 2 > CW:
        raise ValueError(f"glyph {w}x{h} too big for {CW}x{CH}")
    fg = np.zeros((CH, CW), bool)
    oy, ox = (CH - h) // 2, (CW - w) // 2
    fg[oy:oy + h, ox:ox + w] = g
    ol = np.zeros_like(fg)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            ol |= np.roll(np.roll(fg, dy, 0), dx, 1)
    cell = np.full((CH, CW), TRANSPARENT, np.uint8)
    cell[ol] = BLACK
    cell[fg] = WHITE
    return cell


def build_font(glyphs, base, mode="tall"):
    """256 cells: text glyphs from the font, everything else from `base` (an icon set)."""
    chars = [c.copy() for c in base]
    for code, g in glyphs.items():
        if code in TEXT_CODES:
            chars[code] = render(g, mode)
    return chars
