// Turning catalog fonts and icon sets into full 256-glyph fonts.
// Mirrors osdfont/glyphs.py (render, build_font) so the site and build.py agree pixel for pixel.

import { BLACK, CH, CW, GLYPHS, PIXELS, TRANSPARENT, WHITE, unpackGlyph } from "./mcm.js"

export const TEXT_CODES = []
for (let c = 0x20; c < 0x60; c++) if (c !== 0x24) TEXT_CODES.push(c)

/** Edge effects for letters. The OSD only has black, white and transparent, so an effect is
 *  an edge drawn in the opposite colour of the letters: all around, as a drop shadow, or as a bevel. */
export const EFFECT_STYLES = ["outline", "shadow", "bevel", "none"]
export const DIRECTIONS = { nw: [-1, -1], n: [0, -1], ne: [1, -1], w: [-1, 0], e: [1, 0], sw: [-1, 1], s: [0, 1], se: [1, 1] }
export const DEFAULT_EFFECT = { style: "outline", dir: "se", invert: false }

export function normalizeEffect(e = {}) {
  return {
    style: EFFECT_STYLES.includes(e.style) ? e.style : "outline",
    dir: DIRECTIONS[e.dir] ? e.dir : "se",
    invert: !!e.invert,
  }
}

/** Offsets (dx, dy) whose shifted copies of the letter make up its edge. */
function edgeOffsets({ style, dir }) {
  const [dx, dy] = DIRECTIONS[dir]
  const out = []
  if (style === "outline" || style === "bevel") {
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (x || y) out.push([x, y])
  }
  if (style === "shadow") {
    out.push([dx, dy])
    if (dx && dy) out.push([dx, 0], [0, dy]) // fill the corner steps of a diagonal shadow
  }
  if (style === "bevel") {
    for (const k of [1, 2]) {
      out.push([dx * k, dy * k])
      if (dx && dy) out.push([dx * k, dy * (k - 1)], [dx * (k - 1), dy * k])
    }
  }
  return out
}

/**
 * Raw glyph rows ("0101…" strings) → 12x18 cell: optional 2x vertical, centred together with its
 * edge. The default (white letters, 1 px black outline) matches osdfont.glyphs.render exactly.
 */
export function renderGlyph(rows, mode = "small", effect = DEFAULT_EFFECT) {
  const fx = normalizeEffect(effect)
  let g = rows.map((r) => Array.from(r, (c) => c === "1"))
  if (mode === "tall" && g.length * 2 + 2 <= CH) g = g.flatMap((r) => [r, r])
  const h = g.length
  const w = g[0].length
  const offsets = edgeOffsets(fx)
  // room the edge needs on each side, so letter + edge are centred as one block
  const pad = { l: 0, r: 0, t: 0, b: 0 }
  for (const [x, y] of offsets) {
    pad.l = Math.max(pad.l, -x)
    pad.r = Math.max(pad.r, x)
    pad.t = Math.max(pad.t, -y)
    pad.b = Math.max(pad.b, y)
  }
  const oy = ((CH - (h + pad.t + pad.b)) >> 1) + pad.t
  const ox = ((CW - (w + pad.l + pad.r)) >> 1) + pad.l
  const fg = new Uint8Array(PIXELS)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const yy = y + oy
      const xx = x + ox
      if (g[y][x] && yy >= 0 && yy < CH && xx >= 0 && xx < CW) fg[yy * CW + xx] = 1
    }
  }
  const face = fx.invert ? BLACK : WHITE
  const edge = fx.invert ? WHITE : BLACK
  const cell = new Uint8Array(PIXELS).fill(TRANSPARENT)
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x
      if (fg[i]) {
        cell[i] = face
        continue
      }
      for (const [dx, dy] of offsets) {
        const sy = y - dy
        const sx = x - dx
        if (sy >= 0 && sy < CH && sx >= 0 && sx < CW && fg[sy * CW + sx]) {
          cell[i] = edge
          break
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
export function compose(data, { font = null, mode = "small", base = "default", sources = {}, logo = null, effect = DEFAULT_EFFECT }) {
  const baseSet = data.iconsetById.get(base) ?? data.iconsets[0]
  const out = baseSet.glyphs.map((g) => g.slice())
  for (const g of data.groups) {
    const set = data.iconsetById.get(sources[g.id])
    if (!set || g.id === "text") continue
    for (const c of g.codes) out[c] = set.glyphs[c].slice()
  }
  const textSet = data.iconsetById.get(sources.text)
  if (textSet) for (const c of TEXT_CODES) out[c] = textSet.glyphs[c].slice()
  if (font) for (const c of TEXT_CODES) if (font.glyphs[c]) out[c] = renderGlyph(font.glyphs[c], mode, effect)
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

/** Public-domain licenses: a font made only from these is public domain as a whole. */
export const isPublicDomain = (license) => /^(CC0|Public domain)/i.test(license || "")

/**
 * License of a composed font, from the text font and every icon set it draws on.
 * Returns { publicDomain, text } where text is a sentence for the page.
 */
export function licenseSummary(data, { font = null, base = "default", sources = {}, logo = null }) {
  const used = new Set([base])
  for (const [group, id] of Object.entries(sources)) if (id && !(group === "logo" && logo)) used.add(id)
  const sets = [...used].map((id) => data.iconsetById.get(id)).filter(Boolean)
  const iconsPD = sets.every((s) => isPublicDomain(s.license))
  const textPD = font ? isPublicDomain(font.license) : iconsPD
  const letters = font ? `Letters: ${font.name}, ${font.license}${font.author ? ` (${font.author})` : ""}.` : ""
  const icons = sets.map((s) => `${s.name} (${s.license})`).join(", ")
  if (iconsPD && textPD) {
    return {
      publicDomain: true,
      text: `This whole font is public domain (CC0): ${font ? font.name + " letters, " : ""}${sets.map((s) => s.name).join(" + ")} icons${logo ? " and your own logo" : " and logo"}. Use it for anything, no credit needed.`,
    }
  }
  return { publicDomain: false, text: `${letters} Icons${logo ? "" : " and logo"}: ${icons}.`.trim() }
}

export const fileName = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "osd-font"
