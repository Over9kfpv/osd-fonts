// Simulated analog FPV feed with a Betaflight-style OSD drawn from any 256-glyph font.
// PAL grid: 30 columns x 16 rows of 12x18 characters = 360x288.

import { CH, CW, TRANSPARENT, WHITE } from "./mcm.js"

const W = 360
const H = 288

/** Draw one glyph into ImageData (transparent pixels skipped). */
export function putGlyph(img, glyph, col, row) {
  const d = img.data
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const v = glyph[y * CW + x]
      if (v === TRANSPARENT) continue
      const px = col * CW + x
      const py = row * CH + y
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue
      const i = (py * img.width + px) * 4
      const c = v === WHITE ? 255 : 0
      d[i] = d[i + 1] = d[i + 2] = c
      d[i + 3] = 255
    }
  }
}

export function putText(img, font, s, col, row) {
  for (let i = 0; i < s.length; i++) putGlyph(img, font[s.charCodeAt(i) & 255], col + i, row)
}

/** Draw a sample of text lines onto a canvas, with a video-ish background. */
export function drawSample(canvas, font, lines, bg = "#3a4856") {
  const cols = Math.max(...lines.map((l) => l.length))
  canvas.width = cols * CW
  canvas.height = lines.length * CH
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  lines.forEach((l, r) => putText(img, font, l, 0, r))
  ctx.putImageData(img, 0, 0)
}

export class OsdDemo {
  constructor(canvas, { craft = "RETRO QUAD" } = {}) {
    this.canvas = canvas
    canvas.width = W
    canvas.height = H
    this.ctx = canvas.getContext("2d")
    this.osd = new OffscreenCanvas(W, H)
    this.octx = this.osd.getContext("2d")
    this.noise = new OffscreenCanvas(W, H)
    this.nctx = this.noise.getContext("2d")
    this.nimg = this.nctx.createImageData(W, H)
    this.font = null
    this.craft = craft
    this.running = false
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    this.frame = this.frame.bind(this)
  }

  setFont(font) {
    this.font = font
    if (!this.running) this.frame(4000)
  }

  setCraft(name) {
    this.craft = name
    if (!this.running) this.frame(4000)
  }

  start() {
    if (this.reduced) return this.frame(4000)
    if (this.running) return
    this.running = true
    requestAnimationFrame(this.frame)
  }

  stop() {
    this.running = false
  }

  frame(t) {
    const roll = 14 * Math.sin(t / 2300) + 5 * Math.sin(t / 700)
    const pitch = 4 * Math.sin(t / 1700)
    this.drawVideo(t, roll, pitch)
    if (this.font) this.drawOsd(t, roll, pitch)
    if (this.running) requestAnimationFrame(this.frame)
  }

  drawVideo(t, roll, pitch) {
    const c = this.ctx
    c.save()
    c.fillStyle = "#6d8aa3"
    c.fillRect(0, 0, W, H)
    const sky = c.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, "#8fa9bf")
    sky.addColorStop(1, "#c9d2d6")
    c.translate(W / 2, H / 2 + pitch * 3)
    c.rotate((-roll * Math.PI) / 180)
    c.fillStyle = sky
    c.fillRect(-W, -H * 1.5, W * 2, H * 1.5)
    c.fillStyle = "#4d5b3a"
    c.fillRect(-W, 0, W * 2, H * 1.5)
    for (let i = 0; i < 14; i++) {
      const z = (i + ((t * 0.0012) % 1)) / 14
      const y = Math.pow(z, 2.2) * H
      c.fillStyle = i % 2 ? "#57663f" : "#46532f"
      c.fillRect(-W, y, W * 2, Math.max(1, y * 0.08))
    }
    c.fillStyle = "#2f3a28"
    for (let x = -W; x < W; x += 9) {
      const h = 4 + ((((x * 7919) % 11) + 11) % 11)
      c.fillRect(x, -h, 8, h)
    }
    c.restore()
    const d = this.nimg.data
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 22
    }
    this.nctx.putImageData(this.nimg, 0, 0)
    c.drawImage(this.noise, 0, 0)
  }

  drawOsd(t, roll, pitch) {
    const f = this.font
    const img = this.octx.createImageData(W, H)
    const secs = Math.floor(t / 1000)
    const volts = (16.4 - (secs % 240) * 0.012).toFixed(1)
    const batt = 0x90 + Math.min(6, Math.floor((secs % 240) / 35))
    const craft = (this.craft || "").toUpperCase().slice(0, 15)
    putText(img, f, "\x01" + "87", 1, 1)
    putText(img, f, "\x7b" + "9", 1, 2)
    putText(img, f, craft, 15 - Math.ceil(craft.length / 2), 1)
    putText(img, f, String.fromCharCode(batt) + volts + "\x06", 23, 1)
    putText(img, f, "\x1e\x1f" + "14", 25, 2)
    putText(img, f, "\x04" + String(40 + Math.round(18 * Math.sin(t / 900))).padStart(3), 1, 13)
    const m = String(Math.floor(secs / 60) % 60).padStart(2, "0")
    const s = String(secs % 60).padStart(2, "0")
    putText(img, f, "\x9c" + m + ":" + s, 23, 13)
    putText(img, f, String(Math.round(420 + 60 * Math.sin(t / 1500))) + "\x07", 1, 14)
    putText(img, f, "\x7f" + (12 + 3 * Math.sin(t / 2000)).toFixed(1) + "\x0c", 23, 14)
    putText(img, f, String(Math.round(48 + 12 * Math.sin(t / 1300))).padStart(3) + "\x9e", 13, 14)
    const heading = 0x60 + (Math.floor(t / 900) % 16)
    putText(img, f, "\x11" + String.fromCharCode(heading) + "86\x0c", 13, 2)
    if (Math.floor(t / 600) % 2 && secs % 20 < 6) putText(img, f, "LOW BATTERY", 10, 11)
    // crosshair, sidebars and horizon bars (9 columns, 1/9-character vertical steps)
    putText(img, f, "\x72\x73\x74", 14, 7)
    putGlyph(img, f[0x13], 10, 7)
    putGlyph(img, f[0x13], 19, 7)
    const rad = (roll * Math.PI) / 180
    for (let x = -4; x <= 4; x++) {
      const y = 7 * 9 + 4 + Math.round(((-Math.tan(rad) * x * 12) / 18) * 9 + pitch * 1.5)
      const row = Math.floor(y / 9)
      const sub = y - row * 9
      if (row >= 3 && row <= 11) putGlyph(img, f[0x80 + sub], 15 + x, row)
    }
    this.octx.putImageData(img, 0, 0)
    this.ctx.drawImage(this.osd, 0, 0)
  }
}
