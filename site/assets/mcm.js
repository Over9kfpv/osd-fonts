// MAX7456 font codec. A font is an array of 256 glyphs; a glyph is a Uint8Array(216),
// row-major 12x18, one value per pixel: 0 = black, 1 = transparent, 2 = white.

export const CW = 12
export const CH = 18
export const PIXELS = CW * CH
export const GLYPHS = 256
export const BLACK = 0
export const TRANSPARENT = 1
export const WHITE = 2
const BYTES = 54 // 18 rows x 3 bytes of 4 pixels
const FIELD = 64 // .mcm pads each character to 64 bytes

export const emptyGlyph = () => new Uint8Array(PIXELS).fill(TRANSPARENT)
export const emptyFont = () => Array.from({ length: GLYPHS }, emptyGlyph)
export const cloneFont = (font) => font.map((g) => g.slice())

/** Pixel pairs 00 black, 10 white, 01/11 transparent. */
const fromBits = (b) => (b === 0 ? BLACK : b === 2 ? WHITE : TRANSPARENT)
const toBits = (v) => (v === BLACK ? 0 : v === WHITE ? 2 : 1)

export function glyphToBytes(glyph) {
  const out = new Uint8Array(BYTES)
  for (let i = 0; i < BYTES; i++) {
    const p = i * 4
    out[i] = (toBits(glyph[p]) << 6) | (toBits(glyph[p + 1]) << 4) | (toBits(glyph[p + 2]) << 2) | toBits(glyph[p + 3])
  }
  return out
}

export function bytesToGlyph(bytes, offset = 0) {
  const g = new Uint8Array(PIXELS)
  for (let i = 0; i < BYTES; i++) {
    const b = bytes[offset + i]
    g[i * 4] = fromBits((b >> 6) & 3)
    g[i * 4 + 1] = fromBits((b >> 4) & 3)
    g[i * 4 + 2] = fromBits((b >> 2) & 3)
    g[i * 4 + 3] = fromBits(b & 3)
  }
  return g
}

/** Raw font bytes, 54 (as sent to the flight controller) or 64 (as stored in .mcm) per glyph. */
export function fontToBytes(font, stride = BYTES) {
  const out = new Uint8Array(GLYPHS * stride)
  font.forEach((g, i) => out.set(glyphToBytes(g), i * stride))
  if (stride === FIELD) for (let i = 0; i < GLYPHS; i++) out.fill(0x55, i * FIELD + BYTES, (i + 1) * FIELD)
  return out
}

export function bytesToFont(bytes) {
  const stride = bytes.length / GLYPHS
  if (stride !== BYTES && stride !== FIELD) {
    throw new Error(`Expected ${GLYPHS * BYTES} or ${GLYPHS * FIELD} bytes, got ${bytes.length}.`)
  }
  return Array.from({ length: GLYPHS }, (_, i) => bytesToGlyph(bytes, i * stride))
}

/** Parse .mcm text: "MAX7456" then one byte per line as 8 binary digits. */
export function parseMCM(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!/^MAX7456$/i.test(lines[0] || "")) throw new Error("Not a MAX7456 .mcm file (first line should be MAX7456).")
  const bytes = []
  for (const l of lines.slice(1)) {
    if (!/^[01]{8}$/.test(l)) throw new Error(`Unexpected line in .mcm: "${l.slice(0, 20)}"`)
    bytes.push(parseInt(l, 2))
  }
  return bytesToFont(Uint8Array.from(bytes))
}

/** Same layout as the fonts shipped with Betaflight Configurator: LF lines, padding bytes 01010101. */
export function serializeMCM(font) {
  const bytes = fontToBytes(font, FIELD)
  const lines = ["MAX7456"]
  for (const b of bytes) lines.push(b.toString(2).padStart(8, "0"))
  return lines.join("\n") + "\n"
}

/** Parse a C header containing the byte array (0x.. or decimal values). */
export function parseH(text) {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end < start) throw new Error("No { ... } byte array found in the header file.")
  const nums = text
    .slice(start + 1, end)
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => Number(t))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error("The byte array contains values that are not bytes.")
  return bytesToFont(Uint8Array.from(nums))
}

export function serializeH(font, name = "font") {
  const bytes = fontToBytes(font, FIELD)
  const id = name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]/g, "_") || "font"
  let out = `// MAX7456 OSD font, 256 glyphs of 12x18, 64 bytes per glyph (54 used).\n`
  out += `// Made with OSD Fonts: https://over9kfpv.github.io/osd-fonts/\n\n#pragma once\n\n`
  out += `const unsigned char ${id}[${bytes.length}] = {\n`
  for (let i = 0; i < bytes.length; i += 16) {
    const row = Array.from(bytes.slice(i, i + 16), (b) => "0x" + b.toString(16).padStart(2, "0"))
    out += "  " + row.join(", ") + (i + 16 < bytes.length ? ",\n" : "\n")
  }
  return out + "};\n"
}

/** Glyphs as shipped in data/iconsets.json: 216 digits per glyph. */
export const unpackGlyph = (s) => Uint8Array.from(s, (c) => +c)

/** Offer a file to the user. */
export function download(name, data, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = Object.assign(document.createElement("a"), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
