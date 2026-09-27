// End-to-end smoke test: serve site/ and drive every page in a real browser.
// Needs site/data (run `uv run build.py` first) and `npx playwright install chromium`.
import assert from "node:assert/strict"
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"

import { chromium, firefox, webkit } from "playwright"

import { parseMCM } from "../../site/assets/mcm.js"

const root = fileURLToPath(new URL("../../", import.meta.url))
const site = join(root, "site")
if (!existsSync(join(site, "data", "fonts.json"))) throw new Error("site/data is missing: run `uv run build.py` first.")

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" }
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "")
  let file = join(site, path)
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html")
  if (!existsSync(file)) return res.writeHead(404).end()
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" })
  createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${server.address().port}/`
const browserType = { chromium, firefox, webkit }[process.env.BROWSER ?? "chromium"]
const browser = await browserType.launch()
const context = await browser.newContext({ acceptDownloads: true })
const errors = []
context.on("weberror", (e) => errors.push(e.error().message))
const iconset = (id) => parseMCM(readFileSync(join(root, "iconsets", `${id}.mcm`), "utf8"))

async function downloadMcm(page, button) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click(button)])
  const text = readFileSync(await dl.path(), "utf8")
  return { name: dl.suggestedFilename(), font: parseMCM(text) }
}

let failures = 0
async function check(name, fn) {
  const page = await context.newPage()
  page.on("console", (m) => m.type() === "error" && !/favicon|fonts\.g/.test(m.text()) && errors.push(m.text()))
  try {
    await fn(page)
    console.log(`ok   ${name}`)
  } catch (e) {
    failures++
    console.log(`FAIL ${name}\n     ${e.message.split("\n").join("\n     ")}`)
  } finally {
    await page.close()
  }
}

await check("browse: gallery, demo and download", async (page) => {
  await page.goto(base + "index.html")
  await page.waitForSelector("#grid .card")
  assert.match(await page.textContent("#cap-font"), /IBM VGA 8x16/)
  assert.equal(await page.getAttribute("#mode-small", "aria-pressed"), "true", "1:1 centred is the default")
  const cards = await page.locator("#grid .card").count()
  assert.ok(cards >= 30, `shortlist has ${cards} cards`)
  await page.click('#groups .chip[data-group="all"]')
  assert.ok((await page.locator("#grid .card").count()) >= 200)
  await page.fill("#search", "terminus")
  await page.locator("#grid .card").first().click()
  assert.match(await page.textContent("#cap-font"), /Terminus/)
  const { name, font } = await downloadMcm(page, "#download")
  assert.equal(name, "terminus.mcm")
  assert.equal(font.length, 256)
  assert.notDeepEqual(font[0x41], iconset("default")[0x41], "letters come from Terminus")
  // 1:1: Terminus letters are 7x13, so the top two rows of 'A' are empty
  assert.ok(font[0x41].slice(0, 24).every((v) => v === 1), "1:1 glyph leaves the top rows transparent")
  assert.deepEqual(font[0x90], iconset("default")[0x90], "icons are stock")
})

await check("mix: whole set, then per-group Pro mode, share link", async (page) => {
  await page.goto(base + "mix.html?font=ibm-cga&icons=bold")
  await page.waitForSelector("#sheet .ch")
  let { font } = await downloadMcm(page, "#download")
  assert.deepEqual(font[0x90], iconset("bold")[0x90])
  assert.deepEqual(font[0xa0], iconset("bold")[0xa0])
  await page.check("#pro")
  await page.selectOption("#g-battery", "vision")
  ;({ font } = await downloadMcm(page, "#download"))
  assert.deepEqual(font[0x90], iconset("vision")[0x90], "battery from Vision")
  assert.deepEqual(font[0x60], iconset("bold")[0x60], "arrows still from Bold")
  assert.deepEqual(font[0xc0], iconset("default")[0xc0], "Betaflight logo")
  assert.deepEqual(
    (await page.locator("#logo option").allTextContents()).map((t) => t.trim()),
    ["Betaflight", "OSD Fonts (CC0)", "Custom image (288×72)…"],
  )
  const url = new URL(page.url())
  assert.equal(url.searchParams.get("g.battery"), "vision")
  // the same link rebuilds the same font
  const again = await context.newPage()
  await again.goto(page.url())
  await again.waitForSelector("#sheet .ch")
  const second = await downloadMcm(again, "#download")
  assert.deepEqual(second.font, font)
  await again.close()
})

await check("mix: CC0 letters + CC0 icons make a public-domain font", async (page) => {
  await page.goto(base + "mix.html?font=public-pixel&icons=cc0")
  await page.waitForSelector("#sheet .ch")
  assert.equal(await page.inputValue("#logo"), "cc0", "the logo follows the CC0 icon set")
  assert.match(await page.textContent("#license"), /public domain/)
  const { font } = await downloadMcm(page, "#download")
  for (const c of [0x01, 0x60, 0x90, 0xa0, 0xff]) assert.deepEqual(font[c], iconset("cc0")[c])
  await page.selectOption("#icons", "bold")
  assert.equal(await page.inputValue("#logo"), "default", "switching to a Betaflight set switches the logo back")
  assert.doesNotMatch(await page.textContent("#license"), /public domain/)
})

await check("mix → editor hand-off, draw, undo, save", async (page) => {
  await page.goto(base + "mix.html?font=unscii&icons=impact")
  await page.waitForSelector("#sheet .ch")
  await page.click("#edit")
  await page.waitForURL(/editor\.html/)
  await page.waitForSelector("#sheet .ch")
  assert.match(await page.textContent("#status"), /from the mixer/)
  await page.selectOption("#glyph", String(0x41))
  await page.click('.swatch[data-v="0"]')
  const box = await page.locator("#canvas").boundingBox()
  await page.mouse.click(box.x + 3, box.y + 3) // top-left pixel of 'A' becomes black
  let { font } = await downloadMcm(page, "#save-mcm")
  assert.equal(font[0x41][0], 0)
  await page.click("#undo")
  ;({ font } = await downloadMcm(page, "#save-mcm"))
  assert.equal(font[0x41][0], 1, "undo restores the transparent pixel")
  assert.deepEqual(font[0x90], iconset("impact")[0x90])
})

await check("editor: presets, composition mode on the logo, upload dialog", async (page) => {
  await page.goto(base + "editor.html")
  await page.waitForSelector("#sheet .ch")
  await page.click("#presets")
  await page.selectOption("#preset-iconset", "vision")
  await page.click('#presets-dialog button[value="load"]')
  const { font } = await downloadMcm(page, "#save-mcm")
  assert.deepEqual(font, iconset("vision"))
  await page.click("#logo-edit")
  assert.equal((await page.textContent("#compose-list")).trim().split(/\s+/).length, 96)
  await page.click("#upload")
  assert.ok(await page.isVisible("#upload-dialog"))
  assert.match(await page.textContent("#upload-dialog h2"), /Upload to flight controller/)
})

await check("install and per-font pages load", async (page) => {
  await page.goto(base + "install.html")
  assert.match(await page.textContent("h1"), /Put a font/)
  await page.goto(base + "f/ibm-vga-8x16.html")
  assert.match(await page.textContent("h1"), /IBM VGA 8x16/)
  assert.ok(await page.locator("img.font-preview").evaluate((img) => img.complete && img.naturalWidth > 0))
})

if (errors.length) {
  failures++
  console.log("FAIL page errors:\n     " + errors.join("\n     "))
}
await browser.close()
server.close()
console.log(failures ? `${failures} failed` : "all passed")
process.exit(failures ? 1 : 0)
