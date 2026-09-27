// Boot logo: 288x72 pixels stored in characters 0xA0-0xFF (24 x 4 tiles).
// Image convention used by Betaflight tools: pure green (0,255,0) = transparent, white, black.

import { BLACK, CH, CW, PIXELS, TRANSPARENT, WHITE } from "./mcm.js"

export const LOGO = { start: 0xa0, cols: 24, rows: 4, width: 288, height: 72 }

export function pixelValue(r, g, b, a = 255) {
  if (a < 128 || (r === 0 && g === 255 && b === 0)) return TRANSPARENT
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  if (y > 200) return WHITE
  if (y < 55) return BLACK
  return TRANSPARENT
}

/** RGBA pixels (288x72) → 96 glyphs. */
export function rgbaToLogo(data, width = LOGO.width) {
  const tiles = []
  for (let ty = 0; ty < LOGO.rows; ty++) {
    for (let tx = 0; tx < LOGO.cols; tx++) {
      const g = new Uint8Array(PIXELS)
      for (let y = 0; y < CH; y++) {
        for (let x = 0; x < CW; x++) {
          const i = ((ty * CH + y) * width + tx * CW + x) * 4
          g[y * CW + x] = pixelValue(data[i], data[i + 1], data[i + 2], data[i + 3])
        }
      }
      tiles.push(g)
    }
  }
  return tiles
}

/** Read any browser-decodable image (BMP, PNG, GIF…) of exactly 288x72 into logo glyphs. */
export async function fileToLogo(file) {
  const bmp = await createImageBitmap(file)
  if (bmp.width !== LOGO.width || bmp.height !== LOGO.height) {
    throw new Error(`The logo must be exactly ${LOGO.width}×${LOGO.height} pixels; this image is ${bmp.width}×${bmp.height}.`)
  }
  const c = new OffscreenCanvas(LOGO.width, LOGO.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(bmp, 0, 0)
  return rgbaToLogo(ctx.getImageData(0, 0, LOGO.width, LOGO.height).data)
}

export const logoGlyphs = (font) => font.slice(LOGO.start, LOGO.start + LOGO.cols * LOGO.rows)

/** 24-bit bottom-up BMP of the logo in a font, transparent as pure green. */
export function logoToBMP(font) {
  const { width, height } = LOGO
  const stride = (width * 3 + 3) & ~3
  const size = 54 + stride * height
  const buf = new ArrayBuffer(size)
  const dv = new DataView(buf)
  dv.setUint16(0, 0x4d42, true)
  dv.setUint32(2, size, true)
  dv.setUint32(10, 54, true)
  dv.setUint32(14, 40, true)
  dv.setInt32(18, width, true)
  dv.setInt32(22, height, true)
  dv.setUint16(26, 1, true)
  dv.setUint16(28, 24, true)
  dv.setUint32(34, stride * height, true)
  dv.setInt32(38, 2835, true)
  dv.setInt32(42, 2835, true)
  const px = new Uint8Array(buf)
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * stride
    for (let x = 0; x < width; x++) {
      const gi = LOGO.start + Math.floor(y / CH) * LOGO.cols + Math.floor(x / CW)
      const v = font[gi][(y % CH) * CW + (x % CW)]
      const [r, g, b] = v === WHITE ? [255, 255, 255] : v === BLACK ? [0, 0, 0] : [0, 255, 0]
      px.set([b, g, r], row + x * 3)
    }
  }
  return px
}

/** Draw the assembled logo onto a canvas (transparent pixels left clear). */
export function drawLogo(canvas, font) {
  canvas.width = LOGO.width
  canvas.height = LOGO.height
  const ctx = canvas.getContext("2d")
  const img = ctx.createImageData(LOGO.width, LOGO.height)
  for (let y = 0; y < LOGO.height; y++) {
    for (let x = 0; x < LOGO.width; x++) {
      const gi = LOGO.start + Math.floor(y / CH) * LOGO.cols + Math.floor(x / CW)
      const v = font[gi][(y % CH) * CW + (x % CW)]
      if (v === TRANSPARENT) continue
      const i = (y * LOGO.width + x) * 4
      img.data.fill(v === WHITE ? 255 : 0, i, i + 3)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}
