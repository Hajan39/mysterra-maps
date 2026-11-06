# mysterra-maps

Offline map packages for the Mysterra geocaching app: Czechia and the countries around it (Slovakia, Austria,
Switzerland, Slovenia, Croatia, Hungary, Poland, Germany). The app downloads only the countries the user picks.

Each release contains:

- `<country>.pmtiles` – vector tiles (zoom 0–14, Poland and Germany 0–13) cut from the daily [Protomaps](https://protomaps.com) OpenStreetMap build
- `assets.zip` – Noto Sans glyphs (all ranges) and the Protomaps `light` and `dark` sprites from [basemaps-assets](https://github.com/protomaps/basemaps-assets)
- `manifest.json` – version, sha256 of each file and the regions; the app reads `releases/latest/download/manifest.json`

Releases are built by the `Build map package` workflow (monthly, or run it manually; `only` limits the regions).
Each file is uploaded as soon as it is built; the release is published only once the manifest is in.

## Licences

- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the ODbL; tiles produced by Protomaps.
- Fonts: Noto Sans, SIL Open Font License (`fonts/OFL.txt`).
