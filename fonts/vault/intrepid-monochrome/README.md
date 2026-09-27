# Intrepid Monochrome 8-bit Font

![Font grid](grid.png)

- Font name: Intrepid Monochrome 8-bit Font
- Source URL: https://opengameart.org/content/intrepid-monochrome-8-bit-font
- License and exact licensing notes: CC0 on the OpenGameArt source page (author: Daniel Linssen / Managore).
- Format type: bitmap sheet PNG
- Approximate glyph size: 8x8 cell
- Character coverage if known: Printable ASCII is the most likely intended range; the atlas dimensions fit a 96-glyph layout.
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 7
- Any caveats: Slightly more game-UI flavored than a strict workstation terminal face, but still clean and low-noise.

## Preview generation

```bash
python3 tools/extract_sheet_grid.py \
  source/fonts/sheet_intrepid_monochrome/intrepid.png \
  source/fonts/sheet_intrepid_monochrome/grid.png \
  --cols 16 --rows 6 --start-index 32 \
  --foreground 000000 --background ffffff
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
- rows: 6
- inverse: 0
- fore_color: `#000000`
- back_color: `#ffffff`
- likely_first_character_code: 32
- likely_last_character_code: 126
- confidence: high
- notes: `grid.png` was regenerated with `snatch` using `columns=16,rows=6,first_ascii=32,last_ascii=126,fore_color=#000000,back_color=#ffffff`, then exported as a standard black-on-white 16x6 grid.
