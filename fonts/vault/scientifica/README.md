# scientifica

![Font grid](grid.png)

- Font name: scientifica
- Source URL: https://github.com/oppiliappan/scientifica
- License and exact licensing notes: SIL OFL 1.1
- Format type: BDF
- Approximate glyph size: 6x12
- Character coverage if known: ASCII + extended Latin/Symbol
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: Narrow glyphs can feel cramped in long runs.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/scientifica/scientifica-11.bdf \
  source/fonts/scientifica/grid.png \
  --first 32 --last 126 --columns 16
```
