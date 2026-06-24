#!/usr/bin/env node
// 이미지 배정 검증: 골드 스펙에서 이미지 제거 → 재배정 → 규칙 준수 확인.
// 규칙: 모든 비-closing 슬라이드 유효 이미지 · ≤2 재사용 · 임팩트 ≤1 · 표지 본문 비재사용 · 의료가운 금지 · 2회째 변형.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignImages } from '../engine/image-assign.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STOCK = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/image-stock.json'), 'utf-8'));
const LIB = path.join(ROOT, 'reference/gold-reference/bg/lib');
const libFiles = new Set(fs.readdirSync(LIB));
let pass = 0, fail = 0;

for (let n = 1; n <= 10; n++) {
  const id = String(n).padStart(2, '0');
  const gold = JSON.parse(fs.readFileSync(path.join(ROOT, `reference/gold-reference/carousel_specs/carousel_${id}.json`), 'utf-8'));
  const skel = JSON.parse(JSON.stringify(gold));
  for (const sl of skel.slides) for (const k of ['image', 'zoom', 'fx', 'fy', 'flip']) delete sl[k];
  const r = assignImages(skel);
  const errs = [];
  const counts = {};
  const cover = r.slides[0].image;
  r.slides.forEach((sl, i) => {
    if (sl.type === 'closing') { if (sl.image) errs.push(`s${i + 1} closing has image`); return; }
    if (!sl.image) { errs.push(`s${i + 1} no image`); return; }
    if (!libFiles.has(sl.image)) errs.push(`s${i + 1} image not in lib: ${sl.image}`);
    if (STOCK.banned.includes(sl.image)) errs.push(`s${i + 1} BANNED: ${sl.image}`);
    counts[sl.image] = (counts[sl.image] || 0) + 1;
    if (i > 0 && sl.type === 'body' && sl.image === cover) errs.push(`s${i + 1} reuses cover in body`);
  });
  for (const [img, c] of Object.entries(counts)) {
    if (c > STOCK.rules.maxReusePerCarousel) errs.push(`${img} used ${c}x (>2)`);
    if (STOCK.highImpact.includes(img) && c > STOCK.rules.highImpactMax) errs.push(`high-impact ${img} used ${c}x (>1)`);
  }
  // 2회째 변형 확인
  const seen = {};
  r.slides.forEach((sl, i) => {
    if (!sl.image || sl.type === 'closing') return;
    if (seen[sl.image]) { const hasVar = ['zoom', 'fx', 'fy', 'flip'].some(k => k in sl); if (!hasVar) errs.push(`s${i + 1} 2nd use of ${sl.image} lacks variant`); }
    seen[sl.image] = true;
  });
  // 골드 대비 겹침 (정보용)
  const goldImgs = gold.slides.map(s => s.image).filter(Boolean);
  const mineImgs = r.slides.map(s => s.image).filter(Boolean);
  const overlap = mineImgs.filter((m, i) => m === goldImgs[i]).length;
  if (errs.length === 0) { pass++; console.log(`  ✓ c${id} OK — ${mineImgs.length} imgs, cover=${cover}, gold-pos overlap ${overlap}/${goldImgs.length}`); }
  else { fail++; console.log(`  ✗ c${id} FAIL:`); errs.forEach(e => console.log('      ' + e)); }
}
console.log(`\n=== image-assign verify: ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
