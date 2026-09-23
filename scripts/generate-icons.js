import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // Minimal PNG generator
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    // Simple CRC32
    const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // Generate image scanlines
  // Each scanline begins with filter byte 0
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      // Gradient effect
      const factor = (x + y) / (width + height);
      const pr = Math.round(r * (1 - factor * 0.3));
      const pg = Math.round(g * (1 - factor * 0.2 + factor * 0.3));
      const pb = Math.round(b);
      rawData[pxOffset] = pr;
      rawData[pxOffset + 1] = pg;
      rawData[pxOffset + 2] = pb;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Standard CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

fs.writeFileSync('./public/pwa-192x192.png', createPNG(192, 192, 14, 165, 233));
fs.writeFileSync('./public/pwa-512x512.png', createPNG(512, 512, 14, 165, 233));
fs.writeFileSync('./public/pwa-maskable-512x512.png', createPNG(512, 512, 37, 99, 235));
fs.writeFileSync('./public/apple-touch-icon.png', createPNG(180, 180, 14, 165, 233));
console.log('Icons created successfully');
