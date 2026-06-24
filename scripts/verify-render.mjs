#!/usr/bin/env node
// 검증 하네스: out/carousel_NN 렌더 결과를 골드 카드와 픽셀 비교.
// 사용: node scripts/verify-render.mjs [carouselId=1]
//   골드: reference/gold-reference/cards/carousel_NN/sX.png
//   내것: out/carousel_NN/sX.png
//   출력: out/diff/carousel_NN/sX_diff.png + 콘솔 표(불일치% + MAE)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import canvasPkg from 'canvas';
import pixelmatch from 'pixelmatch';
import { renderSpecToDir } from '../engine/render.mjs';
const { createCanvas, loadImage } = canvasPkg;
const loadImg = (p) => loadImage(fs.readFileSync(p)); // Buffer load (Win 비ASCII 경로 회피)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const cid = Number(process.argv[2] || 1);
const id2 = String(cid).padStart(2, '0');
const goldDir = path.join(ROOT, `reference/gold-reference/cards/carousel_${id2}`);
const goldSpecPath = path.join(ROOT, `reference/gold-reference/carousel_specs/carousel_${id2}.json`);
let mineDir = path.join(ROOT, `out/carousel_${id2}`); // 골드 스펙 없을 때 폴백
const diffDir = path.join(ROOT, `out/diff/carousel_${id2}`);
fs.mkdirSync(diffDir, { recursive: true });

async function rgba(p) {
  const img = await loadImg(p);
  const c = createCanvas(img.width, img.height); const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
}

function listSlides(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^s\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
}

async function main() {
  // 골드 스펙을 갓 렌더 → 전용 dir(out/_goldverify). 데일리/수동 렌더가 out/carousel_NN 을 덮어써도 앵커 불변.
  if (fs.existsSync(goldSpecPath)) {
    const spec = JSON.parse(fs.readFileSync(goldSpecPath, 'utf-8'));
    const r = await renderSpecToDir(spec, path.join(ROOT, 'out', '_goldverify'));
    mineDir = r.out;
  } else {
    console.log(`(골드 스펙 없음 → 기존 ${path.relative(ROOT, mineDir)} 비교)`);
  }
  const slides = listSlides(goldDir);
  if (!slides.length) { console.error('no gold slides at', goldDir); process.exit(1); }
  console.log(`\n=== verify carousel_${id2} (${slides.length} slides) ===`);
  console.log('slide   dims        diff%      MAE   status');
  let totalDiffPct = 0, totalMae = 0, n = 0, worst = { pct: -1, slide: null };
  for (const f of slides) {
    const gp = path.join(goldDir, f), mp = path.join(mineDir, f);
    if (!fs.existsSync(mp)) { console.log(`${f.padEnd(7)} MISSING (not rendered)`); continue; }
    const g = await rgba(gp), m = await rgba(mp);
    if (g.w !== m.w || g.h !== m.h) {
      console.log(`${f.padEnd(7)} DIM MISMATCH gold ${g.w}x${g.h} vs mine ${m.w}x${m.h}`);
      continue;
    }
    const out = Buffer.alloc(g.w * g.h * 4);
    const mismatch = pixelmatch(g.data, m.data, out, g.w, g.h, { threshold: 0.1, includeAA: false });
    const pct = (mismatch / (g.w * g.h)) * 100;
    // MAE over RGB
    let sum = 0; const d1 = g.data, d2 = m.data;
    for (let i = 0; i < d1.length; i += 4) { sum += Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]); }
    const mae = sum / (g.w * g.h * 3);
    // write diff image
    const dc = createCanvas(g.w, g.h); const dctx = dc.getContext('2d');
    const idata = dctx.createImageData(g.w, g.h); idata.data.set(out); dctx.putImageData(idata, 0, 0);
    fs.writeFileSync(path.join(diffDir, f.replace('.png', '_diff.png')), dc.toBuffer('image/png'));
    const status = pct < 1 ? 'OK' : pct < 5 ? 'close' : pct < 15 ? 'off' : 'BAD';
    console.log(`${f.padEnd(7)} ${(g.w + 'x' + g.h).padEnd(11)} ${pct.toFixed(2).padStart(6)}%  ${mae.toFixed(2).padStart(6)}   ${status}`);
    totalDiffPct += pct; totalMae += mae; n++;
    if (pct > worst.pct) worst = { pct, slide: f };
  }
  if (n) {
    console.log('-----------------------------------------------');
    console.log(`avg     ${''.padEnd(11)} ${(totalDiffPct / n).toFixed(2).padStart(6)}%  ${(totalMae / n).toFixed(2).padStart(6)}`);
    console.log(`worst: ${worst.slide} @ ${worst.pct.toFixed(2)}%`);
    console.log(`diffs → ${diffDir}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
