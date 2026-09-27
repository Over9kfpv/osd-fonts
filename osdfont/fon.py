"""Minimal reader for Windows .FON bitmap fonts (NE executable with FNT v2/v3 resources)."""
import struct

import numpy as np

RT_FONT = 0x8008


def read_fon(path):
    """Return a list of fonts, each {name, w, h, glyphs: {code: bool array (h, w)}}."""
    data = open(path, "rb").read()
    ne = struct.unpack_from("<I", data, 0x3C)[0]
    assert data[ne:ne + 2] == b"NE", "not an NE executable"
    rt = ne + struct.unpack_from("<H", data, ne + 0x24)[0]
    shift = struct.unpack_from("<H", data, rt)[0]
    pos, fonts = rt + 2, []
    while True:
        type_id, count = struct.unpack_from("<HH", data, pos)
        if type_id == 0:
            break
        pos += 8
        for _ in range(count):
            offset, length = struct.unpack_from("<HH", data, pos)
            pos += 12
            if type_id == RT_FONT:
                fonts.append(read_fnt(data[offset << shift:(offset + length) << shift]))
    return fonts


def read_fnt(fnt):
    version = struct.unpack_from("<H", fnt, 0)[0]
    height = struct.unpack_from("<H", fnt, 88)[0]
    first, last = fnt[95], fnt[96]
    face = fnt[struct.unpack_from("<I", fnt, 105)[0]:].split(b"\0")[0].decode("latin-1")
    table, entry = (148, 6) if version == 0x300 else (118, 4)
    glyphs, max_w = {}, 0
    for i in range(last - first + 1):
        if version == 0x300:
            w, off = struct.unpack_from("<HI", fnt, table + i * entry)
        else:
            w, off = struct.unpack_from("<HH", fnt, table + i * entry)
        # bitmap is stored in byte-wide columns, each column `height` bytes top to bottom
        cols = (w + 7) // 8
        raw = np.frombuffer(fnt, np.uint8, cols * height, off).reshape(cols, height)
        g = np.unpackbits(raw.T[:, :, None], axis=2).reshape(height, cols * 8)[:, :w].astype(bool)
        glyphs[first + i] = g
        max_w = max(max_w, w)
    return dict(name=face, w=max_w, h=height, glyphs=glyphs)
