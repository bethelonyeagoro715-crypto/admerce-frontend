// scripts/generate-maskable-icons.mjs
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC = resolve(ROOT, 'public');

const BG = { r: 0x05, g: 0x04, b: 0xaa, alpha: 1 };
const SAFE_RATIO = 0.8;

// Source candidates, in preference order. The first one that exists wins.
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

// Force a source image into a solid white silhouette.
async function whiten(buf) {
  const { width, height } = await sharp(buf).metadata();
  // Pull the alpha channel (if any). If no alpha, use luminance as a mask.
  const hasAlpha = (await sharp(buf).metadata()).hasAlpha;

  let maskBuf;
  if (hasAlpha) {
    maskBuf = await sharp(buf)
      .ensureAlpha()
      .extractChannel('alpha')
      .toBuffer();
  } else {
    // Use inverted luminance: dark pixels become opaque, light pixels become
    // transparent. This assumes the mark is darker than the background.
    maskBuf = await sharp(buf)
      .greyscale()
      .negate()
      .toBuffer();
  }

  // Composite a white layer through the mask.
  return sharp({
    create: {
      width: width ?? 512,
      height: height ?? 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function makeMaskable(sourcePath, size, outPath) {
  const inner = Math.round(size * SAFE_RATIO);
  const sourceBuf = await sharp(sourcePath).toBuffer();
  const whiteLogo = await whiten(sourceBuf);
  const scaled = await sharp(whiteLogo)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: scaled, gravity: 'center' }])
    .png()
    .toFile(outPath);

  console.log(`✅ ${outPath}`);
}

const source = findSource();
if (!source) {
  console.error(
    '❌ No source logo found. Expected one of:\n' +
      SOURCES.map((p) => `   ${p}`).join('\n'),
  );
  process.exit(1);
}

console.log(`📥 Source: ${source}`);
mkdirSync(PUBLIC, { recursive: true });

await makeMaskable(source, 192, resolve(PUBLIC, 'maskable-192.png'));
await makeMaskable(source, 512, resolve(PUBLIC, 'maskable-512.png'));

console.log('\nDone. Reinstall the PWA to see the new splash.');