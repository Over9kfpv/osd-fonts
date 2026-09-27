# Spleen 8x16

![Font grid](grid.png)

- Font name: Spleen 8x16
- Source URL: https://github.com/fcambus/spleen
- License and exact licensing notes: BSD-2-Clause
- Format type: BDF
- Approximate glyph size: 8x16
- Character coverage if known: ASCII + extended Unicode
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 7
- Any caveats: Strong pixel personality; heavier than ultra-thin terminal fonts.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/spleen/spleen-8x16.bdf \
  source/fonts/spleen/grid.png \
  --first 32 --last 126 --columns 16
```
