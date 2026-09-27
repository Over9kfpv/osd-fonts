# X11 UCS 6x13

![Font grid](grid.png)

- Font name: X11 UCS 6x13
- Source URL: https://www.cl.cam.ac.uk/~mgk25/ucs-fonts.html
- License and exact licensing notes: Public domain / permissive X11
- Format type: BDF
- Approximate glyph size: 6x13
- Character coverage if known: Large UCS coverage; ASCII present
- Whether it is monospaced: Yes
- stroke-efficiency (1-10): 7
- Any caveats: Older X11 style, less stylized than modern pixel fonts.

## Preview generation

```bash
python3 tools/bdf_to_png.py \
  source/fonts/ucs_fonts/6x13.bdf \
  source/fonts/ucs_fonts/grid.png \
  --first 32 --last 126 --columns 16
```
