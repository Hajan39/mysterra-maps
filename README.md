# mysterra-maps

Offline map package of the Czech Republic for the Mysterra geocaching app.

Each release contains:

- `cz.pmtiles` – vector tiles (zoom 0–14) cut from the daily [Protomaps](https://protomaps.com) OpenStreetMap build
- `assets.zip` – Noto Sans glyphs (all ranges) and the Protomaps `light` and `dark` sprites from [basemaps-assets](https://github.com/protomaps/basemaps-assets)
- `manifest.json` – version and sha256 of each file; the app reads `releases/latest/download/manifest.json`

Releases are built by the `Build CZ map package` workflow (monthly, or run it manually).

## Licences

- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the ODbL; tiles produced by Protomaps.
- Fonts: Noto Sans, SIL Open Font License (`fonts/OFL.txt`).
