// Turning catalog fonts and icon sets into full 256-glyph fonts.
// Mirrors osdfont/glyphs.py (render, build_font) so the site and build.py agree pixel for pixel.

import { BLACK, CH, CW, GLYPHS, PIXELS, TRANSPARENT, WHITE, unpackGlyph } from "./mcm.js"

export const TEXT_CODES = []
for (let c = 0x20; c < 0x60; c++) if (c !== 0x24) TEXT_CODES.push(c)

/** Raw glyph rows ("0101…" strings) → 12x18 cell: optional 2x vertical, centred, 1 px black outline. */
export function renderGlyph(rows, mode = "small") {
  let g = rows.map((r) => Array.from(r, (c) => c === "1"))
  if (mode === "tall" && g.length * 2 + 2 <= CH) g = g.flatMap((r) => [r, r])
  const h = g.length
  const w = g[0].length
  const oy = (CH - h) >> 1
  const ox = (CW - w) >> 1
  const fg = new Uint8Array(PIXELS)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x]) fg[(y + oy) * CW + x + ox] = 1
  const cell = new Uint8Array(PIXELS).fill(TRANSPARENT)
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x
      if (fg[i]) {
        cell[i] = WHITE
        continue
      }
      for (let dy = -1; dy <= 1 && cell[i] !== BLACK; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          // same wrap-around as numpy.roll in the Python build
          const yy = (y + dy + CH) % CH
          const xx = (x + dx + CW) % CW
          if (fg[yy * CW + xx]) {
            cell[i] = BLACK
            break
          }
        }
      }
    }
  }
  return cell
}

/** Load the site data once. */
let dataPromise
export function loadData(base = "") {
  dataPromise ??= Promise.all([
    fetch(base + "data/fonts.json").then((r) => r.json()),
    fetch(base + "data/iconsets.json").then((r) => r.json()),
  ]).then(([f, i]) => indexData(f, i))
  return dataPromise
}

export function indexData(fontData, iconData) {
  const iconsets = iconData.iconsets.map((s) => ({ ...s, glyphs: s.glyphs.map(unpackGlyph) }))
  const groups = iconData.groups
  const groupOf = new Array(GLYPHS)
  for (const g of groups) for (const c of g.codes) groupOf[c] = g.id
  return {
    collections: fontData.collections,
    fonts: fontData.fonts,
    fontById: new Map(fontData.fonts.map((f) => [f.id, f])),
    iconsets,
    iconsetById: new Map(iconsets.map((s) => [s.id, s])),
    groups,
    groupOf,
    iconLicense: iconData.license,
  }
}

/**
 * Compose a font.
 *   font       catalog font (or null to keep the icon set's own text)
 *   mode       "small" (1:1 centred, the default) | "tall" (2x high; 8 px fonts only, taller fonts are always native)
 *   sources    { groupId: iconsetId } — groups not listed use `base`
 *   base       icon set id used for everything else, and for text characters the font lacks
 *   logo       optional array of 96 glyphs for 0xA0-0xFF (a custom logo)
 */
export function compose(data, { font = null, mode = "small", base = "default", sources = {}, logo = null }) {
  const baseSet = data.iconsetById.get(base) ?? data.iconsets[0]
  const out = baseSet.glyphs.map((g) => g.slice())
  for (const g of data.groups) {
    const set = data.iconsetById.get(sources[g.id])
    if (!set || g.id === "text") continue
    for (const c of g.codes) out[c] = set.glyphs[c].slice()
  }
  const textSet = data.iconsetById.get(sources.text)
  if (textSet) for (const c of TEXT_CODES) out[c] = textSet.glyphs[c].slice()
  if (font) for (const c of TEXT_CODES) if (font.glyphs[c]) out[c] = renderGlyph(font.glyphs[c], mode)
  if (logo) logo.forEach((g, i) => (out[0xa0 + i] = g.slice()))
  return out
}

/** Where each character of a composed font came from, for the character sheet. */
export function provenance(data, { font = null, base = "default", sources = {}, logo = null }) {
  const name = (id) => data.iconsetById.get(id)?.name
  return Array.from({ length: GLYPHS }, (_, c) => {
    const group = data.groupOf[c]
    if (group === "logo" && logo) return "Custom logo"
    if (group === "text" && font?.glyphs[c]) return font.name
    if (group === "text" && sources.text) return name(sources.text)
    return name(sources[group]) ?? name(base)
  })
}

export const fileName = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "osd-font"
