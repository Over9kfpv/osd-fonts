import "./theme.js"
import { compose, fileName, loadData } from "./compose.js"
import { download, serializeMCM } from "./mcm.js"
import { OsdDemo, drawSample } from "./osd-demo.js"

const $ = (id) => document.getElementById(id)
const data = await loadData()
const fonts = data.fonts
const GROUPS = [
  ["featured", "Shortlist"],
  ["pc", "IBM PC ROM"],
  ["vault", "Terminal & game"],
  ["demoscene", "Demoscene"],
  ["all", "All"],
]
const inGroupOf = (g, f) => g === "all" || (g === "featured" ? f.featured : f.collection === g)
const state = { font: data.fontById.get("ibm-vga-8x16") ?? fonts[0], mode: "small", sort: "score", group: "featured", q: "" }

try {
  const saved = JSON.parse(localStorage.getItem("osdfonts.browse") || "{}")
  if (data.fontById.has(saved.font)) state.font = data.fontById.get(saved.font)
  if (saved.mode === "tall") state.mode = "tall"
  if (saved.sort === "name") state.sort = "name"
  if (GROUPS.some(([g]) => g === saved.group)) state.group = saved.group
} catch {}
const deepLink = decodeURIComponent(location.hash.slice(1)) || new URLSearchParams(location.search).get("font")
if (data.fontById.has(deepLink)) {
  state.font = data.fontById.get(deepLink)
  if (!inGroupOf(state.group, state.font)) state.group = "all"
}
const save = () => {
  try {
    localStorage.setItem("osdfonts.browse", JSON.stringify({ font: state.font.id, mode: state.mode, sort: state.sort, group: state.group }))
  } catch {}
}

const composed = (font) => compose(data, { font, mode: state.mode })
const matches = (f) => !state.q || `${f.name} ${f.id} ${f.author ?? ""}`.toLowerCase().includes(state.q)
const ordered = () =>
  fonts
    .filter((f) => inGroupOf(state.group, f) && matches(f))
    .sort(state.sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.score - a.score)

$("n-fonts").textContent = fonts.length

// ---- collection chips
const chips = $("groups")
for (const [g, label] of GROUPS) {
  const b = document.createElement("button")
  b.type = "button"
  b.className = "chip"
  b.dataset.group = g
  b.innerHTML = `${label}<span class="n">${fonts.filter((f) => inGroupOf(g, f)).length}</span>`
  b.addEventListener("click", () => {
    state.group = g
    save()
    refreshList()
  })
  chips.append(b)
}
const markChips = () => chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.group === state.group))

// ---- demo
const demo = new OsdDemo($("screen"), { craft: $("craft").value })
$("craft").addEventListener("input", (e) => demo.setCraft(e.target.value))

// ---- gallery (card previews are drawn as they scroll into view)
const grid = $("grid")
const COLLECTION = { pc: "IBM PC ROM", vault: "Terminal & game", demoscene: "Demoscene" }
const lazy = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      lazy.unobserve(e.target)
      drawSample(e.target.querySelector("canvas"), composed(data.fontById.get(e.target.dataset.id)), ["ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "0123456789.:-"], "transparent")
    }
  },
  { rootMargin: "400px" },
)

function buildGrid() {
  grid.textContent = ""
  lazy.disconnect()
  const list = ordered()
  for (const font of list) {
    const b = document.createElement("button")
    b.type = "button"
    b.className = "card"
    b.dataset.id = font.id
    b.dataset.collection = font.collection
    const partial = Object.keys(font.glyphs).length < 45
    b.innerHTML = `
      <div class="card-label"><span class="cat"></span><canvas width="156" height="54"></canvas></div>
      <div class="card-body">
        <h3></h3>
        <p class="by"></p>
        <div class="card-foot"><span class="open">Try it on the OSD →</span><span class="dl">${font.size}${partial ? " · partial" : ""}</span></div>
      </div>`
    b.querySelector(".cat").textContent = COLLECTION[font.collection]
    b.querySelector("h3").textContent = font.name
    b.querySelector(".by").textContent = [font.author, font.license].filter(Boolean).join(" · ")
    b.addEventListener("click", () => {
      select(font)
      document.querySelector(".goggle").scrollIntoView({ behavior: demo.reduced ? "auto" : "smooth", block: "center" })
    })
    grid.append(b)
    lazy.observe(b)
  }
  $("g-count").textContent = list.length ? `${list.length} fonts. Letters only; every OSD symbol stays intact.` : ""
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
  for (const f of list) sel.add(new Option(f.name, f.id))
  sel.value = state.font.id
}
function refreshList() {
  markChips()
  fillSelect()
  buildGrid()
}

function select(font) {
  state.font = font
  sel.value = font.id
  save()
  history.replaceState(null, "", `#${font.id}`)
  demo.setFont(composed(font))
  const mode = font.native ? "native size" : state.mode === "tall" ? "tall" : "1:1"
  $("cap-font").textContent = `${font.name} · ${mode}`
  $("cap-meta").textContent = `${font.size} px · ${font.license}`
  $("mode-note").hidden = !font.native
  $("mode-small").disabled = $("mode-tall").disabled = font.native
  $("to-mix").href = `mix.html?font=${font.id}${state.mode === "tall" ? "&mode=tall" : ""}`
  $("to-edit").href = `editor.html?font=${font.id}${state.mode === "tall" ? "&mode=tall" : ""}`
  $("to-page").href = `f/${font.id}.html`
  markCurrent()
}

function setMode(mode) {
  state.mode = mode
  $("mode-small").setAttribute("aria-pressed", mode === "small")
  $("mode-tall").setAttribute("aria-pressed", mode === "tall")
  save()
  buildGrid()
  select(state.font)
}
function setSort(sort) {
  state.sort = sort
  $("sort-score").setAttribute("aria-pressed", sort === "score")
  $("sort-name").setAttribute("aria-pressed", sort === "name")
  save()
  refreshList()
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
$("mode-small").addEventListener("click", () => setMode("small"))
$("mode-tall").addEventListener("click", () => setMode("tall"))
$("sort-score").addEventListener("click", () => setSort("score"))
$("sort-name").addEventListener("click", () => setSort("name"))
$("search").addEventListener("input", (e) => {
  state.q = e.target.value.trim().toLowerCase()
  fillSelect()
  buildGrid()
})
$("download").addEventListener("click", () => {
  const suffix = state.font.native || state.mode === "small" ? "" : "-tall"
  download(`${fileName(state.font.id)}${suffix}.mcm`, serializeMCM(composed(state.font)))
})

$("mode-small").setAttribute("aria-pressed", state.mode === "small")
$("mode-tall").setAttribute("aria-pressed", state.mode === "tall")
$("sort-score").setAttribute("aria-pressed", state.sort === "score")
$("sort-name").setAttribute("aria-pressed", state.sort === "name")
refreshList()
select(state.font)
demo.start()
