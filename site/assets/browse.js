import "./theme.js"
import { compose, fileName, isPublicDomain, loadData } from "./compose.js"
import { download, serializeMCM } from "./mcm.js"
import { OsdDemo, drawSample } from "./osd-demo.js"

const $ = (id) => document.getElementById(id)
const data = await loadData()
const fonts = data.fonts

// ---- facets: every value is measured from the glyphs at build time (osdfont/traits.py)
const FACETS = [
  { key: "size", label: "Letter size", field: "sizeClass", values: [
    ["tiny", "Tiny", "5–6 px"], ["small", "Small", "7–8 px"], ["medium", "Medium", "9–11 px"], ["large", "Large", "12+ px"]] },
  { key: "weight", label: "Stroke", field: "weight", values: [
    ["thin", "Thin", "1 px"], ["bold", "Bold", "2 px"], ["heavy", "Heavy", "3 px+"]] },
  { key: "license", label: "License", field: "licenseGroup", values: [
    ["public-domain", "Public domain"], ["credit", "Free, with credit"], ["share-alike", "Share-alike"], ["unknown", "Unknown"]] },
  { key: "source", label: "Source", field: "collection", values: [
    ["pc", "IBM PC ROM"], ["vault", "Terminal & game"], ["cc0", "OpenGameArt"], ["demoscene", "Demoscene"]] },
]
const SOURCE = { pc: "IBM PC ROM", vault: "Terminal & game", cc0: "CC0 · OpenGameArt", demoscene: "Demoscene" }

const state = {
  font: data.fontById.get("ibm-vga-8x16") ?? fonts[0],
  mode: "small",
  icons: "default",
  sort: "score",
  picks: true,
  groupAlike: true,
  family: null,
  q: "",
  filters: Object.fromEntries(FACETS.map((f) => [f.key, new Set()])),
}

try {
  const saved = JSON.parse(localStorage.getItem("osdfonts.browse") || "{}")
  if (data.fontById.has(saved.font)) state.font = data.fontById.get(saved.font)
  if (saved.mode === "tall") state.mode = "tall"
  if (saved.sort === "name") state.sort = "name"
  if (data.iconsetById.has(saved.icons)) state.icons = saved.icons
  if (typeof saved.picks === "boolean") state.picks = saved.picks
  if (typeof saved.groupAlike === "boolean") state.groupAlike = saved.groupAlike
  for (const f of FACETS) for (const v of saved.filters?.[f.key] ?? []) if (f.values.some(([x]) => x === v)) state.filters[f.key].add(v)
} catch {}
const deepLink = decodeURIComponent(location.hash.slice(1)) || new URLSearchParams(location.search).get("font")
if (data.fontById.has(deepLink)) {
  state.font = data.fontById.get(deepLink)
  if (!state.font.featured) state.picks = false
}

const save = () => {
  try {
    localStorage.setItem("osdfonts.browse", JSON.stringify({
      font: state.font.id, mode: state.mode, sort: state.sort, icons: state.icons, picks: state.picks,
      groupAlike: state.groupAlike, filters: Object.fromEntries(FACETS.map((f) => [f.key, [...state.filters[f.key]]])),
    }))
  } catch {}
}

// ---- filtering
const matchesSearch = (f) => !state.q || `${f.name} ${f.id} ${f.author ?? ""} ${f.license}`.toLowerCase().includes(state.q)
function passes(f, skip = null) {
  if (state.picks && !f.featured) return false
  if (state.family && f.family !== state.family) return false
  if (!matchesSearch(f)) return false
  for (const facet of FACETS) {
    if (facet.key === skip) continue
    const set = state.filters[facet.key]
    if (set.size && !set.has(f[facet.field])) return false
  }
  return true
}
const bySort = (a, b) => (state.sort === "name" ? a.name.localeCompare(b.name) : b.score - a.score || a.name.localeCompare(b.name))
const matching = () => fonts.filter((f) => passes(f)).sort(bySort)

/** Cards to show: one per family unless grouping is off or one family is open. */
function cards() {
  const list = matching()
  if (!state.groupAlike || state.family) return list.map((f) => ({ font: f, alike: 0 }))
  const byFamily = new Map()
  for (const f of list) {
    const entry = byFamily.get(f.family)
    if (!entry) byFamily.set(f.family, { font: f, alike: 0 })
    else {
      entry.alike++
      if (f.familyLead) entry.font = f // show the family's namesake when it passes the filters
    }
  }
  return [...byFamily.values()]
}

// ---- facet chips with live counts
const facetsEl = $("facets")
function chip(label, count, pressed, onClick, hint = "") {
  const b = document.createElement("button")
  b.type = "button"
  b.className = "chip"
  b.setAttribute("aria-pressed", pressed)
  b.innerHTML = `${label}${hint ? `<span class="hint">(${hint})</span>` : ""}${count === null ? "" : `<span class="n">${count}</span>`}`
  b.onclick = onClick
  return b
}
function facetRow(label) {
  const row = document.createElement("div")
  row.className = "facet"
  row.innerHTML = `<span class="label"></span><div class="chips" role="group"></div>`
  row.querySelector(".label").textContent = label
  row.querySelector(".chips").setAttribute("aria-label", label)
  facetsEl.append(row)
  return row.querySelector(".chips")
}
function buildFacets() {
  facetsEl.textContent = ""
  const show = facetRow("Show")
  for (const [picks, label] of [[true, "Our picks"], [false, "All fonts"]]) {
    const n = fonts.filter((f) => !picks || f.featured).length
    show.append(chip(label, n, state.picks === picks, () => {
      state.picks = picks
      refresh()
    }))
  }
  if (state.family) {
    const lead = data.fontById.get(state.family)
    const b = chip(`Look-alikes of ${lead.name} ✕`, null, true, () => {
      state.family = null
      refresh()
    })
    b.setAttribute("aria-label", `Stop showing look-alikes of ${lead.name}`)
    show.append(b)
  }
  for (const facet of FACETS) {
    const row = facetRow(facet.label)
    const pool = fonts.filter((f) => passes(f, facet.key))
    for (const [value, label, hint] of facet.values) {
      const n = pool.filter((f) => f[facet.field] === value).length
      const on = state.filters[facet.key].has(value)
      const b = chip(label, n, on, () => {
        on ? state.filters[facet.key].delete(value) : state.filters[facet.key].add(value)
        refresh()
      }, hint)
      b.disabled = !n && !on
      row.append(b)
    }
  }
  $("clear").hidden = !(FACETS.some((f) => state.filters[f.key].size) || state.q || state.family)
}

// ---- demo
const demo = new OsdDemo($("screen"), { craft: $("craft").value })
$("craft").addEventListener("input", (e) => demo.setCraft(e.target.value))
const composed = (font) => compose(data, { font, mode: state.mode, base: state.icons })

// ---- gallery (card previews are drawn as they scroll into view)
const grid = $("grid")
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
  const list = cards()
  for (const { font, alike } of list) {
    const card = document.createElement("article")
    card.className = "card"
    card.dataset.id = font.id
    card.dataset.collection = font.collection
    const partial = Object.keys(font.glyphs).length < 45
    card.innerHTML = `
      <button type="button" class="card-main">
        <span class="card-label"><span class="cat"></span><canvas width="156" height="54"></canvas></span>
        <span class="card-body"><span class="h3"></span><span class="by"></span></span>
      </button>
      <div class="card-foot">
        ${alike ? `<button type="button" class="alike">+${alike} look-alike${alike > 1 ? "s" : ""}</button>` : `<span class="open">Try it on the OSD →</span>`}
        <span class="dl">${font.height} px · ${font.weight}${partial ? " · partial" : ""}</span>
      </div>`
    card.querySelector(".cat").textContent = SOURCE[font.collection]
    card.querySelector(".h3").textContent = font.name
    card.querySelector(".by").textContent = [font.author, font.license].filter(Boolean).join(" · ")
    const main = card.querySelector(".card-main")
    main.setAttribute("aria-label", `Try ${font.name} on the OSD`)
    main.addEventListener("click", () => {
      select(font)
      document.querySelector(".goggle").scrollIntoView({ behavior: demo.reduced ? "auto" : "smooth", block: "center" })
    })
    card.querySelector(".alike")?.addEventListener("click", () => {
      state.family = font.family
      refresh()
      document.getElementById("fonts").scrollIntoView({ behavior: demo.reduced ? "auto" : "smooth" })
    })
    grid.append(card)
    lazy.observe(card)
  }
  const n = matching().length
  $("g-count").textContent = !n
    ? ""
    : list.length < n
      ? `${n} fonts on ${list.length} cards: near-identical fonts share a card.`
      : `${n} font${n > 1 ? "s" : ""}. Letters only; every OSD symbol stays intact.`
  if (!list.length) grid.innerHTML = '<p class="empty">No fonts match. Remove a filter or switch to All fonts.</p>'
  markCurrent()
}
const markCurrent = () => grid.querySelectorAll(".card").forEach((c) => c.setAttribute("aria-current", c.dataset.id === state.font.id))

// ---- demo controls
const sel = $("font")
function fillSelect() {
  sel.textContent = ""
  const list = matching()
  if (!list.includes(state.font)) list.unshift(state.font)
  for (const f of list) sel.add(new Option(f.name, f.id))
  sel.value = state.font.id
}
function refresh() {
  save()
  buildFacets()
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
  $("pd-note").hidden = !(isPublicDomain(font.license) && isPublicDomain(data.iconsetById.get(state.icons).license))
  $("to-mix").href = `mix.html?font=${font.id}${state.mode === "tall" ? "&mode=tall" : ""}&icons=${state.icons}`
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
  refresh()
}

for (const s of data.iconsets) $("icons").add(new Option(s.name + (isPublicDomain(s.license) ? " (public domain)" : ""), s.id))
$("icons").value = state.icons
$("icons").addEventListener("change", (e) => {
  state.icons = e.target.value
  save()
  buildGrid()
  select(state.font)
})
sel.addEventListener("change", () => select(data.fontById.get(sel.value)))
const step = (d) => {
  const list = matching()
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
  if (state.q) state.picks = false // searching looks through everything
  refresh()
})
$("group-alike").checked = state.groupAlike
$("group-alike").addEventListener("change", (e) => {
  state.groupAlike = e.target.checked
  refresh()
})
$("clear").addEventListener("click", () => {
  for (const f of FACETS) state.filters[f.key].clear()
  state.family = null
  state.q = ""
  $("search").value = ""
  refresh()
})
$("download").addEventListener("click", () => {
  const suffix = (state.font.native || state.mode === "small" ? "" : "-tall") + (state.icons === "default" ? "" : `-${state.icons}`)
  download(`${fileName(state.font.id)}${suffix}.mcm`, serializeMCM(composed(state.font)))
})

$("n-fonts").textContent = fonts.length
$("mode-small").setAttribute("aria-pressed", state.mode === "small")
$("mode-tall").setAttribute("aria-pressed", state.mode === "tall")
$("sort-score").setAttribute("aria-pressed", state.sort === "score")
$("sort-name").setAttribute("aria-pressed", state.sort === "name")
refresh()
select(state.font)
demo.start()
