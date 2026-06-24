#!/usr/bin/env node
// 이미지 배정 — IMAGE_STOCK 규칙으로 슬라이드별 배경 배정.
// 규칙: 캐러셀당 동일 이미지 ≤2(2회째 변형) · 임팩트 이미지 ≤1 · 표지 본문 비재사용 · 의료가운 금지.
// 사용: node engine/image-assign.mjs <specPath> [--out file]  (이미지 없는 스펙 → 배정)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STOCK = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/image-stock.json'), 'utf-8'));
const LIB = path.join(ROOT, 'reference/gold-reference/bg/lib');
const libFiles = new Set(fs.existsSync(LIB) ? fs.readdirSync(LIB) : []);

const isHighImpact = (img) => STOCK.highImpact.includes(img);
const exists = (img) => libFiles.size === 0 || libFiles.has(img) || libFiles.has(path.basename(img));

// 후보가 배정 가능한가 (재사용·임팩트·금지·표지 규칙)
function canUse(img, { counts, coverImg, isBody }) {
  if (STOCK.banned.includes(img)) return false;
  if (isBody && STOCK.rules.coverNotReusedInBody && img === coverImg) return false;
  const c = counts[img] || 0;
  if (isHighImpact(img) && c >= STOCK.rules.highImpactMax) return false;
  if (c >= STOCK.rules.maxReusePerCarousel) return false;
  return true;
}

export function assignImages(spec, { variantPresets = STOCK.variantPresets } = {}) {
  const topic = STOCK.perTopic[String(spec.id)] || { cover: STOCK.fillPriority[0], body: [] };
  const counts = {};
  const out = JSON.parse(JSON.stringify(spec));
  let vi = 0; // variant preset index
  const coverImg = topic.cover;

  // 채움 후보 순서: 토픽 body 풀 → fillPriority → dataPlates (overused/banned 후순위)
  const fillOrder = [...topic.body, ...STOCK.fillPriority, ...STOCK.dataPlates]
    .filter((v, i, a) => a.indexOf(v) === i);

  const pick = (pref, ctx) => {
    // 선호 후보(pref 배열) 중 사용 가능한 첫 항목, 없으면 fillOrder, 없으면 2회 변형 허용 후보
    for (const img of [...pref, ...fillOrder]) if (exists(img) && canUse(img, ctx)) return img;
    // 마지막: 변형 2회째라도 가능한 것 (임팩트/표지 제외)
    for (const img of fillOrder) {
      if (!exists(img) || STOCK.banned.includes(img)) continue;
      if (ctx.isBody && img === ctx.coverImg) continue;
      if (isHighImpact(img)) continue;
      if ((counts[img] || 0) < STOCK.rules.maxReusePerCarousel) return img;
    }
    return STOCK.fillPriority.find(exists) || STOCK.fillPriority[0];
  };

  const place = (sl, img) => {
    const second = (counts[img] || 0) >= 1;
    sl.image = img;
    if (second && STOCK.rules.secondUseNeedsVariant) {
      const v = variantPresets[vi % variantPresets.length]; vi++;
      Object.assign(sl, v);
    }
    counts[img] = (counts[img] || 0) + 1;
    // 밝은 배경 이미지는 body에서 A/B 모드 권장 (C면 A로 보정)
    if (sl.type === 'body' && STOCK.brightBg.includes(img) && (sl.mode === 'C' || !sl.mode)) sl.mode = 'A';
    return sl;
  };

  out.slides.forEach((sl, i) => {
    if (sl.type === 'closing') return;
    const isCover = sl.type === 'cover_stmt' || sl.type === 'cover_data';
    if (isCover && i === 0) { place(sl, coverImg); return; }
    if (sl.type === 'cover_data') { place(sl, pick([...STOCK.dataPlates], { counts, coverImg, isBody: false })); return; }
    place(sl, pick(topic.body, { counts, coverImg, isBody: true }));
  });
  out._imageCounts = counts;
  return out;
}

// ---- CLI ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sp = process.argv[2];
  if (!sp) { console.error('usage: image-assign.mjs <specPath> [--out file]'); process.exit(2); }
  const spec = JSON.parse(fs.readFileSync(sp, 'utf-8'));
  // 배정 전 이미지/변형 제거
  for (const sl of spec.slides) for (const k of ['image', 'zoom', 'fx', 'fy', 'flip']) delete sl[k];
  const res = assignImages(spec);
  const oi = process.argv.indexOf('--out');
  if (oi >= 0) { fs.writeFileSync(process.argv[oi + 1], JSON.stringify(res, null, 2)); console.log('→', process.argv[oi + 1]); }
  else { res.slides.forEach((sl, i) => console.log(`s${i + 1}`, sl.type, sl.image || '', sl.flip ? '[variant]' : '')); console.log('counts:', JSON.stringify(res._imageCounts)); }
}
