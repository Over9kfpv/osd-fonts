# Pixel Font (Basic Latin, Latin-1, Box Drawing)

![Font grid](grid.png)

- Font name: Pixel Font (Basic Latin, Latin-1, Box Drawing)
- Source URL: https://opengameart.org/content/pixel-font-basic-latin-latin-1-box-drawing
- License and exact licensing notes: CC0 on the OpenGameArt source page (author: Clint Bellanger).
- Format type: bitmap sheet PNG
- Approximate glyph size: 7x9
- Character coverage if known: The selected `pixel_font_basic_latin_ascii.png` sheet appears to target printable ASCII 32-126.
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: The page title references broader coverage, but this specific downloadable PNG is an ASCII-focused sheet. The source uses transparency, while `grid.png` is a normalized `snatch` export.

## Preview generation

```bash
python3 tools/extract_sheet_grid.py \
  source/fonts/sheet_pixel_font_basic_latin/pixel_font_basic_latin_ascii.png \
  source/fonts/sheet_pixel_font_basic_latin/grid.png \
  --cols 16 --rows 6 --start-index 32 \
  --foreground ffffff
```

## Extraction assumptions

- glyph_cell_width: 7
- glyph_cell_height: 9
- left_margin: 0
- right_margin: 0
- top_margin: 0
- bottom_margin: 0
- horizontal_padding: 0
- vertical_padding: 0
- columns: 16
- rows: 6
- inverse: 0
- fore_color: `#ffffff`
- likely_first_character_code: 32
- likely_last_character_code: 126
- confidence: high
- notes: `grid.png` was regenerated with `snatch` using `columns=16,rows=6,first_ascii=32,last_ascii=126,fore_color=#ffffff`, then exported as a standard black-on-white 16x6 grid.
