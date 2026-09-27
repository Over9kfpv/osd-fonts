# Monocraft Bitmap ASCII Sheet

![Font grid](grid.png)

- Font name: Monocraft Bitmap ASCII Sheet
- Source URL: https://github.com/Andre601/Monocraft-Bitmap
- License and exact licensing notes: Repository is MIT licensed (`LICENSE`), and includes upstream Monocraft OFL text separately. This selected sheet file is distributed in that MIT-licensed bitmap-pack repository.
- Format type: bitmap sheet PNG
- Approximate glyph size: 8x8 cell
- Character coverage if known: ASCII 32-126 explicitly mapped in provider JSON; additional CP437-like symbols present.
- Whether it is monospaced: Mostly yes (sheet design is fixed-cell; README notes small practical spacing caveats in Minecraft rendering).
- stroke-efficiency (1-10): 8
- Any caveats: Some characters in Minecraft rendering rely on transparency padding tricks for monospacing.

## Preview generation

```bash
./tools/snatch-1.0.0-linux-x86_64/snatch \
  --plugin-dir ./tools/snatch-1.0.0-linux-x86_64/plugins \
  --extractor image_extractor \
  --extractor-parameters "input=source/fonts/monocraft_ascii/ascii.png,columns=16,rows=14,margins_top=16,first_ascii=32,last_ascii=126,inverse=1" \
  --exporter png \
  --exporter-parameters "output=source/fonts/monocraft_ascii/grid.png,columns=16,rows=6" 
```

## Extraction assumptions

- glyph_cell_width: 8
- glyph_cell_height: 8
- left_margin: 0
- right_margin: 0
- top_margin: 16
- bottom_margin: 0
- horizontal_padding: 0
- vertical_padding: 0
- columns: 16
- rows: 14 (after cropping top margin)
- inverse: 1
- likely_first_character_code: 32
- likely_last_character_code: 255
- preferred_ascii_range: 32-126
- confidence: high
- notes: `snatch image_extractor` needs `inverse=1`. Also crop top blank area first (`crop=128x112+0+16`), then extract with `columns=16,rows=14`.
