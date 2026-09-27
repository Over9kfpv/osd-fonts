import "./theme.js"
import { compose, fileName, licenseSummary, loadData, provenance } from "./compose.js"
import { drawLogo, fileToLogo } from "./logo.js"
import { CH, CW, download, serializeMCM } from "./mcm.js"
import { OsdDemo, putGlyph } from "./osd-demo.js"
import { openUploadDialog } from "./upload.js"

const $ = (id) => document.getElementById(id)
const data = await loadData()
const PRO_GROUPS = data.groups.filter((g) => !["text", "logo"].includes(g.id))

// ---- state (mirrored in the URL so a mix can be shared)
const q = new URLSearchParams(location.search)
const state = {
  font: data.fontById.get(q.get("font")) ?? data.fontById.get("ibm-vga-8x16") ?? data.fonts[0],
  mode: q.get("mode") === "tall" ? "tall" : "small",
  icons: data.iconsetById.has(q.get("icons")) ? q.get("icons") : "default",
  logo: "", // "default" = Betaflight logo, "cc0" = OSD Fonts CC0 logo, "custom" = uploaded image
  pro: q.get("pro") === "1",
  groups: {}, // groupId -> iconset id ("" = same as icons)
  customLogo: null,
}
if (q.get("font") === "none") state.font = null
// Logo follows the icon set (Betaflight sets share one logo; the CC0 set has its own) unless chosen.
const matchingLogo = (icons) => (icons === "cc0" ? "cc0" : "default")
state.logo = ["default", "cc0"].includes(q.get("logo")) ? q.get("logo") : matchingLogo(state.icons)
for (const g of PRO_GROUPS) {
  const v = q.get(`g.${g.id}`)
  if (data.iconsetById.has(v)) state.groups[g.id] = v
}

function mixOptions() {
  const sources = {}
  if (state.pro) Object.assign(sources, Object.fromEntries(Object.entries(state.groups).filter(([, v]) => v)))
  if (state.logo !== "custom") sources.logo = state.logo
  return {
    font: state.font,
    mode: state.mode,
    base: state.icons,
    sources,
    logo: state.logo === "custom" ? state.customLogo : null,
  }
}
let current = compose(data, mixOptions())

function syncUrl() {
  const p = new URLSearchParams()
  p.set("font", state.font ? state.font.id : "none")
  if (state.mode !== "small") p.set("mode", state.mode)
  p.set("icons", state.icons)
  if (state.logo !== "custom" && state.logo !== matchingLogo(state.icons)) p.set("logo", state.logo)
  if (state.pro) {
    p.set("pro", "1")
    for (const [k, v] of Object.entries(state.groups)) if (v) p.set(`g.${k}`, v)
  }
  history.replaceState(null, "", `?${p}`)
}

// ---- controls
const fontSel = $("font")
function fillFonts(filter = "") {
  fontSel.textContent = ""
  fontSel.add(new Option("None: keep the icon set's own letters", "none"))
  for (const [col, title] of Object.entries(data.collections)) {
    const og = document.createElement("optgroup")
    og.label = title
    data.fonts
      .filter((f) => f.collection === col && (!filter || f.name.toLowerCase().includes(filter) || f === state.font))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((f) => og.append(new Option(`${f.name} (${f.size})`, f.id)))
    if (og.children.length) fontSel.append(og)
  }
  fontSel.value = state.font ? state.font.id : "none"
}

const setOptions = (sel, first) => {
  sel.textContent = ""
  if (first) sel.add(new Option(first, ""))
  for (const s of data.iconsets) sel.add(new Option(s.name, s.id))
}
setOptions($("icons"))
$("logo").add(new Option("Betaflight", "default"))
$("logo").add(new Option("OSD Fonts (CC0)", "cc0"))
$("logo").add(new Option("Custom image (288×72)…", "custom"))

const proBox = $("pro-groups")
for (const g of PRO_GROUPS) {
  const f = document.createElement("div")
  f.className = "field"
  f.innerHTML = `<label for="g-${g.id}"></label><select id="g-${g.id}"></select><span class="about"></span>`
  f.querySelector("label").textContent = g.name
  f.querySelector(".about").textContent = g.about
  const sel = f.querySelector("select")
  setOptions(sel, "Same as the icons")
  sel.value = state.groups[g.id] ?? ""
  sel.addEventListener("change", () => {
    state.groups[g.id] = sel.value
    update()
  })
  proBox.append(f)
}

// ---- character sheet
const sheet = $("sheet")
const cells = []
for (let c = 0; c < 256; c++) {
  const b = document.createElement("button")
  b.type = "button"
  b.className = "ch"
  b.dataset.group = data.groupOf[c]
  b.innerHTML = `<span class="idx">${c.toString(16).toUpperCase().padStart(2, "0")}</span>`
  const cv = document.createElement("canvas")
  cv.width = CW
  cv.height = CH
  b.prepend(cv)
  sheet.append(b)
  cells.push(cv)
}
let origin = []
const groupName = Object.fromEntries(data.groups.map((g) => [g.id, g.name]))
function describe(c) {
  const hex = "0x" + c.toString(16).toUpperCase().padStart(2, "0")
  return `${hex} · ${groupName[data.groupOf[c]]} · from ${origin[c]}`
}
sheet.addEventListener("pointerover", (e) => {
  const b = e.target.closest(".ch")
  if (b) $("sheet-info").textContent = describe([...sheet.children].indexOf(b))
})
sheet.addEventListener("focusin", (e) => {
  const b = e.target.closest(".ch")
  if (b) $("sheet-info").textContent = describe([...sheet.children].indexOf(b))
})

function drawSheet() {
  for (let c = 0; c < 256; c++) {
    const ctx = cells[c].getContext("2d")
    const img = ctx.createImageData(CW, CH)
    putGlyph(img, current[c], 0, 0)
    ctx.putImageData(img, 0, 0)
    sheet.children[c].title = describe(c)
  }
}

// ---- preview
const demo = new OsdDemo($("screen"), { craft: $("craft").value })
$("craft").addEventListener("input", (e) => demo.setCraft(e.target.value))

function update() {
  current = compose(data, mixOptions())
  origin = provenance(data, mixOptions())
  demo.setFont(current)
  drawSheet()
  drawLogo($("logo-preview"), current)
  const set = data.iconsetById.get(state.icons).name
  $("cap").textContent = `${state.font ? state.font.name : set + " letters"} + ${set} icons` + (state.pro ? " (mixed)" : "")
  const native = !state.font || state.font.native
  $("mode-field").style.opacity = native ? 0.45 : 1
  $("mode-tall").disabled = $("mode-small").disabled = native
  const lic = licenseSummary(data, mixOptions())
  $("license").textContent = lic.text
  $("license").classList.toggle("pd", lic.publicDomain)
  syncUrl()
}

fontSel.addEventListener("change", () => {
  state.font = fontSel.value === "none" ? null : data.fontById.get(fontSel.value)
  update()
})
$("font-search").addEventListener("input", (e) => fillFonts(e.target.value.trim().toLowerCase()))
for (const m of ["tall", "small"]) {
  $(`mode-${m}`).addEventListener("click", () => {
    state.mode = m
    $("mode-tall").setAttribute("aria-pressed", m === "tall")
    $("mode-small").setAttribute("aria-pressed", m === "small")
    update()
  })
}
$("icons").addEventListener("change", (e) => {
  if (state.logo === matchingLogo(state.icons)) state.logo = matchingLogo(e.target.value)
  $("logo").value = state.logo
  state.icons = e.target.value
  update()
})
$("logo").addEventListener("change", (e) => {
  if (e.target.value === "custom") return $("logo-file").click()
  state.logo = e.target.value
  $("logo-status").textContent = ""
  update()
})
$("logo-file").addEventListener("change", async (e) => {
  const file = e.target.files[0]
  e.target.value = ""
  if (!file) return void ($("logo").value = state.logo)
  try {
    state.customLogo = await fileToLogo(file)
    state.logo = "custom"
    $("logo-status").textContent = `Using ${file.name}. Pure green (0,255,0) is transparent. Custom logos aren't part of shared links.`
    update()
  } catch (err) {
    $("logo").value = state.logo
    $("logo-status").textContent = err.message
  }
})
$("pro").addEventListener("change", (e) => {
  state.pro = e.target.checked
  proBox.hidden = !state.pro
  update()
})

const name = () =>
  fileName([state.font?.id ?? "stock", state.icons !== "default" ? state.icons : "", state.pro ? "mix" : ""].filter(Boolean).join("-"))
$("download").addEventListener("click", () => {
  download(`${name()}.mcm`, serializeMCM(current))
  $("status").textContent = `Saved ${name()}.mcm`
})
$("upload").addEventListener("click", () => openUploadDialog(() => current))
$("edit").addEventListener("click", () => {
  try {
    localStorage.setItem("osdfonts.handoff", JSON.stringify({ name: `${name()}.mcm`, mcm: serializeMCM(current) }))
    location.href = "editor.html?from=mix"
  } catch {
    $("status").textContent = "Couldn't hand the font to the editor (browser storage is blocked). Download it and open it there."
  }
})
$("share").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href)
    $("status").textContent = "Link copied." + (state.logo === "custom" ? " It doesn't include your custom logo." : "")
  } catch {
    $("status").textContent = location.href
  }
})

// ---- init
fillFonts()
$("icons").value = state.icons
$("logo").value = state.logo
$("pro").checked = state.pro
proBox.hidden = !state.pro
$("mode-tall").setAttribute("aria-pressed", state.mode === "tall")
$("mode-small").setAttribute("aria-pressed", state.mode === "small")
update()
demo.start()
