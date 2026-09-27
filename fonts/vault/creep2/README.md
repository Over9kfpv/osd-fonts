# Creep2

![Font grid](grid.png)

- Font name: Creep2
- Source URL: https://github.com/raymond-w-ko/creep2
- License and exact licensing notes: MIT
- Format type: BDF
- Approximate glyph size: 5x11
- Character coverage if known: ASCII + extended Latin/Symbol
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: Condensed letterforms reduce readability at tiny zoom.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/creep2/creep2-11.bdf \
  source/fonts/creep2/grid.png \
  --first 32 --last 126 --columns 16
```
