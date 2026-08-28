import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const width = 1280;
const height = 800;
const targets = ['chromium', 'firefox'];
const glyphs = {
  A: '011101000110001111111000110001', B: '111101000111110100011000111110',
  C: '011111000010000100001000001111', D: '111101000110001100011000111110',
  E: '111111000011110100001000011111', I: '111110010000100001000010011111',
  G: '011111000010000101111000101111', K: '100011001011100100101000110001',
  L: '100001000010000100001000011111', O: '011101000110001100011000101110',
  P: '111101000110001111101000010000',
  R: '111101000110001111101001010001', S: '011111000001110000011000111110',
  T: '111110010000100001000010000100', V: '100011000110001010100101000100',
  X: '100010101000100001000101010001', Y: '100010101000100001000010000100',
  ' ': '000000000000000000000000000000', '-': '000000000000000111110000000000',
};

function parseOutDir(args) {
  if (args.length !== 2 || args[0] !== '--out-dir' || args[1] === undefined) {
    throw new Error('usage: generate-store-assets.mjs --out-dir <path>');
  }
  return resolve(repoRoot, args[1]);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return result;
}

function fillRect(pixels, box) {
  for (let row = Math.max(0, box.y); row < Math.min(height, box.y + box.height); row += 1) {
    for (let column = Math.max(0, box.x); column < Math.min(width, box.x + box.width); column += 1) {
      const offset = (row * width + column) * 4;
      pixels.set(box.color, offset);
    }
  }
}

function drawText(pixels, label) {
  let cursor = label.x;
  for (const character of label.text) {
    const glyph = glyphs[character] ?? glyphs[' '];
    for (let index = 0; index < glyph.length; index += 1) {
      if (glyph[index] === '1') fillRect(pixels, { color: label.color, height: label.scale, width: label.scale, x: cursor + (index % 5) * label.scale, y: label.y + Math.floor(index / 5) * label.scale });
    }
    cursor += 6 * label.scale;
  }
}

function screenshot(target) {
  const pixels = Buffer.alloc(width * height * 4);
  const dark = target === 'chromium' ? [18, 38, 55, 255] : [35, 22, 68, 255];
  fillRect(pixels, { color: dark, height, width, x: 0, y: 0 });
  for (let row = 0; row < height; row += 8) {
    fillRect(pixels, { color: [dark[0] + 4, dark[1] + 5, dark[2] + 6, 255], height: 4, width, x: 0, y: row });
  }
  fillRect(pixels, { color: [246, 248, 250, 255], height: 616, width: 1080, x: 100, y: 92 });
  fillRect(pixels, { color: [255, 255, 255, 255], height: 472, width: 420, x: 164, y: 164 });
  fillRect(pixels, { color: [225, 235, 239, 255], height: 128, width: 484, x: 632, y: 164 });
  fillRect(pixels, { color: [225, 235, 239, 255], height: 128, width: 484, x: 632, y: 324 });
  fillRect(pixels, { color: [86, 157, 139, 255], height: 152, width: 484, x: 632, y: 484 });
  drawText(pixels, { color: [18, 38, 55, 255], scale: 7, text: 'RATATOSKR', x: 184, y: 212 });
  drawText(pixels, { color: [18, 38, 55, 255], scale: 6, text: 'SAVE PAGE', x: 204, y: 340 });
  drawText(pixels, { color: [18, 38, 55, 255], scale: 7, text: 'EXPLICIT', x: 680, y: 205 });
  drawText(pixels, { color: [18, 38, 55, 255], scale: 7, text: 'PRIVATE', x: 680, y: 365 });
  drawText(pixels, { color: [255, 255, 255, 255], scale: 10, text: 'SAVE', x: 786, y: 530 });
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let row = 0; row < height; row += 1) pixels.copy(scanlines, row * (width * 4 + 1) + 1, row * width * 4, (row + 1) * width * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function write(path, asset) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, asset.bytes);
  asset.written.push(path);
}

const outDir = parseOutDir(process.argv.slice(2));
const listing = JSON.parse(readFileSync(join(repoRoot, 'store/listing.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(repoRoot, 'src/manifests/base.json'), 'utf8'));
if (JSON.stringify(listing.permissions) !== JSON.stringify(manifest.permissions)) throw new Error('listing permission claims differ from manifest');
rmSync(outDir, { recursive: true, force: true });
const written = [];
for (const target of targets) {
  const localeDir = join(outDir, target, listing.locale);
  write(join(localeDir, 'description.txt'), { bytes: Buffer.from(`${listing.description.join('\n\n')}\n`), written });
  write(join(localeDir, 'screenshots/01-explicit-capture.png'), { bytes: screenshot(target), written });
  const metadata = target === 'firefox' ? { categories: listing.categories, summary: { 'en-US': listing.summary }, version: { license: listing.license } } : { name: listing.name, summary: listing.summary };
  write(join(localeDir, 'metadata.json'), { bytes: Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`), written });
}
const sums = written.map((path) => `${createHash('sha256').update(readFileSync(path)).digest('hex')}  ${relative(outDir, path).replaceAll('\\', '/')}`).sort().join('\n');
writeFileSync(join(outDir, 'SHA256SUMS'), `${sums}\n`);
console.log(`generated ${written.length} deterministic store assets in ${outDir}`);
