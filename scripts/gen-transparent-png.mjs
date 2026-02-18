#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function parseArgs(argv) {
  const args = { out: "", width: 512, height: 512 };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--out") {
      args.out = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--size") {
      const raw = argv[i + 1] || "";
      i += 1;
      const match = String(raw).trim().match(/^(\d+)(?:x(\d+))?$/i);
      if (!match) throw new Error(`Invalid --size value "${raw}". Use 512 or 512x512.`);
      args.width = Number.parseInt(match[1], 10);
      args.height = Number.parseInt(match[2] || match[1], 10);
      continue;
    }
  }

  if (!args.out) throw new Error("Missing --out path.");
  if (!Number.isFinite(args.width) || !Number.isFinite(args.height) || args.width <= 0 || args.height <= 0) {
    throw new Error("Invalid image size.");
  }
  return args;
}

function makeCrc32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrc32Table();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const payload = Buffer.concat([typeBuffer, data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(payload), out.length - 4);
  return out;
}

function buildTransparentPng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace

  const rowBytes = (width * 4) + 1; // filter byte + rgba row
  const raw = Buffer.alloc(rowBytes * height, 0);
  for (let y = 0; y < height; y += 1) {
    raw[y * rowBytes] = 0; // filter type none
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", iend),
  ]);
}

function main() {
  const { out, width, height } = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(process.cwd(), out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const png = buildTransparentPng(width, height);
  fs.writeFileSync(outputPath, png);
}

try {
  main();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(`[gen-transparent-png] ${error.message || error}`);
  process.exit(1);
}
