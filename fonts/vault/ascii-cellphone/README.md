# ASCII Bitmap Font "cellphone"

![Font grid](grid.png)

- Font name: ASCII Bitmap Font "cellphone"
- Source URL: https://opengameart.org/content/ascii-bitmap-font-cellphone
- License and exact licensing notes: CC-BY 4.0 on the OpenGameArt source page (author: domsson).
- Format type: bitmap sheet PNG
- Approximate glyph size: 5x7 glyphs in an 8x8 cell
- Character coverage if known: ASCII-oriented sheet; printable ASCII is visibly present. Likely either a 0-127 or 32-127 mapping.
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: The handset-inspired forms are slightly less terminal-neutral than the oldschool and futuristic variants. `grid.png` is a normalized `snatch` export, not the raw source atlas.

## Preview generation

```bash
python3 tools/extract_sheet_grid.py \
  source/fonts/sheet_ascii_cellphone/charmap-cellphone_white.png \
  source/fonts/sheet_ascii_cellphone/grid.png \
  --cols 16 --rows 8 --start-index 0 \
  --foreground ffffff --background 000000
```

## Extraction assumptions

- glyph_cell_width: 8
- glyph_cell_height: 8
- left_margin: 0
- right_margin: 0
- top_margin: 0
- bottom_margin: 0
- horizontal_padding: 0
- vertical_padding: 0
- columns: 16
- rows: 8
- inverse: 0
- fore_color: `#ffffff`
- back_color: `#000000`
- likely_first_character_code: 32
- likely_last_character_code: 126
- alternatives: A 0-127 source layout is plausible, but the current extracted preview uses printable ASCII only.
- confidence: medium
- notes: `grid.png` was regenerated with `snatch` using `columns=16,rows=8,first_ascii=32,last_ascii=126,fore_color=#ffffff,back_color=#000000`, then exported as a standard black-on-white 16x6 grid.
