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
```

There is no lint or test setup in this repo.

## Architecture

Single-page vanilla JS app (no framework), bundled by Vite. Entry point is `index.html` → `src/index.js`.

- **Map rendering**: Mapbox GL JS (`mapboxgl.accessToken` is hardcoded in `src/index.js`, reused from the SG project). Map is centered on HCMC but `maxBounds` is expanded to cover all of Vietnam so the Hoàng Sa/Trường Sa island layers are reachable.
- **Data files** (`src/`):
  - `vn-rail.geo.json` — GeoJSON `LineString` features for metro lines. Properties: `id`, `line`, `name`, `nameEn`, `color`, `status` (`operational`/`construction`/`planned`), `type` (currently only `mrt` is rendered — see the `rail-lines-layer` filter), `width`.
  - `stations.json` — GeoJSON `Point` features per station. Properties include `id`, `name`/`nameEn`, `codes` (array of `{line, code}`), `lines`, `status`, and `exits` (array of `{number, name, description, location, status}`). Station building footprints and the exits layer are both derived from this file at runtime in `src/index.js` (not pre-baked).
  - `islands/hoang-sa.json` and `islands/truong-sa.json` — TopoJSON (GADM) polygons for the Paracel and Spratly islands, converted to GeoJSON at runtime via `topojson-client`. `islands/vietnam-islands.geo.json` — point features for smaller islands not covered by the GADM polygons. These render Vietnam's claimed territorial islands on the map; treat this as deliberate, not incidental, when editing map content.
  - Line/station colors and Vietnamese line names are duplicated as inline lookup objects inside `src/index.js` (`lineColors`, `lineNamesVi`/`lineNamesEn`) rather than read from the GeoJSON — keep these in sync if you add a line.
- **i18n** (`src/i18n.js`): plain object-based translation table (`vi`/`en`), no library. Current language is read from `localStorage['railrouter-lang']`. `t(key)` looks up the active language with a `vi` fallback. `updateTranslations()` in `src/index.js` re-applies `data-i18n`/`data-i18n-html` attributes in the DOM and calls `updateMapLabels()` to switch Mapbox `text-field` expressions between `name`/`nameEn` for stations, islands and archipelago labels. When adding UI text, add it to both language blocks in `translations` and reference it with `data-i18n`/`data-i18n-html` in `index.html` or via `t()` in JS.
- **Search**: Fuse.js fuzzy search over `stationsData.features`, keyed on `properties.name`/`nameEn`/`code` (key order flips depending on active language). Triggered from `#search-field`; results render via `showAllStations()`/the `oninput` handler, both producing the same `<li onclick="selectStation(...)">` markup. `selectStation` is attached to `window` since it's invoked from inline `onclick` HTML.
- **Station/exit detail panel**: `#station` sheet is populated by `showStationInfo()`/`showExitInfo()`, which build HTML strings with inline styles directly in JS (not componentized — follow the existing string-template style rather than introducing a templating layer).
- **Service worker** (`src/sw.js`, Workbox-based) is currently disabled — registration is commented out at the bottom of `src/index.js`.
- **Deployment**: `.github/workflows/deploy.yml` builds with `npm run build` and deploys `dist/` to GitHub Pages via `actions/deploy-pages`. `vite.config.js` sets `base: '/railrouter-vn/'` only for production builds (`mode === 'production'`), so dev (`npm start`) serves from `/`.

## Working with map/route data

Most historical commits are small, incremental edits to line geometry or station data (e.g. "Update line 1", "Update line 2"). When editing `vn-rail.geo.json` or `stations.json`, keep `name`/`nameEn` pairs and `codes`/`lines` consistent across both files for the same station/line `id`, since the app cross-references them by `id` rather than by array position.

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
