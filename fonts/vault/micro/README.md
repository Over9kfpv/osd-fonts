# micro

![Font grid](grid.png)

- Font name: micro
- Source URL: https://github.com/olikraus/u8g2/blob/master/tools/font/bdf/micro.bdf
- License and exact licensing notes: Public domain (declared in BDF metadata)
- Format type: BDF
- Approximate glyph size: 4x5
- Character coverage if known: 128 chars; ASCII present
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 9
- Any caveats: Extremely small glyphs; limited readability for long text.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/micro/micro.bdf \
  source/fonts/micro/grid.png \
  --first 32 --last 126 --columns 16
```
