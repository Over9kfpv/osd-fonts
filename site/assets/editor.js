// MAX7456 font editor. Pixel values: 0 black, 1 transparent, 2 white.
import "./theme.js"
import { compose, loadData } from "./compose.js"
import { LOGO, drawLogo, fileToLogo, logoToBMP } from "./logo.js"
import {
  BLACK, CH, CW, GLYPHS, TRANSPARENT, WHITE,
  cloneFont, download, emptyFont, parseH, parseMCM, serializeH, serializeMCM, unpackGlyph,
} from "./mcm.js"
import { OsdDemo, osdLabel, putGlyph } from "./osd-demo.js"
import { openUploadDialog } from "./upload.js"

const $ = (id) => document.getElementById(id)
const STORE = "osdfonts.editor"
const data = await loadData()
const groupName = Object.fromEntries(data.groups.map((g) => [g.id, g.name]))
const hex = (c) => "0x" + c.toString(16).toUpperCase().padStart(2, "0")

const state = {
  font: null,
  name: "",
  current: 0x41,
  color: WHITE,
  tool: "pencil",
  compose: { on: false, ids: [], cols: 1 },
  undo: [],
  redo: [],
  clip: null,
}

// ---------- geometry ----------
function layout() {
  const c = state.compose
  const ids = c.on && c.ids.length ? c.ids : [state.current]
  const cols = c.on ? Math.max(1, Math.min(c.cols, ids.length)) : 1
  const rows = Math.ceil(ids.length / cols)
  return { ids, cols, rows, w: cols * CW, h: rows * CH }
}
function locate(x, y, L) {
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return null
  const id = L.ids[Math.floor(y / CH) * L.cols + Math.floor(x / CW)]
  return id === undefined ? null : { id, i: (y % CH) * CW + (x % CW) }
}
const getPx = (x, y, L) => {
  const p = locate(x, y, L)
  return p ? state.font[p.id][p.i] : null
}
const setPx = (x, y, v, L) => {
  const p = locate(x, y, L)
  if (p) state.font[p.id][p.i] = v
}

// ---------- history ----------
function snapshot(ids = layout().ids) {
  return { glyphs: ids.map((id) => [id, state.font[id].slice()]), current: state.current }
}
function pushUndo(ids) {
  state.undo.push(snapshot(ids))
  if (state.undo.length > 200) state.undo.shift()
  state.redo = []
}
function restore(entry, into) {
  into.push(snapshot(entry.glyphs.map(([id]) => id)))
  for (const [id, g] of entry.glyphs) state.font[id] = g.slice()
  state.current = entry.current
  changed(entry.glyphs.map(([id]) => id))
}
const undo = () => state.undo.length && restore(state.undo.pop(), state.redo)
const redo = () => state.redo.length && restore(state.redo.pop(), state.undo)

// ---------- editor canvas ----------
const canvas = $("canvas")
const ctx = canvas.getContext("2d")
let scale = 20
function sizeCanvas() {
  const L = layout()
  scale = Math.max(4, Math.min(20, Math.floor(300 / L.w), Math.floor(420 / L.h)))
  canvas.width = L.w * scale
  canvas.height = L.h * scale
  placeOverlay()
}
const COLORS = { [BLACK]: "#000", [WHITE]: "#fff" }
function drawEditor() {
  const L = layout()
  if (canvas.width !== L.w * scale || canvas.height !== L.h * scale) sizeCanvas()
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      const v = getPx(x, y, L)
      ctx.fillStyle = v === null ? "#0a0d11" : v === TRANSPARENT ? ((x + y) % 2 ? "#34414e" : "#2e3a46") : COLORS[v]
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  if (scale >= 8) {
    ctx.strokeStyle = "rgba(255,255,255,.07)"
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 1; x < L.w; x++) ctx.moveTo(x * scale + 0.5, 0), ctx.lineTo(x * scale + 0.5, canvas.height)
    for (let y = 1; y < L.h; y++) ctx.moveTo(0, y * scale + 0.5), ctx.lineTo(canvas.width, y * scale + 0.5)
    ctx.stroke()
  }
  if (L.ids.length > 1) {
    ctx.strokeStyle = "rgba(255,181,71,.45)"
    ctx.beginPath()
    for (let x = 1; x < L.cols; x++) ctx.moveTo(x * CW * scale + 0.5, 0), ctx.lineTo(x * CW * scale + 0.5, canvas.height)
    for (let y = 1; y < L.rows; y++) ctx.moveTo(0, y * CH * scale + 0.5), ctx.lineTo(canvas.width, y * CH * scale + 0.5)
    ctx.stroke()
  }
}

// ---------- drawing tools ----------
function line(x0, y0, x1, y1, v, L) {
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    setPx(x0, y0, v, L)
    if (x0 === x1 && y0 === y1) return
    const e2 = 2 * err
    if (e2 >= dy) (err += dy), (x0 += sx)
    if (e2 <= dx) (err += dx), (y0 += sy)
  }
}
function rect(x0, y0, x1, y1, v, L) {
  const [l, r] = [Math.min(x0, x1), Math.max(x0, x1)]
  const [t, b] = [Math.min(y0, y1), Math.max(y0, y1)]
  for (let x = l; x <= r; x++) setPx(x, t, v, L), setPx(x, b, v, L)
  for (let y = t; y <= b; y++) setPx(l, y, v, L), setPx(r, y, v, L)
}
function fill(x, y, v, L) {
  const target = getPx(x, y, L)
  if (target === null || target === v) return
  const stack = [[x, y]]
  while (stack.length) {
    const [cx, cy] = stack.pop()
    if (getPx(cx, cy, L) !== target) continue
    setPx(cx, cy, v, L)
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
  }
}

let drag = null // { L, anchor, last, before }
function cellAt(e) {
  const r = canvas.getBoundingClientRect()
  const x = Math.floor(((e.clientX - r.left) * (canvas.width / r.width)) / scale)
  const y = Math.floor(((e.clientY - r.top) * (canvas.height / r.height)) / scale)
  return { x, y }
}
canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return
  const L = layout()
  const p = cellAt(e)
  if (!locate(p.x, p.y, L)) return
  canvas.setPointerCapture(e.pointerId)
  pushUndo(L.ids)
  const before = snapshot(L.ids)
  const v = e.button === 2 ? TRANSPARENT : state.color
  drag = { L, anchor: p, last: p, before, v }
  if (state.tool === "fill") {
    fill(p.x, p.y, v, L)
    drag = null
  } else if (state.tool === "pencil") setPx(p.x, p.y, v, L)
  changed(L.ids, true)
})
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return
  const p = cellAt(e)
  const { L, anchor, v } = drag
  if (state.tool === "pencil") {
    line(drag.last.x, drag.last.y, p.x, p.y, v, L)
    drag.last = p
  } else {
    for (const [id, g] of drag.before.glyphs) state.font[id] = g.slice()
    if (state.tool === "line") line(anchor.x, anchor.y, p.x, p.y, v, L)
    else rect(anchor.x, anchor.y, p.x, p.y, v, L)
  }
  changed(L.ids, true)
})
const endDrag = () => {
  if (!drag) return
  drag = null
  changed(layout().ids)
}
canvas.addEventListener("pointerup", endDrag)
canvas.addEventListener("pointercancel", endDrag)
canvas.addEventListener("contextmenu", (e) => e.preventDefault())

// ---------- whole-glyph operations ----------
function edit(fn) {
  const L = layout()
  pushUndo(L.ids)
  fn(L)
  changed(L.ids)
}
function shift(dx, dy) {
  edit((L) => {
    const copy = snapshot(L.ids)
    const read = new Map(copy.glyphs)
    const src = (x, y) => {
      const p = locate(x, y, L)
      return p ? read.get(p.id)[p.i] : TRANSPARENT
    }
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) setPx(x, y, src(x - dx, y - dy) ?? TRANSPARENT, L)
  })
}
const invert = () =>
  edit((L) => L.ids.forEach((id) => state.font[id].forEach((v, i, g) => (g[i] = v === WHITE ? BLACK : v === BLACK ? WHITE : v))))
const clear = () => edit((L) => L.ids.forEach((id) => state.font[id].fill(TRANSPARENT)))
function copy() {
  const L = layout()
  state.clip = { glyphs: L.ids.map((id) => state.font[id].slice()), cols: L.cols }
  status(L.ids.length > 1 ? `Copied ${L.ids.length} characters.` : `Copied ${hex(L.ids[0])}.`)
}
function paste() {
  if (!state.clip) return status("Nothing copied yet.")
  const L = layout()
  const n = state.clip.glyphs.length
  if (n > 1 && n !== L.ids.length) return status(`The clipboard has ${n} characters but ${L.ids.length} are selected.`)
  edit(() => {
    if (n === 1) L.ids.forEach((id) => (state.font[id] = state.clip.glyphs[0].slice()))
    else L.ids.forEach((id, i) => (state.font[id] = state.clip.glyphs[i].slice()))
  })
  status(`Pasted into ${L.ids.length > 1 ? L.ids.length + " characters" : hex(L.ids[0])}.`)
}

// ---------- character sheet ----------
const sheet = $("sheet")
const cellCanvases = []
for (let c = 0; c < GLYPHS; c++) {
  const b = document.createElement("button")
  b.type = "button"
  b.className = "ch"
  b.dataset.group = data.groupOf[c]
  b.title = `${hex(c)} · ${groupName[data.groupOf[c]]}`
  b.setAttribute("aria-label", b.title)
  const cv = document.createElement("canvas")
  cv.width = CW
  cv.height = CH
  b.append(cv)
  b.insertAdjacentHTML("beforeend", `<span class="idx">${c.toString(16).toUpperCase().padStart(2, "0")}</span>`)
  sheet.append(b)
  cellCanvases.push(cv)
}
function drawCell(c) {
  const cx = cellCanvases[c].getContext("2d")
  const img = cx.createImageData(CW, CH)
  putGlyph(img, state.font[c], 0, 0)
  cx.putImageData(img, 0, 0)
}
function markSheet() {
  const sel = new Set(state.compose.on ? state.compose.ids : [])
  ;[...sheet.children].forEach((b, c) => {
    b.classList.toggle("active", c === state.current)
    b.classList.toggle("selected", sel.has(c))
  })
}
sheet.addEventListener("click", (e) => {
  const b = e.target.closest(".ch")
  if (!b) return
  const c = [...sheet.children].indexOf(b)
  if (state.compose.on) {
    const ids = state.compose.ids
    const at = ids.indexOf(c)
    if (at >= 0) ids.splice(at, 1)
    else ids.push(c)
    if (!ids.length) return setCompose(false)
    state.current = ids[0]
    refreshCompose()
  } else select(c)
})
sheet.addEventListener("pointerover", (e) => {
  const b = e.target.closest(".ch")
  if (b) $("sheet-info").textContent = b.title
})

const glyphSel = $("glyph")
for (let c = 0; c < GLYPHS; c++) {
  const ch = c >= 0x20 && c < 0x60 && c !== 0x24 ? ` '${String.fromCharCode(c)}'` : ""
  glyphSel.add(new Option(`${hex(c)}${ch} · ${groupName[data.groupOf[c]]}`, c))
}
glyphSel.addEventListener("change", () => select(+glyphSel.value))

function select(c) {
  state.current = (c + GLYPHS) % GLYPHS
  glyphSel.value = state.current
  markSheet()
  drawEditor()
  scheduleSave()
}

// ---------- composition mode ----------
function setCompose(on, ids = [state.current], cols = 1) {
  state.compose = { on, ids: on ? ids : [], cols }
  $("compose").setAttribute("aria-pressed", on)
  $("compose").textContent = on ? "Exit composition mode" : "Composition mode"
  $("compose-panel").hidden = !on
  glyphSel.disabled = on
  refreshCompose()
}
function refreshCompose() {
  const c = state.compose
  $("compose-cols").value = c.cols
  $("compose-list").textContent = c.ids.map(hex).join(" ")
  sizeCanvas()
  drawEditor()
  markSheet()
}
$("compose").addEventListener("click", () => setCompose(!state.compose.on))
$("compose-cols").addEventListener("change", (e) => {
  state.compose.cols = Math.max(1, Math.min(24, +e.target.value || 1))
  refreshCompose()
})
$("logo-edit").addEventListener("click", () => {
  const ids = Array.from({ length: LOGO.cols * LOGO.rows }, (_, i) => LOGO.start + i)
  setCompose(true, ids, LOGO.cols)
  state.current = LOGO.start
  canvas.scrollIntoView({ block: "center" })
  status("Editing the logo as one picture. Exit composition mode to go back to single characters.")
})

// ---------- overlay ----------
const overlay = $("overlay")
function placeOverlay() {
  if (overlay.hidden) return
  overlay.style.left = canvas.offsetLeft + "px"
  overlay.style.top = canvas.offsetTop + "px"
  overlay.style.width = canvas.clientWidth + "px"
  overlay.style.height = canvas.clientHeight + "px"
}
$("overlay-file").addEventListener("change", (e) => {
  const f = e.target.files[0]
  e.target.value = ""
  if (!f) return
  overlay.src = URL.createObjectURL(f)
  overlay.onload = () => {
    overlay.hidden = false
    $("overlay-controls").hidden = false
    overlay.style.opacity = $("overlay-opacity").value
    placeOverlay()
  }
})
$("overlay-opacity").addEventListener("input", (e) => (overlay.style.opacity = e.target.value))
$("overlay-invert").addEventListener("click", () => (overlay.style.filter = overlay.style.filter ? "" : "invert(1)"))
$("overlay-remove").addEventListener("click", () => {
  overlay.hidden = true
  $("overlay-controls").hidden = true
  overlay.removeAttribute("src")
})
new ResizeObserver(placeOverlay).observe(canvas)

// ---------- change propagation ----------
let sideTimer = null
function changed(ids, live = false) {
  drawEditor()
  ids.forEach(drawCell)
  markSheet()
  clearTimeout(sideTimer)
  sideTimer = setTimeout(
    () => {
      drawLogo($("logo"), state.font)
      demo.setFont(state.font)
      scheduleSave()
    },
    live ? 120 : 0,
  )
}
function redrawAll() {
  sizeCanvas()
  drawEditor()
  for (let c = 0; c < GLYPHS; c++) drawCell(c)
  markSheet()
  drawLogo($("logo"), state.font)
  demo.setCraft(osdLabel((state.name || "").replace(/\.[^.]+$/, "").replace(/-/g, " ")))
  demo.setFont(state.font)
  glyphSel.value = state.current
  $("file-name").textContent = state.name ? `— ${state.name}` : ""
  scheduleSave()
}

// ---------- persistence ----------
let saveTimer = null
function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ name: state.name, current: state.current, font: state.font.map((g) => g.join("")).join("") }))
    } catch {
      status("Couldn't autosave (browser storage is full or blocked). Save a file to keep your work.")
    }
  }, 400)
}
function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || "null")
    if (!s || s.font.length !== GLYPHS * CW * CH) return false
    state.font = Array.from({ length: GLYPHS }, (_, i) => unpackGlyph(s.font.slice(i * CW * CH, (i + 1) * CW * CH)))
    state.name = s.name || ""
    state.current = s.current ?? 0x41
    return true
  } catch {
    return false
  }
}
function setFont(font, name, message) {
  if (state.font) pushUndo(Array.from({ length: GLYPHS }, (_, i) => i))
  state.font = cloneFont(font)
  state.name = name
  if (state.compose.on) setCompose(false)
  redrawAll()
  if (message) status(message)
}
const status = (m) => ($("status").textContent = m)

// ---------- files ----------
$("open").addEventListener("change", async (e) => {
  const f = e.target.files[0]
  e.target.value = ""
  if (!f) return
  try {
    const text = await f.text()
    const font = /\.h$/i.test(f.name) ? parseH(text) : parseMCM(text)
    setFont(font, f.name, `Opened ${f.name}. Undo brings back the previous font.`)
  } catch (err) {
    status(`Couldn't open ${f.name}: ${err.message}`)
  }
})
const baseName = () => (state.name || "osd-font").replace(/\.[^.]+$/, "")
$("save-mcm").addEventListener("click", () => {
  download(`${baseName()}.mcm`, serializeMCM(state.font))
  status(`Saved ${baseName()}.mcm`)
})
$("save-h").addEventListener("click", () => {
  download(`${baseName()}.h`, serializeH(state.font, baseName()))
  status(`Saved ${baseName()}.h`)
})
$("upload").addEventListener("click", () => openUploadDialog(() => state.font))

function confirmAction(title, text, okLabel) {
  const d = $("confirm-dialog")
  $("confirm-title").textContent = title
  $("confirm-text").textContent = text
  $("confirm-ok").textContent = okLabel
  d.returnValue = ""
  d.showModal()
  return new Promise((resolve) => d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true }))
}
$("new").addEventListener("click", async () => {
  if (await confirmAction("Start a new font?", "Every character becomes transparent. Undo can bring the current font back until you close this page.", "Clear all"))
    setFont(emptyFont(), "", "New empty font.")
})

// presets: any icon set, optionally with letters from a catalog font
const pd = $("presets-dialog")
for (const s of data.iconsets) $("preset-iconset").add(new Option(s.name, s.id))
$("preset-font").add(new Option("Keep the icon set's letters", ""))
for (const [col, title] of Object.entries(data.collections)) {
  const og = document.createElement("optgroup")
  og.label = title
  data.fonts.filter((f) => f.collection === col).sort((a, b) => a.name.localeCompare(b.name)).forEach((f) => og.append(new Option(f.name, f.id)))
  $("preset-font").append(og)
}
$("presets").addEventListener("click", () => {
  pd.returnValue = ""
  pd.showModal()
})
pd.addEventListener("close", () => {
  if (pd.returnValue !== "load") return
  const set = $("preset-iconset").value
  const font = data.fontById.get($("preset-font").value) ?? null
  const name = font ? `${font.id}-${set}.mcm` : `${set}.mcm`
  setFont(compose(data, { font, base: set }), name, `Loaded ${font ? font.name + " with " : ""}${data.iconsetById.get(set).name} icons.`)
})

// logo import / export
$("logo-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]
  e.target.value = ""
  if (!f) return
  try {
    const tiles = await fileToLogo(f)
    pushUndo(tiles.map((_, i) => LOGO.start + i))
    tiles.forEach((g, i) => (state.font[LOGO.start + i] = g))
    changed(tiles.map((_, i) => LOGO.start + i))
    status(`Imported ${f.name} into 0xA0–0xFF. Pure green (0,255,0) became transparent.`)
  } catch (err) {
    status(err.message)
  }
})
$("logo-export").addEventListener("click", () => download(`${baseName()}-logo.bmp`, logoToBMP(state.font), "image/bmp"))

// ---------- tool UI ----------
function setTool(t) {
  state.tool = t
  document.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tool === t))
}
function setColor(v) {
  state.color = v
  document.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-checked", +s.dataset.v === v))
}
document.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)))
document.querySelectorAll(".swatch").forEach((s) => s.addEventListener("click", () => setColor(+s.dataset.v)))
document.querySelectorAll("[data-shift]").forEach((b) => b.addEventListener("click", () => shift(...b.dataset.shift.split(",").map(Number))))
$("invert").addEventListener("click", invert)
$("clear").addEventListener("click", clear)
$("copy").addEventListener("click", copy)
$("paste").addEventListener("click", paste)
$("undo").addEventListener("click", undo)
$("redo").addEventListener("click", redo)

window.addEventListener("keydown", (e) => {
  if (e.target.closest("input, select, textarea, dialog")) return
  const mod = e.ctrlKey || e.metaKey
  const k = e.key.toLowerCase()
  if (mod && k === "z") (e.shiftKey ? redo : undo)()
  else if (mod && k === "y") redo()
  else if (mod && k === "c") copy()
  else if (mod && k === "v") paste()
  else if (mod) return
  else if (k === "escape" && drag) {
    for (const [id, g] of drag.before.glyphs) state.font[id] = g.slice()
    state.undo.pop()
    drag = null
    changed(layout().ids)
  } else if ("123".includes(k) && k) setColor(+k - 1)
  else if (k === "p") setTool("pencil")
  else if (k === "l") setTool("line")
  else if (k === "r") setTool("rect")
  else if (k === "f") setTool("fill")
  else if (k === "[" && !state.compose.on) select(state.current - 1)
  else if (k === "]" && !state.compose.on) select(state.current + 1)
  else if (k.startsWith("arrow")) shift(k === "arrowleft" ? -1 : k === "arrowright" ? 1 : 0, k === "arrowup" ? -1 : k === "arrowdown" ? 1 : 0)
  else return
  e.preventDefault()
})

// ---------- start ----------
const demo = new OsdDemo($("screen"))

const q = new URLSearchParams(location.search)
let startMsg = ""
if (q.get("from") === "mix") {
  try {
    const h = JSON.parse(localStorage.getItem("osdfonts.handoff"))
    state.font = parseMCM(h.mcm)
    state.name = h.name
    localStorage.removeItem("osdfonts.handoff")
    startMsg = `Loaded ${h.name} from the mixer.`
  } catch {}
} else if (data.fontById.has(q.get("font"))) {
  const f = data.fontById.get(q.get("font"))
  state.font = compose(data, { font: f, mode: q.get("mode") === "tall" ? "tall" : "small" })
  state.name = `${f.id}.mcm`
  startMsg = `Loaded ${f.name} with the stock Betaflight icons.`
}
if (!state.font && loadSaved()) startMsg = "Restored your last session from this browser."
if (!state.font) {
  state.font = data.iconsetById.get("default").glyphs.map((g) => g.slice())
  state.name = "default.mcm"
}
if (q.size) history.replaceState(null, "", location.pathname)
setTool("pencil")
setColor(WHITE)
redrawAll()
status(startMsg || "Draw with the left button; the right button erases to transparent.")
demo.start()
