// Light / dark switch in the header, like Stickbeats. The saved choice is applied
// by a one-line script in each page's <head> so the page never flashes.
const root = document.documentElement
const isDark = () => root.dataset.theme === "dark" || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches)
const SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>'
const MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'

const top = document.querySelector(".top")
if (top && !top.querySelector(".mode")) {
  const b = document.createElement("button")
  b.className = "mode"
  b.type = "button"
  b.setAttribute("aria-label", "Switch light or dark mode")
  const paint = () => (b.innerHTML = isDark() ? SUN : MOON)
  b.onclick = () => {
    root.dataset.theme = isDark() ? "light" : "dark"
    try {
      localStorage.setItem("osdf-theme", root.dataset.theme)
    } catch {}
    paint()
  }
  paint()
  top.append(b)
}
