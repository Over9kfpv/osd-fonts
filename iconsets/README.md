# Icon sets

The `.mcm` files here are the fonts bundled with [Betaflight Configurator](https://github.com/betaflight/betaflight-configurator)
(`resources/osd/2/`, commit `7754ad4e9385a67dd302a084729c58152b6cadfe`), licensed **GPL-3.0**.
The site uses their symbols and logos; a mixed font that contains them is a derivative of these files.

- `iconsets.toml` lists the sets shown on the site.
- `groups.toml` splits the 256 character codes into groups (battery, horizon, arrows, …) for the mixer.
  The codes come from Betaflight's `src/main/drivers/osd_symbols.h`.

To add a set, drop a 256-character `.mcm` here and add an `[[iconset]]` entry.
