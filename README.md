# OSD Fonts: retro fonts for the Betaflight analog OSD

**Site:** https://over9kfpv.github.io/osd-fonts/

278 retro bitmap fonts, converted for the Betaflight analog OSD (MAX7456, 12×18 characters):

- **IBM PC ROM fonts** (167): VGA, EGA, CGA, BIOS, Tandy, Amstrad, Toshiba, Compaq…, from VileR's Ultimate Oldschool PC Font Pack
- **Terminal & game fonts** (24): Terminus, Spleen, unscii, Cozette, GNU Unifont, ZX Spectrum, ProggyClean…
- **CC0 collection** (45): public-domain fonts from OpenGameArt: GrafX2 fonts, Kenney's KenPixel, Public Pixel, Boxy Bold, Tom Thumb…
- **OSD Fonts CC0 icon set**: every symbol and the logo drawn from scratch (`iconsets/make_cc0.py`), so CC0 letters + CC0 icons = a font that is public domain as a whole
- **Demoscene charsets** (42): C64 and Amiga-era fonts from old archives

The site has four pages:

| Page | What it does |
|---|---|
| **Browse** (`index.html`) | Every font on a simulated FPV feed. Filter by letter size, stroke weight, license and source (measured from the glyphs by `osdfont/traits.py`, no hand tagging); near-identical fonts share a card with "+N look-alikes"; download `.mcm` with Betaflight or CC0 icons |
| **Mix** (`mix.html`) | Letters from one font, symbols from an icon set, and the Betaflight logo or your own 288×72 image. **Pro** picks icons per group: battery, signal, horizon, arrows, units, bars. The mix lives in the URL, so links can be shared |
| **Editor** (`editor.html`) | Pixel editor for any `.mcm`/`.h`: pencil, line, rect, fill, shift, invert, copy/paste, undo, composition mode (edit several characters as one picture), tracing overlay, logo BMP import/export, autosave |
| **Install** (`install.html`) | Flashing with Configurator's Font Manager, or straight from the browser |

Mix and the editor can **upload to the flight controller** over Web Serial (Chrome/Edge desktop), the same way Betaflight Configurator does: `MSP_OSD_CHAR_WRITE` (87) per character, payload `[index, 54 bytes]`.

## How fonts are made
Only letters, digits and punctuation (0x20–0x5F, except 0x24) come from the retro font. Every symbol comes from an icon set.
Fonts with 8 px letters are doubled vertically (8×8 → 8×16); taller fonts (EGA 8×14, VGA 8×16) are used at native size. Every glyph gets a 1 px black outline and is centred in the 12×18 cell.

- **PC fonts** are read from the `.FON` files (`osdfont/fon.py`).
- **Terminal fonts** from `.bdf` (`osdfont/bdf.py`); pixel TTF/OTB fonts are rendered at the size where they have no grey pixels.
- **Sheets** (PNG/BMP) are sliced into cells. For multicolour sheets every brightness cutoff is tried and the one whose A–Z/0–9 best match the stock Betaflight letters wins (the "match" score on the site). This drops shadows, grids and gradients without per-font settings.

The browser builds every `.mcm` itself from the glyph data, so no generated font files are stored or hosted.

## Layout
```
fonts/catalog.toml     one [[font]] per font: source file, loader settings, license, author, shortlist
fonts/{pc,vault,cc0,demoscene}/   the source files
iconsets/*.mcm         Betaflight Configurator fonts (GPL-3.0) used as icon sets
iconsets/groups.toml   symbol groups for the mixer, from Betaflight's osd_symbols.h
osdfont/               Python converters (FON, BDF, pixel TTF, sheets) and .mcm I/O
build.py               catalog + icon sets -> site/data/*.json, site/f/<id>.html + previews, sitemap
site/                  static pages and ES modules (no bundler)
```

## Add a font
1. Put the file in `fonts/<collection>/`.
2. Add a `[[font]]` entry to `fonts/catalog.toml` (the header explains every key).
3. Run `uv run build.py`. It stops with a message if the font is too big for 12×18, has the same letters as an existing font, or reuses an id.

To add an icon set, drop a 256-character `.mcm` in `iconsets/` and add it to `iconsets/iconsets.toml`.

## Build and test
Needs Python 3.11+ with [uv](https://docs.astral.sh/uv/), and Node 20+.

```sh
uv run build.py                    # site/data, per-font pages, sitemap
python3 -m http.server -d site     # then open http://localhost:8000
uv run pytest -q                   # converters, catalog rules, symbol groups, Python/JS render fixture
npm ci && npm test                 # .mcm codec, mixing, logo, MSP framing
npx playwright install chromium
npm run test:browser               # drives every page in a real browser
```

`UPDATE_FIXTURES=1 uv run pytest` refreshes `tests/fixtures/render_cases.json` after a deliberate change to glyph placement. The JS tests use that fixture to check that the site renders exactly like `build.py`.

Pushing to `main` runs the tests, builds the site and deploys it to GitHub Pages (`.github/workflows/pages.yml`).

## License
Code: MIT. Fonts keep their own licenses (see `fonts/LICENSES.md`); Betaflight icon sets are GPL-3.0, the OSD Fonts CC0 icon set is public domain. Also by us: [Stickbeats](https://over9kfpv.github.io/stickbeats/), sound themes for EdgeTX radios.
