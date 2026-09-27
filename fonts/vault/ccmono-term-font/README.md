# CCMono Term Font Bitmap Sheet

![Font grid](grid.png)

- Font name: CCMono term_font sheet
- Source URL: https://github.com/yyny/ccmono
- License and exact licensing notes: MIT License in repository (`LICENSE`). Upstream README says `term_font.bmp` is generated from ComputerCraft `term_font.png`.
- Format type: bitmap sheet BMP (with PNG grid preview)
- Approximate glyph size: likely 6x9 glyph inside 8x11 cell
- Character coverage if known: Intended for ISO-8859-1 / Latin-1 mapping in repository scripts; ASCII included.
- Whether it is monospaced: Yes (generated PCF outputs are fixed-width).
- stroke-efficiency (1-10): 8
- Any caveats: Source bitmap is derivative from ComputerCraft terminal font workflow; verify downstream attribution requirements if redistributing generated derivative fonts beyond this repository workflow.

## Preview generation

```bash
# Convert the BMP to PNG if required, then extract with snatch.
./tools/snatch-1.0.0-linux-x86_64/snatch \
  --plugin-dir ./tools/snatch-1.0.0-linux-x86_64/plugins \
  --extractor image_extractor \
  --extractor-parameters "input=source/fonts/ccmono_term_font/term_font.bmp,columns=16,rows=16,first_ascii=32,last_ascii=126,inverse=1" \
  --exporter png \
  --exporter-parameters "output=source/fonts/ccmono_term_font/grid.png,columns=16,rows=6" 
```

## Extraction assumptions

- glyph_cell_width: 8
- glyph_cell_height: 11
- left_margin: 0
- right_margin: 0
- top_margin: 0
- bottom_margin: 0
- horizontal_padding: 1 (inferred from script usage)
- vertical_padding: 1 (inferred from script usage)
- columns: 16
- rows: 16
- inverse: 1
- likely_first_character_code: 0
- likely_last_character_code: 255
- confidence: medium
- notes: `snatch image_extractor` cannot open this BMP directly; convert BMP to PNG first, then extract with `columns=16,rows=16,inverse=1`. Source image dimensions are 128x176. Upstream generation command (`bmp2pcf.lua`) indicates `--width 16`, `--padright 1`, `--padbottom 1` and produces `6x9`/`12x18` PCF outputs.
