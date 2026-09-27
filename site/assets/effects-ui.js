// Letter-edge controls shared by Browse and Mix: style, direction pad, colours.
import { DIRECTIONS, normalizeEffect } from "./compose.js"

const STYLES = [
  ["outline", "Outline"],
  ["shadow", "Shadow"],
  ["bevel", "Bevel"],
  ["none", "None"],
]
const PAD = ["nw", "n", "ne", "w", null, "e", "sw", "s", "se"]
const ARROW = { nw: "↖", n: "↑", ne: "↗", w: "←", e: "→", sw: "↙", s: "↓", se: "↘" }
const NAME = { nw: "up-left", n: "up", ne: "up-right", w: "left", e: "right", sw: "down-left", s: "down", se: "down-right" }

/**
 * Build the controls inside `root` and call onChange(effect) whenever they change.
 * Returns { set(effect) } to update the controls from outside.
 */
export function effectControls(root, initial, onChange) {
  let fx = normalizeEffect(initial)
  root.innerHTML = `
    <div class="seg fx-style" role="group" aria-label="Letter edge"></div>
    <div class="fx-row">
      <div class="dirpad" role="group" aria-label="Shadow direction"></div>
      <div class="seg fx-colour" role="group" aria-label="Letter colour">
        <button type="button" data-invert="0">White letters</button>
        <button type="button" data-invert="1">Black letters</button>
      </div>
    </div>`
  const styleSeg = root.querySelector(".fx-style")
  for (const [value, label] of STYLES) {
    const b = document.createElement("button")
    b.type = "button"
    b.dataset.style = value
    b.textContent = label
    b.onclick = () => update({ style: value })
    styleSeg.append(b)
  }
  const pad = root.querySelector(".dirpad")
  for (const d of PAD) {
    const b = document.createElement("button")
    b.type = "button"
    if (d) {
      b.dataset.dir = d
      b.textContent = ARROW[d]
      b.setAttribute("aria-label", `Shadow ${NAME[d]}`)
      b.onclick = () => update({ dir: d })
    } else {
      b.className = "centre"
      b.disabled = true
      b.setAttribute("aria-hidden", "true")
      b.textContent = "A"
    }
    pad.append(b)
  }
  for (const b of root.querySelectorAll("[data-invert]")) b.onclick = () => update({ invert: b.dataset.invert === "1" })

  function paint() {
    for (const b of styleSeg.children) b.setAttribute("aria-pressed", b.dataset.style === fx.style)
    const directional = fx.style === "shadow" || fx.style === "bevel"
    pad.classList.toggle("off", !directional)
    for (const b of pad.querySelectorAll("[data-dir]")) {
      b.setAttribute("aria-pressed", b.dataset.dir === fx.dir)
      b.disabled = !directional
    }
    for (const b of root.querySelectorAll("[data-invert]")) b.setAttribute("aria-pressed", (b.dataset.invert === "1") === fx.invert)
  }
  function update(change) {
    fx = normalizeEffect({ ...fx, ...change })
    paint()
    onChange(fx)
  }
  paint()
  return {
    set(e) {
      fx = normalizeEffect(e)
      paint()
    },
  }
}

/** Short tag for file names: "" for the default outline, otherwise e.g. "shadow-se" or "bevel-nw-inv". */
export function effectTag(e) {
  const fx = normalizeEffect(e)
  if (fx.style === "outline" && !fx.invert) return ""
  const parts = [fx.style]
  if (fx.style === "shadow" || fx.style === "bevel") parts.push(fx.dir)
  if (fx.invert) parts.push("inv")
  return parts.join("-")
}

export { DIRECTIONS }
