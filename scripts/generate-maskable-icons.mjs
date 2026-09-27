// scripts/generate-maskable-icons.mjs
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC = resolve(ROOT, 'public');

const BG = { r: 0x05, g: 0x04, b: 0xaa, alpha: 1 };
const MASKABLE_SAFE_RATIO = 0.8;
const ANY_RATIO = 0.9;

const SOURCES = [
  resolve(PUBLIC, 'admerce_symbol.png'),
  resolve(PUBLIC, 'icons/icon-512x512.png'),
  resolve(PUBLIC, 'android-chrome-512x512.png'),
];

function findSource() {
  for (const p of SOURCES) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function whiten(buf) {
  const meta = await sharp(buf).metadata();
  const width = meta.width ?? 512;
  const height = meta.height ?? 512;
  const hasAlpha = meta.hasAlpha;

  console.log(`    source: ${width}x${height}, hasAlpha=${hasAlpha}`);

  let maskBuf;
  if (hasAlpha) {
    console.log('    path: ALPHA channel (transparent logo detected)');
    maskBuf = await sharp(buf).ensureAlpha().extractChannel('alpha').toBuffer();
  } else {
    console.log('    path: LUMINANCE threshold (opaque logo detected)');
    maskBuf = await sharp(buf).greyscale().negate().toBuffer();
  }

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function makeIcon(sourcePath, size, ratio, outPath) {
  const inner = Math.round(size * ratio);
  console.log(`  ${size}x${size} → ${outPath.split(/[\\/]/).pop()}`);

  const sourceBuf = await sharp(sourcePath).toBuffer();
  const whiteLogo = await whiten(sourceBuf);
  const scaled = await sharp(whiteLogo)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: scaled, gravity: 'center' }])
    .png()
    .toFile(outPath);

  console.log(`    ✓ done`);
}

const source = findSource();
if (!source) {
  console.error('❌ No source logo found. Expected one of:');
  SOURCES.forEach((p) => console.error('  ' + p));
  process.exit(1);
}

console.log('📥 Source:', source);
console.log('');

mkdirSync(PUBLIC, { recursive: true });

await makeIcon(source, 192, MASKABLE_SAFE_RATIO, resolve(PUBLIC, 'maskable-192.png'));
await makeIcon(source, 512, MASKABLE_SAFE_RATIO, resolve(PUBLIC, 'maskable-512.png'));

await makeIcon(source, 192, ANY_RATIO, resolve(PUBLIC, 'android-chrome-192x192.png'));
await makeIcon(source, 512, ANY_RATIO, resolve(PUBLIC, 'android-chrome-512x512.png'));

await makeIcon(source, 180, ANY_RATIO, resolve(PUBLIC, 'apple-touch-icon.png'));
await makeIcon(source, 180, ANY_RATIO, resolve(PUBLIC, 'apple-touch-icon-180x180.png'));
await makeIcon(source, 167, ANY_RATIO, resolve(PUBLIC, 'apple-touch-icon-167x167.png'));
await makeIcon(source, 152, ANY_RATIO, resolve(PUBLIC, 'apple-touch-icon-152x152.png'));

console.log('\n✅ Done. Open public/maskable-512.png to verify it looks right.');