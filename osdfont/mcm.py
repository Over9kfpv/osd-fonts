"""MAX7456 .mcm fonts: 256 characters of 12x18 pixels, 2 bits per pixel.

Pixel values follow the chip: 0 = black, 1 = transparent, 2 = white (3 is read as transparent).
"""
import numpy as np

CW, CH = 12, 18
GLYPHS = 256
BLACK, TRANSPARENT, WHITE = 0, 1, 2
BYTES_PER_CHAR = 54  # 18 rows x 3 bytes
FIELD_SIZE = 64  # .mcm pads every character to 64 bytes


def read_mcm(path):
    """Return a list of 256 uint8 arrays (18, 12)."""
    lines = open(path).read().split()
    if lines[0] != "MAX7456":
        raise ValueError(f"{path}: not a MAX7456 font")
    data = lines[1:]
    if len(data) != GLYPHS * FIELD_SIZE:
        raise ValueError(f"{path}: expected {GLYPHS * FIELD_SIZE} bytes, got {len(data)}")
    chars = []
    for c in range(GLYPHS):
        bits = "".join(data[c * FIELD_SIZE:c * FIELD_SIZE + BYTES_PER_CHAR])
        px = np.array([int(bits[i:i + 2], 2) for i in range(0, CW * CH * 2, 2)], np.uint8)
        px[px == 3] = TRANSPARENT
        chars.append(px.reshape(CH, CW))
    return chars


def mcm_text(chars):
    out = ["MAX7456"]
    for c in chars:
        bits = "".join(f"{v:02b}" for v in c.ravel())
        out += [bits[i:i + 8] for i in range(0, CW * CH * 2, 8)]
        out += ["01010101"] * (FIELD_SIZE - BYTES_PER_CHAR)
    return "\n".join(out) + "\n"  # LF, like the fonts shipped with Betaflight Configurator


def write_mcm(chars, path):
    with open(path, "w", newline="") as f:
        f.write(mcm_text(chars))


def pack(chars):
    """Compact string form for the website: one digit (0/1/2) per pixel, 216 per glyph."""
    return ["".join(str(int(v)) for v in c.ravel()) for c in chars]
