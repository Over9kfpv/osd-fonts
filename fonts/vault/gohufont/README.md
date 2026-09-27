# Gohufont 2.1

![Font grid](grid.png)

- Font name: Gohufont 2.1
- Source URL: https://font.gohu.org/
- License and exact licensing notes: WTFPL v2
- Format type: BDF/PCF
- Approximate glyph size: 6x11
- Character coverage if known: ISO-8859-1 + extended variants
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: Very compact; some symbols are narrow.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/gohufont/gohufont-11.bdf \
  source/fonts/gohufont/grid.png \
  --first 32 --last 126 --columns 16
```
