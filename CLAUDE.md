# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RailRouter VN — a static PWA (no backend) that shows HCMC Metro (TP. Hồ Chí Minh) routes, stations and exits on a Mapbox GL map, with Vietnamese/English toggle. It's a fork of `cheeaun/railrouter-sg` (the Singapore equivalent), adapted for Vietnam.

**Important**: the `railrouter-sg/` directory at the repo root is the original Singapore project, kept on disk for reference only. It is not tracked by git, uses a different build tool (Parcel, not Vite), and is not part of this app. The real app lives at the repo root (`index.html`, `src/`, `vite.config.js`, `package.json`).

## Commands

```
npm install        # install deps
npm start           # vite dev server on :4567
npm run build       # vite build -> dist/
npm run preview     # preview the production build on :4567
npm run prettier    # prettier --write on src/**/*.json + root *.json (formatting only)
npm run format      # auto-fix [lat,lng]-order (Google) coordinate pairs back to GeoJSON [lon,lat], then npm run prettier
```

There is no lint or test setup in this repo. `npm run prettier` only covers JSON data files (`.prettierrc.json`/`.prettierignore` at the repo root) — it keeps GeoJSON/TopoJSON coordinate pairs like `[lon, lat]` on one line instead of `JSON.stringify(..., null, 2)`'s one-number-per-line output. JS/HTML/CSS are not Prettier-formatted; follow the existing inline-string-template style there instead.

**Pasting coordinates from Google Maps** (which shows `lat, lng`, the opposite of GeoJSON's `[lon, lat]`): paste them in as-is — don't hand-swap — then run `npm run format`. `scripts/fix-coords.cjs` (invoked by that script, before `npm run prettier`) walks every coordinate pair in `lines/*.geo.json`, `stations/*.json`, and `islands/vietnam-islands.geo.json`, and swaps any pair that looks like `[lat, lon]` back to `[lon, lat]`. This is safe specifically for Vietnam because latitude (~5–24) and longitude (~100–118) never overlap, so the correct order can be inferred from magnitude alone — no risk of misreading an already-correct pair. A pair outside both ranges is left untouched with a warning (probably a typo — check it by hand). Deliberately excludes `islands/hoang-sa.json`/`islands/truong-sa.json`: those are TopoJSON arc delta-encoded integers, not real lon/lat, and running this script on them would corrupt the data.

## Architecture

Single-page vanilla JS app (no framework), bundled by Vite. Entry point is `index.html` → `src/index.js`.

- **Map rendering**: Mapbox GL JS (`mapboxgl.accessToken` is hardcoded in `src/index.js`, reused from the SG project). Map is centered on HCMC but `maxBounds` is expanded to cover all of Vietnam so the Hoàng Sa/Trường Sa island layers are reachable.
- **Data files** (`src/`), split per region so each area's data can grow independently:
  - `lines/{tphcm,dongnai,phuquoc}.geo.json` — GeoJSON `LineString` features for rail lines, one FeatureCollection per region. Properties: `id`, `name`, `nameEn`, `color`, `status` (`operational`/`construction`/`planned`), `type` (`mrt`/`lrt` are rendered — see the `rail-lines-layer` filter; `hsr`/`rail` are not), `width`. A line is filed under whichever region it primarily runs through/toward (e.g. `thuthiem-longthanh` and `dongnai-line-1` are filed under `dongnai` since they head to Long Thành/Biên Hòa, even though they originate in HCMC). `thuthiem-longthanh` is split into `thuthiem-longthanh-segment-1`/`-2` (sharing `line: "thuthiem-longthanh"`) — unlike the `dongnai-line-1` split, this one *does* cross files: `-segment-1` (HCMC section) lives in `tphcm.geo.json`, `-segment-2` (Đồng Nai section) lives in `dongnai.geo.json`, matching where each segment's geometry actually falls. `dongnai-line-1` (formerly `line-1-segment-2b`, the HCMC Metro Line 1 extension into Đồng Nai) was deliberately given its own `line`/`id` prefix instead of staying grouped under `line-1` — it's treated as a Đồng Nai-owned line rather than an HCMC Line 1 sub-segment, even though geometrically it continues straight from Line 1's Suối Tiên extension.
  - `stations/{tphcm,dongnai,phuquoc}.json` — GeoJSON `Point` features per station, one FeatureCollection per region (an empty-features file is a valid placeholder, e.g. `dongnai.json` until stations are added there). Properties include `id`, `name`/`nameEn`, `codes` (array of `{line, code}`), `lines`, `status`, and `exits` (array of `{number, name, description, location, status}`). Station building footprints and the exits layer are both derived from this data at runtime in `src/index.js` (not pre-baked).
  - `src/index.js` imports all six files and concatenates their `features` into single in-memory `railData`/`stationsData` FeatureCollections — the map always renders the full combined dataset; the region selector (see below) only moves the camera. When adding a new region, create both a `lines/<region>.geo.json` and `stations/<region>.json` file (even if stations starts empty) and add the import + spread in `src/index.js`.
  - `islands/hoang-sa.json` and `islands/truong-sa.json` — TopoJSON (GADM) polygons for the Paracel and Spratly islands, converted to GeoJSON at runtime via `topojson-client`. `islands/vietnam-islands.geo.json` — point features for smaller islands not covered by the GADM polygons. These render Vietnam's claimed territorial islands on the map; treat this as deliberate, not incidental, when editing map content.
  - Line/station colors and Vietnamese line names are duplicated as inline lookup objects inside `src/index.js` (`lineColors`, `lineNamesVi`/`lineNamesEn`) rather than read from the GeoJSON — keep these in sync if you add a line.
- **i18n** (`src/i18n.js`): plain object-based translation table (`vi`/`en`), no library. Current language is read from `localStorage['railrouter-lang']`. `t(key)` looks up the active language with a `vi` fallback. `updateTranslations()` in `src/index.js` re-applies `data-i18n`/`data-i18n-html` attributes in the DOM and calls `updateMapLabels()` to switch Mapbox `text-field` expressions between `name`/`nameEn` for stations, islands and archipelago labels. When adding UI text, add it to both language blocks in `translations` and reference it with `data-i18n`/`data-i18n-html` in `index.html` or via `t()` in JS.
- **Search**: Fuse.js fuzzy search over `stationsData.features`, keyed on `properties.name`/`nameEn`/`code` (key order flips depending on active language). Triggered from `#search-field`; results render via `showAllStations()`/the `oninput` handler, both producing the same `<li onclick="selectStation(...)">` markup. `selectStation` is attached to `window` since it's invoked from inline `onclick` HTML.
- **Station/exit detail panel**: `#station` sheet is populated by `showStationInfo()`/`showExitInfo()`, which build HTML strings with inline styles directly in JS (not componentized — follow the existing string-template style rather than introducing a templating layer).
- **Service worker** (`src/sw.js`, Workbox-based) is currently disabled — registration is commented out at the bottom of `src/index.js`.
- **Deployment**: `.github/workflows/deploy.yml` builds with `npm run build` and deploys `dist/` to GitHub Pages via `actions/deploy-pages`. `vite.config.js` sets `base: '/railrouter-vn/'` only for production builds (`mode === 'production'`), so dev (`npm start`) serves from `/`.

## Working with map/route data

Most historical commits are small, incremental edits to line geometry or station data (e.g. "Update line 1", "Update line 2"). When editing a file under `lines/` or `stations/`, keep `name`/`nameEn` pairs and `codes`/`lines` consistent across the matching line/station files for the same `id`, since the app cross-references them by `id` rather than by array position — and a station's `lines` entries must point at a line `id` that actually exists in one of the `lines/*.geo.json` files.

- `phuquoc-lrt` (LRT sân bay Phú Quốc – Trung tâm Hội nghị APEC, in `lines/phuquoc.geo.json`) has a `geometryConfidence: "approximate"` property — its coordinates were interpolated from public reporting (ĐT.975 corridor, station Km markers), not an official survey/GIS file. Verify against an authoritative source before treating it as accurate, and update station names once the unnamed S2/S3/S4-S5 stations are officially announced.

## Region selector

`#region-select` (top-left, next to the logo) lets the user reframe the camera to one of two presets defined in `regionBounds` in `src/index.js`: `tphcm` (HCMC + sáp nhập Bình Dương + Bà Rịa-Vũng Tàu — its bounds also cover Đồng Nai, since the urban area is contiguous and there's no separate "Đồng Nai"/"vùng đô thị" preset) and `phuquoc`. Selecting one calls `map.fitBounds()` — it's camera-only, not a data filter; all lines/stations stay loaded regardless of which preset is selected (including the `dongnai` line/station data files — they just don't get their own camera shortcut). The bounds are rough framing boxes, not administrative-boundary-accurate polygons.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **railrouter-vn** (175 symbols, 252 relationships, 3 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "master"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/railrouter-vn/context` | Codebase overview, check index freshness |
| `gitnexus://repo/railrouter-vn/clusters` | All functional areas |
| `gitnexus://repo/railrouter-vn/processes` | All execution flows |
| `gitnexus://repo/railrouter-vn/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
