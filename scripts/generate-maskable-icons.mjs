// scripts/generate-maskable-icons.mjs
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { mkdirSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { tmpdir } from 'os';

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

async function alphaIsMeaningful(buf) {
  const meta = await sharp(buf).metadata();
  if (!meta.hasAlpha) return false;

  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .resize(32, 32, { fit: 'fill' })
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true });

  let transparentPixels = 0;
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < 200) transparentPixels++;
  }
  return transparentPixels / total > 0.05;
}

async function whiten(buf) {
  const meta = await sharp(buf).metadata();
  const width = meta.width ?? 512;
  const height = meta.height ?? 512;

  const useAlpha = await alphaIsMeaningful(buf);
  let maskBuf;
  if (useAlpha) {
    maskBuf = await sharp(buf).ensureAlpha().extractChannel('alpha').toBuffer();
  } else {
    maskBuf = await sharp(buf)
      .greyscale()
      .linear(2.0, -100)
      .threshold(100)
      .toBuffer();
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

  console.log(`  ✓ ${outPath.split(/[\\/]/).pop()}`);
}

async function makeFavicons(sourcePath) {
  console.log('\n🎨 Favicons');

  // 16, 32, 48 — resized copies of the source, transparency preserved.
  // No filter — keeps whatever color the source logo already is.
  const sizes = [16, 32, 48];
  const tmpFiles = [];

  for (const size of sizes) {
    const out = resolve(PUBLIC, `favicon-${size}x${size}.png`);
    await sharp(sourcePath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(out);
    console.log(`  ✓ favicon-${size}x${size}.png`);
  }

  // Multi-resolution ICO — modern browsers + Windows taskbar pinning.
  // png-to-ico wants file paths, so we materialize 16/32/48 first.
  for (const size of sizes) {
    const tmp = resolve(tmpdir(), `admerce-favicon-${size}.png`);
    await sharp(sourcePath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(tmp);
    tmpFiles.push(tmp);
  }

  const icoBuf = await pngToIco(tmpFiles);
  const icoPath = resolve(PUBLIC, 'favicon.ico');
  writeFileSync(icoPath, icoBuf);
  console.log(`  ✓ favicon.ico`);

  // Clean up temp files
  for (const f of tmpFiles) {
    try {
      unlinkSync(f);
    } catch {}
  }
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

await makeFavicons(source);

console.log('\n✅ Done.');