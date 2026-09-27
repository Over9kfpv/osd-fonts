# Cozette 1.8.1

![Font grid](grid.png)

- Font name: Cozette 1.8.1
- Source URL: https://github.com/slavfox/Cozette
- License and exact licensing notes: MIT
- Format type: BDF
- Approximate glyph size: 6x13
- Character coverage if known: ASCII + extended Unicode
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: Small-size punctuation can appear dense.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/cozette/cozette.bdf \
  source/fonts/cozette/grid.png \
  --first 32 --last 126 --columns 16
```
