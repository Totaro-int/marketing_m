#!/usr/bin/env node
// insight-card.mjs — 웹사이트용 단일 인사이트 카드(PNG). IG는 캐러셀, 웹은 단일 카드/요약(같은 토픽).
// 엔진 렌더러 재사용(렌더 일관성) → 스펙의 커버 슬라이드를 단일 카드로 렌더.
// 사용: node engine/insight-card.mjs <specPath> [--out card.png]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderSlide } from './render.mjs';
import { assignImages } from './image-assign.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STOCK = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/image-stock.json'), 'utf-8'));

// 스펙 → 단일 인사이트 카드 캔버스 (커버 슬라이드 재사용, 없으면 cover_stmt 합성)
export async function insightCardCanvas(spec) {
  let cover = spec.slides?.find(s => s.type === 'cover_stmt' || s.type === 'cover_data');
  if (!cover) {
    const t = STOCK.perTopic[String(spec.id)];
    cover = { type: 'cover_stmt', image: (t && t.cover) || STOCK.fillPriority[0], lines: [String(spec.topic || '').trim() + '.'] };
  }
  // 커버에 이미지가 없으면(생성 직후 등) 배정
  if ((cover.type === 'cover_stmt' || cover.type === 'cover_data') && !cover.image) {
    const a = assignImages(spec); cover = a.slides.find(s => s.type === cover.type) || cover;
  }
  return renderSlide(cover);
}

export async function writeInsightCard(spec, outPng) {
  const canvas = await insightCardCanvas(spec);
  fs.mkdirSync(path.dirname(outPng), { recursive: true });
  fs.writeFileSync(outPng, canvas.toBuffer('image/png'));
  return outPng;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sp = process.argv[2];
  if (!sp) { console.error('usage: insight-card.mjs <specPath> [--out card.png]'); process.exit(2); }
  const spec = JSON.parse(fs.readFileSync(sp, 'utf-8'));
  const oi = process.argv.indexOf('--out');
  const out = oi >= 0 ? process.argv[oi + 1] : path.join(ROOT, 'out', `insight_${String(spec.id).padStart(2, '0')}.png`);
  await writeInsightCard(spec, out);
  console.log('insight card →', out);
}
