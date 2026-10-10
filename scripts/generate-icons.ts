import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPng(width: number, height: number, r: number, g: number, b: number): Buffer {
  // Signature PNG
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(2, 9); // Color type 2 (RGB)
  ihdr.writeUInt8(0, 10); // Compression
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines RGBA or RGB (with filter byte 0 at start of each line)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData.writeUInt8(0, rowOffset); // Filter type None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      // Gradient / stylized background
      const distFromCenter = Math.hypot(x - width / 2, y - height / 2);
      const radius = width * 0.42;
      if (distFromCenter < radius) {
        // Cercle central avec couleur d'accent (bleu messagerie)
        rawData.writeUInt8(59, pixelOffset);
        rawData.writeUInt8(130, pixelOffset + 1);
        rawData.writeUInt8(246, pixelOffset + 2);
      } else {
        // Fond sombre PWA
        rawData.writeUInt8(r, pixelOffset);
        rawData.writeUInt8(g, pixelOffset + 1);
        rawData.writeUInt8(b, pixelOffset + 2);
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([length, typeAndData, crc]);
}

const iconsDir = path.resolve(process.cwd(), 'public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Génération de 192x192 et 512x512
const icon192 = createPng(192, 192, 31, 41, 55); // #1f2937
const icon512 = createPng(512, 512, 31, 41, 55);

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), icon192);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), icon512);

console.log('Icônes PWA créées avec succès dans public/icons/ !');
