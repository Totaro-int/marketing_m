#!/usr/bin/env node
// upload-bg.mjs — 카드 편집기 기본 배경: 스펙의 슬라이드 배경 이미지를 웹용으로 다운스케일 → Storage(bg/) 업로드.
// 편집기는 bg/<파일명> 을 기본 배경으로 로드(클라가 교체 가능). 사용: node scripts/upload-bg.mjs <specPath>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import canvasPkg from 'canvas';
import { sbEnv, hasCreds, sbUploadObject, ui } from './_lib.mjs';
const { createCanvas, loadImage } = canvasPkg;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'reference/gold-reference/bg/lib');
const specPath = process.argv[2];
if (!specPath) { console.error('usage: upload-bg.mjs <specPath>'); process.exit(2); }
const env = sbEnv();
if (!hasCreds(env)) { ui.warn('creds 없음 — skip'); process.exit(0); }

const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
const names = [...new Set((spec.slides || []).map(s => s.image).filter(Boolean).map(n => path.basename(n)))];

async function main() {
  let n = 0;
  for (const name of names) {
    const fp = path.join(LIB, name);
    if (!fs.existsSync(fp)) { ui.dim(`  (없음: ${name})`); continue; }
    const img = await loadImage(fs.readFileSync(fp));
    const maxSide = 1400, s = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * s), h = Math.round(img.height * s);
    const c = createCanvas(w, h); const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, w, h);
    const buf = c.toBuffer('image/jpeg', { quality: 0.84 });
    const url = await sbUploadObject(env, `bg/${name.replace(/\.[^.]+$/, '')}.jpg`, buf, 'image/jpeg');
    ui.ok(`  ${name} → ${w}x${h} ${(buf.length / 1024 | 0)}KB`); n++;
  }
  ui.ok(`bg 업로드 ${n}개 · base: ${env.URL}/storage/v1/object/public/${env.BUCKET}/bg/`);
  console.log('BUCKET=' + env.BUCKET);
}
main().catch(e => { ui.err(e.message); process.exit(1); });
