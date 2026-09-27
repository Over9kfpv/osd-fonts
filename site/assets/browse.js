import { compose, fileName, loadData } from "./compose.js"
import { download, serializeMCM } from "./mcm.js"
import { OsdDemo, drawSample } from "./osd-demo.js"

const $ = (id) => document.getElementById(id)
const data = await loadData()
const fonts = data.fonts
const label = (f) => f.name
const state = { font: fonts.find((f) => f.id === "ibm-vga-8x16") ?? fonts[0], mode: "tall", sort: "score", group: "featured", q: "" }

try {
  const saved = JSON.parse(localStorage.getItem("osdfonts.browse") || "{}")
  if (data.fontById.has(saved.font)) state.font = data.fontById.get(saved.font)
  if (saved.mode === "small") state.mode = "small"
  if (saved.sort === "name") state.sort = "name"
  if (["featured", "pc", "vault", "demoscene", "all"].includes(saved.group)) state.group = saved.group
} catch {}
const deepLink = decodeURIComponent(location.hash.slice(1)) || new URLSearchParams(location.search).get("font")
if (data.fontById.has(deepLink)) {
  state.font = data.fontById.get(deepLink)
  if (!state.font.featured) state.group = "all"
}
const save = () => {
  try {
    localStorage.setItem("osdfonts.browse", JSON.stringify({ font: state.font.id, mode: state.mode, sort: state.sort, group: state.group }))
  } catch {}
}

const composed = (font) => compose(data, { font, mode: state.mode })
const inGroup = (f) => state.group === "all" || (state.group === "featured" ? f.featured : f.collection === state.group)
const matches = (f) => !state.q || `${f.name} ${f.id} ${f.author ?? ""}`.toLowerCase().includes(state.q)
const ordered = () =>
  fonts.filter((f) => inGroup(f) && matches(f)).sort(state.sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.score - a.score)

$("n-fonts").textContent = fonts.length

// ---- demo
const demo = new OsdDemo($("screen"), { craft: $("craft").value })
$("craft").addEventListener("input", (e) => demo.setCraft(e.target.value))

// ---- gallery (cards are drawn lazily as they scroll into view)
const grid = $("grid")
const lazy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue
    const card = e.target
    lazy.unobserve(card)
    drawSample(card.querySelector("canvas"), composed(data.fontById.get(card.dataset.id)), ["ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "0123456789.:-"])
  }
}, { rootMargin: "400px" })

function buildGrid() {
  grid.textContent = ""
  lazy.disconnect()
  const list = ordered()
  for (const font of list) {
    const b = document.createElement("button")
    b.type = "button"
    b.className = "card"
    b.dataset.id = font.id
    const c = document.createElement("canvas")
    c.width = 156
    c.height = 54
    const partial = Object.keys(font.glyphs).length < 45
    b.innerHTML = `<div class="name"></div><div class="foot"><span class="score" title="Shape match with the stock Betaflight letters"><i><b style="width:${Math.min(100, Math.round((font.score / 0.6) * 100))}%"></b></i>${font.score.toFixed(2)}</span><span class="row" style="gap:4px"><span class="chip">${font.size}</span>${partial ? '<span class="chip">Partial</span>' : ""}</span></div>`
    b.prepend(c)
    b.querySelector(".name").textContent = label(font)
    b.addEventListener("click", () => {
      select(font)
      document.querySelector(".demo").scrollIntoView({ behavior: demo.reduced ? "auto" : "smooth" })
    })
    grid.append(b)
    lazy.observe(b)
  }
  $("g-count").textContent = list.length ? `${list.length} of ${fonts.length} fonts. Click one to try it on the OSD.` : ""
  if (!list.length) grid.innerHTML = '<p class="empty">No fonts match. Try another collection or search term.</p>'
  markCurrent()
}
const markCurrent = () => grid.querySelectorAll(".card").forEach((c) => c.setAttribute("aria-current", c.dataset.id === state.font.id))

// ---- controls
const sel = $("font")
function fillSelect() {
  sel.textContent = ""
  const list = ordered()
  if (!list.includes(state.font)) list.unshift(state.font)
  for (const f of list) sel.add(new Option(label(f), f.id))
  sel.value = state.font.id
}

function select(font) {
  state.font = font
  sel.value = font.id
  save()
  history.replaceState(null, "", `#${font.id}`)
  demo.setFont(composed(font))
  const mode = font.native ? "native size" : state.mode === "tall" ? "tall" : "1:1"
  $("cap-font").textContent = `${font.name} · ${mode}`
  $("mode-note").hidden = !font.native
  document.querySelector(".seg").style.opacity = font.native ? 0.45 : 1
  $("m-size").textContent = `${font.size} px` + (font.native ? " (native)" : state.mode === "tall" ? " → doubled" : " (1:1)")
  $("m-license").textContent = font.license
  $("m-author").textContent = font.author ?? "Unknown"
  $("m-score").textContent = font.score.toFixed(3)
  $("to-mix").href = `mix.html?font=${font.id}&mode=${state.mode}`
  $("to-edit").href = `editor.html?font=${font.id}&mode=${state.mode}`
  $("to-page").href = `f/${font.id}.html`
  markCurrent()
}

function setMode(mode) {
  state.mode = mode
  $("mode-tall").setAttribute("aria-pressed", mode === "tall")
  $("mode-small").setAttribute("aria-pressed", mode === "small")
  save()
  buildGrid()
  select(state.font)
}

sel.addEventListener("change", () => select(data.fontById.get(sel.value)))
const step = (d) => {
  const list = ordered()
  if (!list.length) return
  const i = list.indexOf(state.font)
  select(list[(i + d + list.length) % list.length])
}
$("prev").addEventListener("click", () => step(-1))
$("next").addEventListener("click", () => step(1))
$("mode-tall").addEventListener("click", () => setMode("tall"))
$("mode-small").addEventListener("click", () => setMode("small"))
$("sort").addEventListener("change", (e) => {
  state.sort = e.target.value
  save()
  fillSelect()
  buildGrid()
})
$("group").addEventListener("change", (e) => {
  state.group = e.target.value
  save()
  fillSelect()
  buildGrid()
})
$("search").addEventListener("input", (e) => {
  state.q = e.target.value.trim().toLowerCase()
  fillSelect()
  buildGrid()
})
$("download").addEventListener("click", () => {
  const suffix = state.font.native ? "" : `-${state.mode}`
  download(`${fileName(state.font.id)}${suffix}.mcm`, serializeMCM(composed(state.font)))
})

$("sort").value = state.sort
$("group").value = state.group
$("mode-tall").setAttribute("aria-pressed", state.mode === "tall")
$("mode-small").setAttribute("aria-pressed", state.mode === "small")
fillSelect()
buildGrid()
select(state.font)
demo.start()
