# Terminus ter-u16n

![Font grid](grid.png)

- Font name: Terminus ter-u16n
- Source URL: https://terminus-font.sourceforge.net/
- License and exact licensing notes: SIL OFL 1.1
- Format type: BDF
- Approximate glyph size: 8x16
- Character coverage if known: ASCII + extended
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: Designed for console density; punctuation is compact.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/terminus/ter-u16n.bdf \
  source/fonts/terminus/grid.png \
  --first 32 --last 126 --columns 16
```
