# Tamzen 6x12r (Tamsyn lineage)

![Font grid](grid.png)

- Font name: Tamzen 6x12r (Tamsyn lineage)
- Source URL: http://www.fial.com/~scott/tamsyn-font/
- License and exact licensing notes: Permissive custom free license (as distributed)
- Format type: BDF
- Approximate glyph size: 6x12
- Character coverage if known: ASCII + extended
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: Some diagonal strokes appear stepped at small size.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/tamsyn/Tamzen6x12r.bdf \
  source/fonts/tamsyn/grid.png \
  --first 32 --last 126 --columns 16
```
