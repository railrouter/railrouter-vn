#!/usr/bin/env node
// Auto-corrects coordinate pairs pasted in Google's [lat, lng] order back to
// GeoJSON's required [lon, lat] order. Safe for Vietnam because the two value
// ranges never overlap (lat ~5-24, lon ~100-118), so the order can be inferred
// from magnitude alone instead of having to trust how the pair was typed in.
//
// Only walks plain GeoJSON Point/LineString coordinate arrays. TopoJSON files
// (islands/hoang-sa.json, islands/truong-sa.json) store arc delta-encoded
// integers, not real lon/lat — they must stay out of this script's file list.

const fs = require('fs');
const path = require('path');

const VN_LAT_RANGE = [5, 24];
const VN_LON_RANGE = [100, 118];

const TARGET_FILES = [
  ...listFiles('src/lines', '.geo.json'),
  ...listFiles('src/stations', '.json'),
  'src/islands/vietnam-islands.geo.json',
];

function listFiles(dir, suffix) {
  const abs = path.join(__dirname, '..', dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(suffix))
    .map((f) => path.join(dir, f));
}

function inRange(n, [min, max]) {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

let totalSwapped = 0;
let totalAmbiguous = 0;

function fixCoordinatePairs(node, fileLabel) {
  if (Array.isArray(node)) {
    const isPair =
      node.length === 2 && typeof node[0] === 'number' && typeof node[1] === 'number';
    if (isPair) {
      const [a, b] = node;
      const looksLikeLatLon = inRange(a, VN_LAT_RANGE) && inRange(b, VN_LON_RANGE);
      const looksLikeLonLat = inRange(a, VN_LON_RANGE) && inRange(b, VN_LAT_RANGE);
      if (looksLikeLatLon && !looksLikeLonLat) {
        node[0] = b;
        node[1] = a;
        totalSwapped++;
        console.log(`  swapped [${a}, ${b}] -> [${node[0]}, ${node[1]}]  (${fileLabel})`);
      } else if (!looksLikeLatLon && !looksLikeLonLat) {
        totalAmbiguous++;
        console.warn(`  WARNING: [${a}, ${b}] is outside Vietnam's lat/lon bounds, left as-is  (${fileLabel})`);
      }
      return;
    }
    node.forEach((child) => fixCoordinatePairs(child, fileLabel));
    return;
  }
  if (node && typeof node === 'object') {
    Object.values(node).forEach((child) => fixCoordinatePairs(child, fileLabel));
  }
}

TARGET_FILES.forEach((relPath) => {
  const abs = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(abs)) return;
  const before = totalSwapped;
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  fixCoordinatePairs(data.features ?? data, relPath);
  // Only rewrite files that actually changed — re-serializing an untouched
  // file would still normalize harmless things like `9.0` -> `9`, creating
  // diff noise unrelated to this script's job.
  if (totalSwapped > before) {
    fs.writeFileSync(abs, JSON.stringify(data, null, 2) + '\n');
  }
});

console.log(`\nDone: ${totalSwapped} pair(s) swapped, ${totalAmbiguous} ambiguous pair(s) left untouched.`);
console.log('Run `npm run prettier` afterwards to re-apply Prettier spacing.');
