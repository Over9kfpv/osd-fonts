// "Upload to flight controller" dialog shared by the mixer and the editor.
// Built into the page (no confirm()/alert()), with a backup reminder and a progress bar.

import { FlightController, serialSupported } from "./msp.js"

let dialog

function build() {
  dialog = document.createElement("dialog")
  dialog.className = "upload-dialog"
  dialog.id = "upload-dialog"
  dialog.innerHTML = `
    <form method="dialog">
      <h2>Upload to flight controller</h2>
      <div data-step="confirm">
        <p>This replaces the font stored in your flight controller's OSD chip. Before you start:</p>
        <ul>
          <li>Plug in the flight controller over USB. Connect a battery too if your OSD chip is only powered from it.</li>
          <li>Close Betaflight Configurator and any other app that uses the port.</li>
          <li>If you want to keep your current font, save it from Configurator's Font Manager first.</li>
        </ul>
        <p class="note" data-unsupported hidden>Uploading needs Web Serial, which only Chrome, Edge and Opera on a desktop have. Download the .mcm instead and use Configurator's Font Manager.</p>
        <div class="row"><button value="cancel" class="btn">Cancel</button><button type="button" class="btn accent" data-go>Choose port and upload</button></div>
      </div>
      <div data-step="progress" hidden>
        <p data-status>Connecting…</p>
        <progress max="256" value="0"></progress>
        <div class="row"><button value="close" class="btn" data-close disabled>Close</button></div>
      </div>
    </form>`
  document.body.append(dialog)
}

export function openUploadDialog(getFont) {
  if (!dialog) build()
  const $ = (s) => dialog.querySelector(s)
  const ok = serialSupported()
  $("[data-unsupported]").hidden = ok
  $("[data-go]").disabled = !ok
  $('[data-step="confirm"]').hidden = false
  $('[data-step="progress"]').hidden = true
  $("[data-go]").onclick = async () => {
    $('[data-step="confirm"]').hidden = true
    $('[data-step="progress"]').hidden = false
    const status = $("[data-status]")
    const bar = $("progress")
    const close = $("[data-close]")
    close.disabled = true
    bar.value = 0
    const fc = new FlightController()
    try {
      status.textContent = "Choose the flight controller's port in the browser's list…"
      const api = await fc.connect()
      status.textContent = `Connected (MSP API ${api}). Uploading…`
      await fc.uploadFont(getFont(), (n, total) => {
        bar.value = n
        status.textContent = `Uploading character ${n} of ${total}…`
      })
      status.textContent = "Done. Power-cycle the flight controller (or reboot it) to see the new font."
    } catch (e) {
      status.textContent = e.name === "NotFoundError" ? "No port chosen. Nothing was uploaded." : `Upload stopped: ${e.message}`
    } finally {
      await fc.close()
      close.disabled = false
    }
  }
  dialog.showModal()
}
