# Icon sets

An icon set is a complete 256-character font whose symbols (battery, RSSI, horizon, arrows…) and
boot logo the site mixes with any text font.

| Set | License | Where it comes from |
|---|---|---|
| `cc0.mcm` (OSD Fonts CC0) | **CC0 1.0**, public domain | Drawn from scratch by `make_cc0.py`: symbols from simple shapes, unit labels in Tom Thumb (CC0), letters and logo in Public Pixel (CC0). Only the slot numbers follow Betaflight's `osd_symbols.h`, so the firmware finds each icon where it expects it. |
| `kenney.mcm` (Kenney 1-Bit) | **CC0 1.0**, public domain | Built by `make_kenney.py` from [Kenney's 1-Bit Pack](https://kenney.nl/assets/1-bit-pack) (CC0): its 16x16 tiles cropped to the 12 px cell for letters, digits, battery hearts, house, SD card, chevrons and the logo. Slots with no fitting tile (units, bars, horizon, home arrows) keep the shapes from `make_cc0.py`. Credit to Kenney is optional but appreciated. |
| the other ten `.mcm` | GPL-3.0 | Fonts bundled with [Betaflight Configurator](https://github.com/betaflight/betaflight-configurator), `resources/osd/2/`, commit `7754ad4e9385a67dd302a084729c58152b6cadfe` |

A font made from CC0 letters and the CC0 set is public domain as a whole. A font that uses a
Betaflight set is a derivative of it and carries GPL-3.0 alongside the letters' license.

- `iconsets.toml` lists the sets shown on the site, with their licenses.
- `groups.toml` splits the 256 character codes into groups (battery, horizon, arrows, …) for the mixer.
- `make_kenney.py` rebuilds `kenney.mcm` and `kenney-preview.png` from `kenney/monochrome-transparent.png`: `uv run iconsets/make_kenney.py`.
- `make_cc0.py` rebuilds `cc0.mcm` and `cc0-preview.png`: `uv run iconsets/make_cc0.py`.
  A test checks the file is current and that no CC0 symbol equals any Betaflight glyph.

To add a set, drop a 256-character `.mcm` here and add an `[[iconset]]` entry with its license.
