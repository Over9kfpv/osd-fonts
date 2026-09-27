# Proggy Clean

![Font grid](grid.png)

- Font name: Proggy Clean
- Source URL: https://github.com/bluescan/proggyfonts
- License and exact licensing notes: MIT
- Format type: TTF (bitmap-strike style)
- Approximate glyph size: ~7x12 at 12ppem
- Character coverage if known: Latin-1 + variants
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: Use fixed point size; scaling can blur stems.

## Preview generation

```bash
./tools/snatch-1.0.0-linux-x86_64/snatch \
  --plugin-dir ./tools/snatch-1.0.0-linux-x86_64/plugins \
  --extractor ttf_extractor \
  --extractor-parameters "input=source/fonts/proggy_clean/ProggyClean.ttf,first_ascii=32,last_ascii=126,font_size=12" \
  --exporter png \
  --exporter-parameters "output=source/fonts/proggy_clean/grid.png,columns=16,rows=6" 
```
