// Upload a font to a Betaflight flight controller over Web Serial (MSP v1).
// Matches Betaflight Configurator (src/js/utils/osdFont.js): one MSP_OSD_CHAR_WRITE per character,
// payload = [character index] + the character's 54 bytes, each acknowledged before the next.

import { GLYPHS, glyphToBytes } from "./mcm.js"

export const MSP_API_VERSION = 1
export const MSP_OSD_CHAR_WRITE = 87

/** "$M<" size code payload checksum; checksum = XOR of size, code and payload. */
export function encodeMsp(code, payload = []) {
  const out = new Uint8Array(6 + payload.length)
  out.set([0x24, 0x4d, 0x3c, payload.length, code])
  out.set(payload, 5)
  let crc = payload.length ^ code
  for (const b of payload) crc ^= b
  out[out.length - 1] = crc
  return out
}

/** Incremental parser for "$M>" (reply) and "$M!" (error) frames. */
export class MspParser {
  constructor(onFrame) {
    this.onFrame = onFrame
    this.buf = []
  }
  push(bytes) {
    for (const b of bytes) this.buf.push(b)
    for (;;) {
      const start = this.buf.indexOf(0x24)
      if (start < 0) return void (this.buf = [])
      if (start > 0) this.buf.splice(0, start)
      if (this.buf.length < 6) return
      if (this.buf[1] !== 0x4d || (this.buf[2] !== 0x3e && this.buf[2] !== 0x21)) {
        this.buf.shift()
        continue
      }
      const size = this.buf[3]
      if (this.buf.length < 6 + size) return
      const frame = this.buf.splice(0, 6 + size)
      const code = frame[4]
      const payload = frame.slice(5, 5 + size)
      let crc = size ^ code
      for (const b of payload) crc ^= b
      this.onFrame({ code, payload, error: frame[2] === 0x21, crcOk: crc === frame[5 + size] })
    }
  }
}

export const serialSupported = () => typeof navigator !== "undefined" && "serial" in navigator

export class FlightController {
  constructor() {
    this.port = null
    this.reader = null
    this.waiting = new Map()
    this.parser = new MspParser((f) => this.handle(f))
  }

  async connect() {
    if (!serialSupported()) throw new Error("This browser can't talk to serial ports. Use Chrome or Edge on a desktop computer.")
    this.port = await navigator.serial.requestPort()
    await this.port.open({ baudRate: 115200 })
    this.readLoop()
    const v = await this.request(MSP_API_VERSION, [], 1500).catch(() => null)
    if (!v) throw new Error("The flight controller didn't answer. Close Betaflight Configurator and any CLI session, then try again.")
    this.apiVersion = `${v[1]}.${v[2]}`
    return this.apiVersion
  }

  async readLoop() {
    while (this.port?.readable) {
      this.reader = this.port.readable.getReader()
      try {
        for (;;) {
          const { value, done } = await this.reader.read()
          if (done) break
          this.parser.push(value)
        }
      } catch {
        break
      } finally {
        this.reader.releaseLock()
      }
    }
  }

  handle({ code, payload, error, crcOk }) {
    const w = this.waiting.get(code)
    if (!w) return
    this.waiting.delete(code)
    clearTimeout(w.timer)
    if (error) w.reject(new Error(`The flight controller rejected command ${code}.`))
    else if (!crcOk) w.reject(new Error("Garbled reply from the flight controller."))
    else w.resolve(payload)
  }

  async request(code, payload = [], timeout = 1000) {
    const writer = this.port.writable.getWriter()
    const reply = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(code)
        reject(new Error("Timed out waiting for the flight controller."))
      }, timeout)
      this.waiting.set(code, { resolve, reject, timer })
    })
    try {
      await writer.write(encodeMsp(code, payload))
    } finally {
      writer.releaseLock()
    }
    return reply
  }

  /** Write all 256 characters; retries each one twice before giving up. */
  async uploadFont(font, onProgress = () => {}) {
    for (let i = 0; i < GLYPHS; i++) {
      const payload = [i, ...glyphToBytes(font[i])]
      for (let attempt = 0; ; attempt++) {
        try {
          await this.request(MSP_OSD_CHAR_WRITE, payload, 1000)
          break
        } catch (e) {
          if (attempt >= 2) throw new Error(`Character ${i} failed: ${e.message}`)
        }
      }
      onProgress(i + 1, GLYPHS)
    }
  }

  async close() {
    try {
      await this.reader?.cancel()
    } catch {}
    try {
      await this.port?.close()
    } catch {}
    this.port = null
  }
}
