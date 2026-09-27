import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { TEXT_CODES, compose, indexData, licenseSummary, provenance, renderGlyph } from "../../site/assets/compose.js"
import { BLACK } from "../../site/assets/mcm.js"
import { LOGO, logoToBMP, rgbaToLogo } from "../../site/assets/logo.js"
import {
  GLYPHS, TRANSPARENT, WHITE, bytesToFont, emptyFont, fontToBytes, parseH, parseMCM, serializeH, serializeMCM,
} from "../../site/assets/mcm.js"
import { MSP_OSD_CHAR_WRITE, MspParser, encodeMsp } from "../../site/assets/msp.js"
globalThis.matchMedia ??= () => ({ matches: false })
const { osdLabel } = await import("../../site/assets/osd-demo.js")

const root = new URL("../../", import.meta.url)
const read = (p) => readFileSync(new URL(p, root), "utf8")
const stockText = read("iconsets/default.mcm")
const stock = parseMCM(stockText)

test("parseMCM / serializeMCM round-trip a Betaflight font", () => {
  assert.equal(stock.length, GLYPHS)
  assert.deepEqual(serializeMCM(stock).trim().split(/\s+/), stockText.trim().split(/\s+/))
  assert.deepEqual(parseMCM(serializeMCM(stock).replace(/\n/g, "\r\n")), stock)
})

test("C header and raw bytes round-trip", () => {
  assert.deepEqual(parseH(serializeH(stock, "my font")), stock)
  assert.deepEqual(bytesToFont(fontToBytes(stock, 54)), stock)
  assert.throws(() => parseMCM("hello"), /MAX7456/)
  assert.throws(() => bytesToFont(new Uint8Array(100)), /Expected/)
})

test("renderGlyph matches the Python build pixel for pixel", () => {
  const cases = JSON.parse(read("tests/fixtures/render_cases.json"))
  assert.ok(cases.length > 0)
  for (const c of cases) assert.equal(renderGlyph(c.rows, c.mode).join(""), c.cell, `${c.rows[0].length}x${c.rows.length} ${c.mode}`)
})

// A tiny two-set catalogue: set "a" is the stock font, set "b" is all white.
const white = Array.from({ length: GLYPHS }, () => "2".repeat(216))
const pack = (font) => font.map((g) => g.join(""))
const groups = [
  { id: "text", name: "Text", codes: TEXT_CODES },
  { id: "battery", name: "Battery", codes: [0x90, 0x91] },
  { id: "logo", name: "Logo", codes: Array.from({ length: 96 }, (_, i) => 0xa0 + i) },
]
const font = { id: "f", name: "F", glyphs: { 65: ["11", "11"] } }
const data = indexData(
  { collections: {}, fonts: [font] },
  { groups, iconsets: [{ id: "a", name: "A", license: "GPL-3.0", glyphs: pack(stock) }, { id: "b", name: "B", license: "CC0 1.0", glyphs: white }] },
)

test("compose takes letters from the font and symbols per group", () => {
  const out = compose(data, { font, base: "a", sources: { battery: "b" } })
  assert.deepEqual(out[65], renderGlyph(["11", "11"], "small"), "1:1 centred is the default")
  assert.deepEqual(compose(data, { font, base: "a", mode: "tall" })[65], renderGlyph(["11", "11"], "tall"))
  assert.deepEqual(out[66], stock[66], "missing letters fall back to the base set")
  assert.ok(out[0x90].every((v) => v === WHITE), "battery group from set b")
  assert.deepEqual(out[0x92], stock[0x92], "codes outside any listed group stay on the base set")
  assert.deepEqual(out[0x24], stock[0x24], "0x24 is a symbol, never replaced by the font")
  const who = provenance(data, { font, base: "a", sources: { battery: "b" } })
  assert.equal(who[65], "F")
  assert.equal(who[0x90], "B")
  assert.equal(who[0x30], "A")
})

test("custom logo fills 0xA0-0xFF", () => {
  const logo = Array.from({ length: 96 }, () => new Uint8Array(216).fill(WHITE))
  const out = compose(data, { base: "a", logo })
  assert.ok(out.slice(0xa0).every((g) => g.every((v) => v === WHITE)))
  assert.deepEqual(out[0x9f], stock[0x9f])
})

test("logo BMP export and RGBA import agree", () => {
  const bmp = logoToBMP(stock)
  assert.equal(bmp[0], 0x42)
  assert.equal(bmp[1], 0x4d)
  // decode the bottom-up 24-bit BMP back to RGBA and import it again
  const rgba = new Uint8ClampedArray(LOGO.width * LOGO.height * 4)
  const stride = (LOGO.width * 3 + 3) & ~3
  for (let y = 0; y < LOGO.height; y++) {
    for (let x = 0; x < LOGO.width; x++) {
      const s = 54 + (LOGO.height - 1 - y) * stride + x * 3
      rgba.set([bmp[s + 2], bmp[s + 1], bmp[s], 255], (y * LOGO.width + x) * 4)
    }
  }
  assert.deepEqual(rgbaToLogo(rgba), stock.slice(0xa0))
})

test("MSP v1 frames match Betaflight's encoding", () => {
  const frame = encodeMsp(MSP_OSD_CHAR_WRITE, [5, 1, 2])
  assert.deepEqual([...frame], [0x24, 0x4d, 0x3c, 3, 87, 5, 1, 2, 3 ^ 87 ^ 5 ^ 1 ^ 2])
  const got = []
  const p = new MspParser((f) => got.push(f))
  p.push([0xff, 0x24, 0x4d, 0x3e, 3, 1, 0, 1, 46]) // noise, then API version reply split below
  p.push([3 ^ 1 ^ 0 ^ 1 ^ 46, 0x24, 0x4d, 0x21, 0, 87, 87])
  assert.equal(got.length, 2)
  assert.deepEqual(got[0], { code: 1, payload: [0, 1, 46], error: false, crcOk: true })
  assert.equal(got[1].error, true)
})

test("an empty font is fully transparent", () => {
  assert.ok(emptyFont().every((g) => g.every((v) => v === TRANSPARENT)))
})

test("license summary: public domain only when letters and every icon source are", () => {
  const cc0Font = { ...font, license: "CC0 1.0" }
  assert.equal(licenseSummary(data, { font: cc0Font, base: "b" }).publicDomain, true)
  assert.equal(licenseSummary(data, { font: { ...font, license: "MIT" }, base: "b" }).publicDomain, false)
  assert.equal(licenseSummary(data, { font: cc0Font, base: "a" }).publicDomain, false)
  assert.equal(licenseSummary(data, { font: cc0Font, base: "b", sources: { battery: "a" } }).publicDomain, false)
  assert.equal(licenseSummary(data, { font: cc0Font, base: "b", sources: { logo: "a" }, logo: [] }).publicDomain, true, "a custom logo replaces set a's logo")
})

test("OSD label: the font name, shortened to a 15-character craft name", () => {
  assert.equal(osdLabel("IBM VGA 8x16"), "IBM VGA 8X16")
  assert.equal(osdLabel("Cozette 1.8.1"), "COZETTE")
  assert.equal(osdLabel("Arabian Magic Font1"), "ARABIAN MAGIC 1")
  assert.equal(osdLabel("Font 8x12"), "FONT 8X12")
  assert.equal(osdLabel("TridentEarly 8x14"), "TRIDENTEAR 8X14", "long words shrink, the size stays")
  assert.equal(osdLabel("Oldschool (domsson)"), "OLDSCHOOL")
  assert.equal(osdLabel("Price $9"), "PRICE 9", "no '$': that slot is a symbol")
  assert.equal(osdLabel(""), "OSD FONTS")
  for (const name of ["Kaneko Aero Fighters Font 1", "Minimal5x5Monospaced", "4025114973 F260a0378a O"]) {
    assert.ok(osdLabel(name).length <= 15, name)
  }
})

test("letter edges: shadow falls on one side, bevel reaches 2 px, black letters swap colours", () => {
  const rows = ["111", "111", "111"]
  const at = (cell) => (x, y) => cell[y * 12 + x]
  const px = (cell, v) => [...cell.keys()].filter((i) => cell[i] === v).map((i) => [i % 12, Math.floor(i / 12)])
  const face = (cell) => px(cell, WHITE)
  const box = (pts) => ({ x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) })

  const outline = renderGlyph(rows, "small")
  assert.equal(px(outline, BLACK).length, 16, "3x3 block + 1 px ring = 16 edge pixels")

  const shadow = renderGlyph(rows, "small", { style: "shadow", dir: "se" })
  const f = box(face(shadow))
  const e = box(px(shadow, BLACK))
  assert.deepEqual([e.x0, e.y0, e.x1, e.y1], [f.x0, f.y0, f.x1 + 1, f.y1 + 1], "shadow only right and below")
  assert.equal(at(shadow)(f.x0 - 1, f.y0), TRANSPARENT, "nothing on the left")

  const bevel = renderGlyph(rows, "small", { style: "bevel", dir: "nw" })
  const fb = box(face(bevel))
  const eb = box(px(bevel, BLACK))
  assert.deepEqual([eb.x0, eb.y0, eb.x1, eb.y1], [fb.x0 - 2, fb.y0 - 2, fb.x1 + 1, fb.y1 + 1], "bevel: 1 px ring + 2 px towards up-left")

  const inverted = renderGlyph(rows, "small", { style: "outline", invert: true })
  assert.deepEqual(px(inverted, BLACK), px(outline, WHITE), "letters become black")
  assert.deepEqual(px(inverted, WHITE), px(outline, BLACK), "edge becomes white")

  assert.ok(renderGlyph(rows, "small", { style: "none" }).every((v) => v !== BLACK), "no edge at all")
})
