"""Draw the CC0 icon set (iconsets/cc0.mcm) from scratch.

Every symbol is drawn here from simple shapes; unit labels use Tom Thumb (3x5, CC0) and
letters/logo use Public Pixel (CC0), both from fonts/cc0/. Only the slot numbers and the
job of each slot follow Betaflight (src/main/drivers/osd_symbols.h), so the firmware finds
each icon where it expects it. The result is dedicated to the public domain (CC0 1.0).

    uv run iconsets/make_cc0.py      # writes iconsets/cc0.mcm and iconsets/cc0-preview.png
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from osdfont.bdf import read_outline  # noqa: E402
from osdfont.glyphs import load_sheet, reference_shapes, render  # noqa: E402
from osdfont.mcm import BLACK, CH, CW, TRANSPARENT, WHITE, mcm_text, read_mcm  # noqa: E402

FONTS = os.path.join(ROOT, "fonts", "cc0")


# ---------- tiny text: Tom Thumb 3x5 ----------
def tiny_font():
    ref = reference_shapes(read_mcm(os.path.join(ROOT, "iconsets", "default.mcm")))
    cells = load_sheet(os.path.join(FONTS, "tom-thumb", "tom-thumb-new.png"), 4, 6, 32, 0, 0x7F, ref)
    return {c: g[:5, :3] for c, g in cells.items()}  # drop the spacing row/column


TINY = tiny_font()


class Glyph:
    """A 12x18 drawing: `fg` pixels become white, `bk` pixels black, the rest transparent.
    `finish` adds a 1px black outline around the white pixels (clipped at the cell edge)."""

    def __init__(self):
        self.fg = np.zeros((CH, CW), bool)
        self.bk = np.zeros((CH, CW), bool)

    def px(self, x, y, black=False):
        if 0 <= x < CW and 0 <= y < CH:
            (self.bk if black else self.fg)[y, x] = True

    def rect(self, x0, y0, x1, y1, black=False, fill=True):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if fill or x in (x0, x1) or y in (y0, y1):
                    self.px(x, y, black)

    def line(self, x0, y0, x1, y1, black=False):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.px(x0, y0, black)
            if (x0, y0) == (x1, y1):
                return
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def poly(self, pts, ss=8):
        """Filled polygon in pixel coordinates (supersampled, then thresholded)."""
        img = Image.new("L", (CW * ss, CH * ss), 0)
        ImageDraw.Draw(img).polygon([(x * ss, y * ss) for x, y in pts], fill=255)
        small = np.asarray(img.resize((CW, CH), Image.BOX)) > 110
        self.fg |= small

    def text(self, s, x, y):
        for ch in s:
            g = TINY.get(ord(ch))
            if g is not None:
                ys, xs = np.nonzero(g)
                for yy, xx in zip(ys, xs):
                    self.px(x + xx, y + yy)
            x += 4

    def ctext(self, s, y):
        """Tiny text centred horizontally."""
        self.text(s, (CW - (4 * len(s) - 1)) // 2, y)

    def finish(self, outline=True):
        cell = np.full((CH, CW), TRANSPARENT, np.uint8)
        if outline:
            p = np.pad(self.fg, 1)
            grown = np.zeros_like(self.fg)
            for dy in range(3):
                for dx in range(3):
                    grown |= p[dy:dy + CH, dx:dx + CW]
            cell[grown] = BLACK
        cell[self.bk] = BLACK
        cell[self.fg] = WHITE
        return cell


def units(top, bottom=None, y=None):
    g = Glyph()
    if bottom is None:
        g.ctext(top, 6 if y is None else y)
    else:
        g.ctext(top, 3)
        g.ctext(bottom, 10)
    return g.finish()


# ---------- symbols ----------
def signal_bars():
    g = Glyph()
    for i, h in enumerate([3, 5, 7, 9]):
        g.rect(1 + i * 3, 14 - h, 2 + i * 3, 14)
    return g.finish()


def side_pointer(right):
    """Horizon sidebar pointer: a small triangle pointing at the horizon."""
    g = Glyph()
    if right:  # sits on the right, points left
        g.poly([(10.5, 5), (10.5, 13), (5.5, 9)])
    else:
        g.poly([(1.5, 5), (1.5, 13), (6.5, 9)])
    return g.finish()


def throttle():
    g = Glyph()
    g.rect(5, 3, 6, 15)  # slot
    g.rect(3, 7, 8, 9)  # knob
    g.line(2, 15, 9, 15)
    return g.finish()


def house(small=False):
    g = Glyph()
    top, base = (5, 9) if small else (3, 8)
    g.poly([(6, top - 0.5), (11, base + 0.5), (1, base + 0.5)])
    g.rect(2, base, 9, 14)
    g.rect(5, 11, 6, 14, black=True)  # door
    g.fg[11:15, 5:7] = False
    return g.finish()


def stick_dot(y):
    g = Glyph()
    g.rect(4, y, 7, y + 1)  # a short dash rather than a dot
    return g.finish()


def plus():
    g = Glyph()
    g.rect(5, 6, 6, 11)
    g.rect(3, 8, 8, 9)
    return g.finish()


def degree(letter):
    g = Glyph()
    g.rect(1, 3, 3, 5, fill=False)
    g.text(letter, 6, 7)
    g.text(letter, 6, 7)
    return g.finish()


def sd_card():
    g = Glyph()
    g.poly([(2.5, 3.5), (7.5, 3.5), (9.5, 5.5), (9.5, 14.5), (2.5, 14.5)])
    for x in (4, 6, 8):
        g.px(x, 5, black=True)
        g.fg[5, x] = False
    return g.finish()


def home_flag():
    g = Glyph()
    g.rect(2, 3, 2, 15)
    g.poly([(3, 3.5), (10.5, 5.5), (3, 8.5)])
    return g.finish()


def ladder():
    """AH decoration: short tick marks at the top, middle and bottom of the cell."""
    g = Glyph()
    g.rect(5, 0, 6, 0)
    g.rect(4, 8, 7, 9)
    g.rect(5, 17, 6, 17)
    return g.finish()


def vline():
    g = Glyph()
    g.rect(5, 0, 6, 17)
    return g.finish()


def hline():
    g = Glyph()
    g.rect(0, 8, 11, 9)
    return g.finish()


def heading_letter(ch):
    g = Glyph()
    for x in (1, 5, 9):
        g.rect(x, 0, x, 1)
    big = PUBLIC_PIXEL.get(ord(ch))
    ys, xs = np.nonzero(big)
    oy, ox = 6, (CW - big.shape[1]) // 2
    for y, x in zip(ys, xs):
        g.px(ox + x, oy + y)
    return g.finish()


def heading_ticks(long_mid):
    g = Glyph()
    for x in (1, 5, 9):
        g.rect(x, 0, x, 1)
    if long_mid:
        g.rect(5, 0, 5, 5)
    return g.finish()


def satellite(left):
    g = Glyph()
    if left:  # solar panel, left half
        g.rect(1, 5, 9, 12, fill=False)
        g.line(5, 5, 5, 12)
        g.line(1, 8, 9, 8)
        g.rect(10, 8, 11, 9)
    else:  # body and dish, right half
        g.rect(0, 8, 1, 9)
        g.rect(2, 6, 6, 11)
        g.poly([(7, 4.5), (11.5, 3.5), (11.5, 14.5), (7, 13.5)])
    return g.finish()


def checkered_flag():
    g = Glyph()
    g.rect(1, 2, 1, 16)
    for r in range(3):
        for c in range(4):
            if (r + c) % 2 == 0:
                g.rect(2 + c * 2, 3 + r * 2, 3 + c * 2, 4 + r * 2)
            else:
                g.rect(2 + c * 2, 3 + r * 2, 3 + c * 2, 4 + r * 2, black=True)
    return g.finish()


def arrow(deg):
    """Filled arrow pointing at `deg` (0 = east, 90 = north), centred in the cell."""
    g = Glyph()
    cx, cy = 6, 9
    a = math.radians(deg)
    fx, fy = math.cos(a), -math.sin(a)  # forward (screen y points down)
    sx, sy = -fy, fx  # sideways

    def p(f, s):
        return (cx + fx * f + sx * s, cy + fy * f + sy * s)

    g.poly([p(5.8, 0), p(0.8, 3.6), p(0.8, 1.2), p(-5.2, 1.2), p(-5.2, -1.2), p(0.8, -1.2), p(0.8, -3.6)])
    return g.finish()


def speed():
    g = Glyph()
    for x0 in (1, 6):
        g.line(x0, 5, x0 + 3, 9)
        g.line(x0 + 3, 9, x0, 13)
        g.line(x0 + 1, 5, x0 + 4, 9)
        g.line(x0 + 4, 9, x0 + 1, 13)
    return g.finish()


def distance():
    g = Glyph()
    g.rect(1, 12, 10, 12)
    g.rect(1, 10, 1, 14)
    g.rect(10, 10, 10, 14)
    g.poly([(3, 5.5), (6, 2.5), (9, 5.5), (6, 8.5)])
    return g.finish()


def crosshair(part):
    g = Glyph()
    if part == "left":
        g.rect(4, 8, 11, 9)
    elif part == "right":
        g.rect(0, 8, 7, 9)
    else:
        g.rect(3, 6, 8, 11, fill=False)
        g.rect(5, 8, 6, 9)
        g.rect(0, 8, 1, 9)
        g.rect(10, 8, 11, 9)
    return g.finish()


def small_arrow(up):
    g = Glyph()
    if up:
        g.poly([(6, 3.5), (10.5, 8.5), (1.5, 8.5)])
    else:
        g.poly([(6, 14.5), (10.5, 9.5), (1.5, 9.5)])
    return g.finish()


def chevron(right):
    g = Glyph()
    if right:
        g.poly([(3, 5), (8.5, 9), (3, 13), (3, 10.5), (5.5, 9), (3, 7.5)])
    else:
        g.poly([(9, 5), (3.5, 9), (9, 13), (9, 10.5), (6.5, 9), (9, 7.5)])
    return g.finish()


def lap_clock():
    g = Glyph()
    g.poly([(6 + 4.5 * math.cos(t), 9 + 4.5 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 24)])
    g.fg[6:13, 3:9] &= False
    g.rect(4, 6, 8, 12, fill=False)
    g.fg[6:13, 4:9] = False
    g.rect(6, 7, 6, 9)
    g.rect(6, 9, 8, 9)
    return g.finish()


def thermometer():
    g = Glyph()
    g.rect(5, 2, 6, 11)
    g.poly([(6 + 2.8 * math.cos(t), 13 + 2.8 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 20)])
    for y in (4, 6, 8):
        g.px(8, y)
    return g.finish()


def ah_bar(k):
    """Artificial horizon pip, 9 vertical positions from the top (0) to the bottom (8) of the cell."""
    g = Glyph()
    y = round(k * 2.1)
    g.rect(2, y, 9, min(y + 1, CH - 1))  # 8 px wide pip
    return g.finish()


def progress(kind):
    """Progress bar pieces: rows 4-13, black frame, white fill."""
    g = Glyph()
    top, bot = 4, 13
    if kind == "start":
        g.rect(9, top, 11, bot, black=True)
        g.rect(10, top + 1, 11, bot - 1, black=False)
    elif kind in ("full", "half", "empty"):
        g.rect(0, top, 11, top, black=True)
        g.rect(0, bot, 11, bot, black=True)
        fill_to = {"full": 11, "half": 5, "empty": -1}[kind]
        if fill_to >= 0:
            g.rect(0, top + 2, fill_to, bot - 2)
    elif kind == "end":
        g.rect(0, top, 2, bot, black=True)
        g.rect(0, top + 1, 1, bot - 1, black=False)
    elif kind == "close":
        g.rect(0, top, 0, bot, black=True)
    return g.finish(outline=False)


def battery(level):
    """Battery gauge, level 6 = full ... 0 = empty."""
    g = Glyph()
    g.rect(4, 2, 7, 3)  # terminal
    g.rect(2, 4, 9, 16, fill=False)
    g.rect(1, 4, 10, 16, fill=False)
    fill_h = round(level * 10 / 6)
    if fill_h:
        g.rect(3, 15 - fill_h + 1, 8, 15)
    return g.finish()


def main_battery():
    g = Glyph()
    g.rect(4, 2, 7, 3)
    g.rect(1, 4, 10, 16, fill=False)
    g.rect(2, 4, 9, 16, fill=False)
    g.rect(5, 7, 6, 13)
    g.rect(3, 9, 8, 11)
    return g.finish()


# ---------- letters and logo: Public Pixel ----------
def public_pixel():
    glyphs, _ = read_outline(os.path.join(FONTS, "public-pixel", "PublicPixel.ttf"), range(0x20, 0x60))
    ys, xs = np.nonzero(np.any([glyphs[c] for c in range(0x41, 0x5B)], axis=0))
    box = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
    return {c: g[box] for c, g in glyphs.items()}


PUBLIC_PIXEL = public_pixel()


def logo():
    """288x72 boot logo: OSD FONTS in Public Pixel at 3x, CC0 line in Tom Thumb at 2x."""
    W, H = 288, 72
    fg = np.zeros((H, W), bool)

    def stamp(text, glyphs, scale, y, adv):
        widths = [adv * scale for _ in text]
        x = (W - sum(widths) + scale) // 2
        for ch in text:
            g = glyphs.get(ord(ch))
            if g is not None:
                big = np.kron(g, np.ones((scale, scale), bool))
                fg[y:y + big.shape[0], x:x + big.shape[1]] |= big
            x += adv * scale

    stamp("OSD FONTS", PUBLIC_PIXEL, 3, 10, 9)
    stamp("CC0 PUBLIC DOMAIN", TINY, 2, 46, 4)
    fg[40:42, 24:264] = True  # rule between the lines
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
    blank = Glyph().finish()
    chars = [blank.copy() for _ in range(256)]
    S = {
        0x01: signal_bars(), 0x02: side_pointer(True), 0x03: side_pointer(False), 0x04: throttle(),
        0x05: house(), 0x06: units("V", y=7), 0x07: units("mA", "h"),
        0x08: stick_dot(3), 0x09: stick_dot(8), 0x0A: stick_dot(13), 0x0B: plus(),
        0x0C: units("m", y=7), 0x0D: degree("F"), 0x0E: degree("C"), 0x0F: units("ft", y=7),
        0x10: sd_card(), 0x11: home_flag(), 0x12: units("RPM", y=7), 0x13: ladder(),
        0x14: units("ROL", y=7), 0x15: units("PIT", y=7), 0x16: vline(), 0x17: hline(),
        0x18: heading_letter("N"), 0x19: heading_letter("S"), 0x1A: heading_letter("E"), 0x1B: heading_letter("W"),
        0x1C: heading_ticks(True), 0x1D: heading_ticks(False), 0x1E: satellite(True), 0x1F: satellite(False),
        0x24: checkered_flag(),
        0x70: speed(), 0x71: distance(), 0x72: crosshair("left"), 0x73: crosshair("centre"),
        0x74: crosshair("right"), 0x75: small_arrow(True), 0x76: small_arrow(False),
        0x77: chevron(True), 0x78: chevron(False), 0x79: lap_clock(), 0x7A: thermometer(),
        0x7B: units("LQ", y=7), 0x7C: vline(), 0x7D: units("km", y=7), 0x7E: units("mi", y=7),
        0x7F: units("ALT", y=7), 0x89: units("LAT", y=7), 0x98: units("LON", y=7),
        0x8A: progress("start"), 0x8B: progress("full"), 0x8C: progress("half"), 0x8D: progress("empty"),
        0x8E: progress("end"), 0x8F: progress("close"),
        0x97: main_battery(), 0x99: units("ft", "s"), 0x9A: units("A", y=7), 0x9B: units("on", "m"),
        0x9C: units("fly", "m"), 0x9D: units("mph", y=7), 0x9E: units("km", "h"), 0x9F: units("m", "s"),
    }
    for i in range(16):  # 0x60 south, 0x64 east, 0x68 north, 0x6C west
        S[0x60 + i] = arrow(-90 + i * 22.5)
    for k in range(9):
        S[0x80 + k] = ah_bar(k)
    for i in range(7):  # 0x90 full ... 0x96 empty
        S[0x90 + i] = battery(6 - i)
    for code, cell in S.items():
        chars[code] = cell
    for code in range(0x20, 0x60):
        if code != 0x24 and code in PUBLIC_PIXEL:
            chars[code] = render(PUBLIC_PIXEL[code], "small")
    for i, tile in enumerate(logo()):
        chars[0xA0 + i] = tile
    return chars


def preview(chars, path):
    pal = {BLACK: (0, 0, 0), WHITE: (255, 255, 255), TRANSPARENT: (58, 72, 86)}
    img = np.zeros((16 * (CH + 1), 16 * (CW + 1), 3), np.uint8)
    img[:] = (30, 30, 30)
    for c, cell in enumerate(chars):
        y, x = (c // 16) * (CH + 1), (c % 16) * (CW + 1)
        for v, rgb in pal.items():
            img[y:y + CH, x:x + CW][cell == v] = rgb
    Image.fromarray(img).resize((img.shape[1] * 3, img.shape[0] * 3), Image.NEAREST).save(path)


if __name__ == "__main__":
    chars = build()
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "cc0.mcm"), "w", newline="") as f:
        f.write(mcm_text(chars))
    preview(chars, os.path.join(here, "cc0-preview.png"))
    print("wrote iconsets/cc0.mcm and iconsets/cc0-preview.png")
