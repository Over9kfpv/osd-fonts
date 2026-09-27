# ProFont OTB

![Font grid](grid.png)

- Font name: ProFont OTB
- Source URL: https://tobiasjung.name/profont/
- License and exact licensing notes: MIT
- Format type: OTB
- Approximate glyph size: ~7x11
- Character coverage if known: ASCII + extended Latin
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 8
- Any caveats: Best rendered at intended pixel size.

## Preview generation

```bash
./tools/snatch-1.0.0-linux-x86_64/snatch \
  --plugin-dir ./tools/snatch-1.0.0-linux-x86_64/plugins \
  --extractor ttf_extractor \
  --extractor-parameters "input=source/fonts/profont/ProFontOTB.otb,first_ascii=32,last_ascii=126,font_size=11" \
  --exporter png \
  --exporter-parameters "output=source/fonts/profont/grid.png,columns=16,rows=6" 
```
