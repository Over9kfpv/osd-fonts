# 16x12 Terminal Bitmap Font

![Font grid](grid.png)

- Font name: 16x12 Terminal Bitmap Font
- Source URL: https://opengameart.org/content/16x12-terminal-bitmap-font
- License and exact licensing notes: CC0 on the OpenGameArt source page (author: Clint Bellanger).
- Format type: bitmap sheet PNG
- Approximate glyph size: 12x16 cells in the downloadable PNG atlas
- Character coverage if known: ASCII plus box-drawing or terminal-adjacent symbols appear to be present.
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: The page title reflects a 16-column by 12-pixel-wide layout, but the published PNG is actually a `16x6` atlas with `12x16` cells. `grid.png` is a normalized export generated from the full inverse bitmap sheet with the repository's custom extractor.

## Preview generation

```bash
python3 tools/extract_sheet_grid.py \
  source/fonts/sheet_terminal_16x12/pixfont.png \
  source/fonts/sheet_terminal_16x12/grid.png \
  --cols 16 --rows 6 --start-index 0 \
  --foreground ffffff --background 000000
```

## Extraction assumptions

- glyph_cell_width: 12
- glyph_cell_height: 16
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
- back_color: `#000000`
- likely_first_character_code: 32
- likely_last_character_code: 126
- confidence: high
- notes: `grid.png` is generated from the full inverse bitmap sheet with `columns=16,rows=6,start_index=0` and no cropping. The previous broken preview came from using the wrong row count (`8`), which split the 16-pixel-high glyph cells.
