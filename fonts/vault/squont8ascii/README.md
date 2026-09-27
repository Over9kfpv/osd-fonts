# Squont8ASCII

![Font grid](grid.png)

- Font name: Squont8ASCII
- Source URL: https://opengameart.org/content/squont8ascii
- License and exact licensing notes: CC-BY 4.0 on the OpenGameArt source page (author: pza_siliconf).
- Format type: bitmap sheet PNG
- Approximate glyph size: 8x8 cell
- Character coverage if known: ASCII-focused atlas; likely either 0-127 or printable ASCII within a larger 128-slot grid.
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: Slightly squarer, more game-HUD-like than the CAD-style sheets, but still suitable for low-stroke vector-style rendering. The source uses olive/green colors, while `grid.png` is a normalized `snatch` export.

## Preview generation

```bash
python3 tools/extract_sheet_grid.py \
  source/fonts/sheet_squont8ascii/squont8ascii.png \
  source/fonts/sheet_squont8ascii/grid.png \
  --cols 16 --rows 8 --start-index 32 \
  --foreground 214129 --background c5c242
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
- fore_color: `#214129`
- back_color: `#c5c242`
- likely_first_character_code: 32
- likely_last_character_code: 126
- alternatives: A 0-127 source layout is plausible, but the current extracted preview uses printable ASCII only.
- confidence: medium
- notes: `grid.png` was regenerated with `snatch` using `columns=16,rows=8,first_ascii=32,last_ascii=126,fore_color=#214129,back_color=#c5c242`, then exported as a standard black-on-white 16x6 grid.
