import json
import os

import numpy as np
import pytest

import build
from osdfont.bdf import read_bdf
from osdfont.fon import read_fon
from osdfont.glyphs import TEXT_CODES, build_font, render
from osdfont.mcm import BLACK, CH, CW, WHITE, mcm_text, read_mcm

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES = os.path.join(ROOT, "tests", "fixtures")


def art(rows):
    return np.array([[c == "#" for c in r] for r in rows])


def test_fon_reader_gives_exact_ibm_vga_letter():
    font = read_fon(os.path.join(ROOT, "fonts", "pc", "Bm437_IBM_VGA_8x16.FON"))[0]
    assert (font["w"], font["h"]) == (8, 16)
    a = font["glyphs"][ord("A")]
    assert (a[2:12] == art([
        "...#....",
        "..###...",
        ".##.##..",
        "##...##.",
        "##...##.",
        "#######.",
        "##...##.",
        "##...##.",
        "##...##.",
        "##...##.",
    ])).all()
    assert not a[:2].any() and not a[12:].any()


def test_bdf_reader_places_glyph_in_font_box():
    a = read_bdf(os.path.join(ROOT, "fonts", "vault", "terminus", "ter-u16n.bdf"))[ord("A")]
    assert a.shape == (16, 8)
    assert (a[2:12] == art([
        "..####..",
        ".#....#.",
        ".#....#.",
        ".#....#.",
        ".#....#.",
        ".######.",
        ".#....#.",
        ".#....#.",
        ".#....#.",
        ".#....#.",
    ])).all()


def test_mcm_round_trip_matches_betaflight_file():
    path = os.path.join(ROOT, "iconsets", "default.mcm")
    chars = read_mcm(path)
    assert len(chars) == 256 and chars[0].shape == (CH, CW)
    assert mcm_text(chars).split() == open(path).read().split()


def test_groups_cover_every_code_once():
    groups = build.load_groups()
    codes = sorted(c for g in groups for c in g["codes"])
    assert codes == list(range(256))
    text = next(g for g in groups if g["id"] == "text")
    assert text["codes"] == TEXT_CODES


@pytest.fixture(scope="module")
def loaded():
    iconsets = build.load_iconsets()
    stock = iconsets[0]["chars"]
    from osdfont.glyphs import reference_shapes
    return stock, build.load_fonts(build.load_catalog(), reference_shapes(stock))


def test_catalog_is_valid(loaded):
    """load_fonts raises on duplicate ids, fonts that don't fit, and duplicate letters."""
    _, fonts = loaded
    assert len(fonts) >= 200
    for e, glyphs, score in fonts:
        assert e["license"], e["id"]
        assert e["collection"] in build.COLLECTIONS, e["id"]
        assert all(k >= 0x20 for k in glyphs), e["id"]
        # every font has A-Z; a few demoscene sheets have no digits (the icon set's digits fill in)
        assert all(c in glyphs for c in range(ord("A"), ord("Z") + 1)), e["id"]


def test_only_text_slots_are_replaced(loaded):
    stock, fonts = loaded
    for e, glyphs, _ in fonts[:: max(1, len(fonts) // 25)]:
        for mode in ("tall", "small"):
            chars = build_font(glyphs, stock, mode)
            changed = {c for c in range(256) if not np.array_equal(chars[c], stock[c])}
            assert changed <= set(TEXT_CODES), (e["id"], sorted(changed - set(TEXT_CODES)))


def test_render_keeps_glyph_and_outline_inside_cell():
    for shape, mode in [((8, 8), "tall"), ((16, 10), "tall"), ((8, 6), "small")]:
        cell = render(np.ones(shape, bool), mode)
        white = cell == WHITE
        assert not (white[0].any() or white[-1].any() or white[:, 0].any() or white[:, -1].any())
        # the outline is exactly the 8-neighbour dilation of the glyph, computed without wrap-around
        p = np.pad(white, 1)
        grown = np.zeros_like(white)
        for dy in (0, 1, 2):
            for dx in (0, 1, 2):
                grown |= p[dy:dy + CH, dx:dx + CW]
        assert ((cell == BLACK) == (grown & ~white)).all()


def render_cases():
    """Shared with tests/js: the browser's renderGlyph must match the Python render()."""
    rng = np.random.default_rng(7)
    cases = []
    for w, h in [(8, 8), (6, 8), (5, 7), (8, 14), (9, 13), (8, 16)]:
        g = rng.random((h, w)) < 0.4
        rows = ["".join("1" if p else "0" for p in r) for r in g]
        for mode in ("tall", "small"):
            cases.append({"rows": rows, "mode": mode, "cell": "".join(str(v) for v in render(g, mode).ravel())})
    return cases


def test_render_fixture_is_current():
    path = os.path.join(FIXTURES, "render_cases.json")
    cases = render_cases()
    if os.environ.get("UPDATE_FIXTURES") or not os.path.exists(path):
        os.makedirs(FIXTURES, exist_ok=True)
        json.dump(cases, open(path, "w"), indent=0)
    assert json.load(open(path)) == cases


def test_cc0_iconset_is_current_and_original():
    """cc0.mcm is exactly what make_cc0.py draws, and no symbol copies a Betaflight glyph."""
    import importlib.util

    spec = importlib.util.spec_from_file_location("make_cc0", os.path.join(ROOT, "iconsets", "make_cc0.py"))
    make = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(make)
    drawn = make.build()
    saved = read_mcm(os.path.join(ROOT, "iconsets", "cc0.mcm"))
    assert all(np.array_equal(a, b) for a, b in zip(drawn, saved)), "run: uv run iconsets/make_cc0.py"

    betaflight = set()
    for s in build.load_iconsets():
        if s["id"] != "cc0":
            betaflight |= {c.tobytes() for c in s["chars"]}
    text = set(TEXT_CODES)
    blank = np.full((CH, CW), 1, np.uint8).tobytes()
    copied = [hex(c) for c, g in enumerate(saved) if c not in text and g.tobytes() != blank and g.tobytes() in betaflight]
    assert not copied, f"these CC0 symbols equal a Betaflight glyph: {copied}"
