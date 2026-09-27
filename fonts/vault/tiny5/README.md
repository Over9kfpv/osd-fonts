# font_tiny5

![Font grid](grid.png)

- Font name: font_tiny5
- Source URL: https://github.com/olikraus/u8g2/blob/master/tools/font/bdf/font_tiny5.bdf
- License and exact licensing notes: CC0 1.0 (declared in BDF metadata)
- Format type: BDF
- Approximate glyph size: 7x7
- Character coverage if known: 256 chars; ASCII present
- Whether it is monospaced: No
- stroke-efficiency (1-10): 7
- Any caveats: Variable width behavior; tiny glyphs can merge visually.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/tiny5/font_tiny5.bdf \
  source/fonts/tiny5/grid.png \
  --first 32 --last 126 --columns 16
```
