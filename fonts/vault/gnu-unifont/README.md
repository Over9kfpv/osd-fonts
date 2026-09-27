# GNU Unifont 17.0.03

![Font grid](grid.png)

- Font name: GNU Unifont 17.0.03
- Source URL: https://unifoundry.com/unifont/
- License and exact licensing notes: GPL-2.0-or-later with font embedding exception
- Format type: BDF
- Approximate glyph size: 8x16
- Character coverage if known: Full BMP Unicode; ASCII present
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 6
- Any caveats: Large Unicode-oriented set; non-ASCII shapes vary by block.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/gnu_unifont/unifont-17.0.03.bdf \
  source/fonts/gnu_unifont/grid.png \
  --first 32 --last 126 --columns 16
```

## Subset in osd-fonts
The BDF here was reduced to code points 0–255 (from the full 17.0.03 release) to keep the repository small; the glyphs themselves are unchanged. Only ASCII 0x20–0x5F is used for OSD fonts.
