#!/usr/bin/env node
// PWA 用アイコン PNG を依存ゼロ（Node 標準の zlib のみ）で生成する。
// 緑背景＋白い時計（外輪＋長針/短針＋中心ドット）。iOS は角丸マスクを自前で当てるので全面塗り（不透明）。
// 出力：public/icon-512.png / icon-192.png / apple-touch-icon.png(180)
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const PUB = path.join(__dirname, 'public');

const BG = [10, 125, 50];   // #0a7d32（display と同じ緑）
const W = [255, 255, 255];

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8bit, RGBA
  // 行ごとに filter=0 を前置
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0;
    rgba.copy(raw, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay; const wx = px - ax, wy = py - ay;
  const c1 = vx * wx + vy * wy; if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy; if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const t = c1 / c2; return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function drawIcon(size) {
  const ss = 4; // スーパーサンプリング（簡易アンチエイリアス）
  const c = size / 2;
  const R = size * 0.40, T = size * 0.052;
  const mTip = [c, c - size * 0.30], mW = size * 0.030;            // 長針（真上＝12時）
  const hTip = [c + size * 0.20 * 0.866, c - size * 0.20 * 0.5], hW = size * 0.036; // 短針（2時方向）
  const dot = size * 0.05;
  const sample = (x, y) => {
    const r = Math.hypot(x - c, y - c);
    if (r <= R && r >= R - T) return W;
    if (segDist(x, y, c, c, mTip[0], mTip[1]) <= mW) return W;
    if (segDist(x, y, c, c, hTip[0], hTip[1]) <= hW) return W;
    if (r <= dot) return W;
    return BG;
  };
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const col = sample(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss);
      r += col[0]; g += col[1]; b += col[2];
    }
    const n = ss * ss, i = (y * size + x) * 4;
    rgba[i] = Math.round(r / n); rgba[i + 1] = Math.round(g / n); rgba[i + 2] = Math.round(b / n); rgba[i + 3] = 255;
  }
  return encodePNG(size, rgba);
}

for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(PUB, name), drawIcon(size));
  console.log('✓ public/' + name + ' (' + size + 'x' + size + ')');
}
