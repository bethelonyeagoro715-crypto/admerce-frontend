// scripts/clear-logo-bg.mjs
// Removes the white background from a PNG by flood-filling from the four
// corners. Interior whites (arcs, letter fills) are preserved because they
// aren't connected to the outer background.
//
// Usage:
//   node scripts/clear-logo-bg.mjs                                     # default: admerce_symbol.png
//   node scripts/clear-logo-bg.mjs public/icons/icon-512x512.png       # any path

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2] || 'public/admerce_symbol.png';

if (!fs.existsSync(src)) {
  console.error(`File not found: ${src}`);
  process.exit(1);
}

const ext = path.extname(src);
const backup = src.replace(ext, `.backup${ext}`);
fs.copyFileSync(src, backup);
console.log(`Backed up → ${backup}`);

const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;

function isNearWhite(x, y) {
  const i = (y * width + x) * channels;
  return data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
}

const queue = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
const seen = new Uint8Array(width * height);
let cleared = 0;

while (queue.length) {
  const [x, y] = queue.pop();
  if (x < 0 || y < 0 || x >= width || y >= height) continue;
  const p = y * width + x;
  if (seen[p]) continue;
  if (!isNearWhite(x, y)) continue;
  seen[p] = 1;
  data[p * channels + 3] = 0;
  cleared++;
  queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

const out = await sharp(data, { raw: { width, height, channels } })
  .png()
  .toBuffer();

fs.writeFileSync(src, out);
console.log(`Done. Cleared ${cleared} background pixels on ${src}`);