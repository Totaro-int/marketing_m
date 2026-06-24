#!/usr/bin/env node
// 정렬 프로브: 내 렌더를 (dx,dy)로 이동시키며 골드와 MAE 최소가 되는 오프셋을 찾는다.
// 텍스트가 체계적으로 어긋났는지(고칠 수 있음) vs 순수 AA 노이즈(불가피)인지 판별.
// 사용: node scripts/align-probe.mjs <slideFile> [carouselId=1] [range=4]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import canvasPkg from 'canvas';
const { createCanvas, loadImage } = canvasPkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const slide = process.argv[2] || 's2.png';
const cid = String(Number(process.argv[3] || 1)).padStart(2, '0');
const R = Number(process.argv[4] || 4);
const goldP = path.join(ROOT, `reference/gold-reference/cards/carousel_${cid}/${slide}`);
const mineP = path.join(ROOT, `out/carousel_${cid}/${slide}`);
async function rgba(p) { const im = await loadImage(fs.readFileSync(p)); const c = createCanvas(im.width, im.height); const x = c.getContext('2d'); x.drawImage(im, 0, 0); return { w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data }; }
function maeShift(g, m, dx, dy) {
  let sum = 0, n = 0;
  for (let y = 0; y < g.h; y++) {
    const my = y + dy; if (my < 0 || my >= g.h) continue;
    for (let x = 0; x < g.w; x++) {
      const mx = x + dx; if (mx < 0 || mx >= g.w) continue;
      const gi = (y * g.w + x) * 4, mi = (my * g.w + mx) * 4;
      sum += Math.abs(g.d[gi] - m.d[mi]) + Math.abs(g.d[gi + 1] - m.d[mi + 1]) + Math.abs(g.d[gi + 2] - m.d[mi + 2]);
      n += 3;
    }
  }
  return sum / n;
}
const g = await rgba(goldP), m = await rgba(mineP);
let best = { mae: Infinity, dx: 0, dy: 0 };
const base = maeShift(g, m, 0, 0);
for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
  const mae = maeShift(g, m, dx, dy);
  if (mae < best.mae) best = { mae, dx, dy };
}
console.log(`${slide}: base(0,0) MAE=${base.toFixed(3)}  best(dx=${best.dx},dy=${best.dy}) MAE=${best.mae.toFixed(3)}  gain=${(base - best.mae).toFixed(3)}`);
