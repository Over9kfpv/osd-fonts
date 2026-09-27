# unscii-8

![Font grid](grid.png)

- Font name: unscii-8
- Source URL: https://github.com/viznut/unscii
- License and exact licensing notes: Public domain (main unscii variants)
- Format type: TTF
- Approximate glyph size: 8x8
- Character coverage if known: ASCII + large symbol/unicode coverage
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 9
- Any caveats: Variant family has differing stroke weight; this folder keeps one representative file.

## Preview generation

```bash
./tools/snatch-1.0.0-linux-x86_64/snatch \
  --plugin-dir ./tools/snatch-1.0.0-linux-x86_64/plugins \
  --extractor ttf_extractor \
  --extractor-parameters "input=source/fonts/unscii/unscii-8.ttf,first_ascii=32,last_ascii=126,font_size=8" \
  --exporter png \
  --exporter-parameters "output=source/fonts/unscii/grid.png,columns=16,rows=6" 
```
