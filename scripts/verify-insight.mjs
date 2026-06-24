#!/usr/bin/env node
// verify-insight.mjs — 인사이트 자동발행을 직접 실행 검증.
//   ① 스펙 생성 → publish-insight → ② cards.json 이 recruitment 스키마인지(7키) ③ PNG 생성 ④ guard 통과
//   ⑤ 헤드리스로 페이지가 카드를 실제 렌더하는지(recruitment index.html 있으면 그걸로, 없으면 프리뷰).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { skeletonSpec, finalizeSpec } from '../engine/generate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out', '_insight-verify');
const DATE = '2026-06-25';
const node = process.execPath;
let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };

console.log('=== insight publish verify ===');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// recruitment 페이지가 있으면 그 index.html+insights.css 로 렌더(실서비스 페이지 검증), 없으면 프리뷰
const RECRUIT = path.resolve(ROOT, '..', 'melanoir-recruitment', 'web', 'site', 'insights');
let usingRecruitPage = false;
if (fs.existsSync(path.join(RECRUIT, 'index.html'))) {
  fs.copyFileSync(path.join(RECRUIT, 'index.html'), path.join(OUT, 'index.html'));
  if (fs.existsSync(path.join(RECRUIT, 'insights.css'))) fs.copyFileSync(path.join(RECRUIT, 'insights.css'), path.join(OUT, 'insights.css'));
  usingRecruitPage = true;
}

// ① 스펙 생성(토픽 5 = 0.00) → finalize
const { spec } = finalizeSpec(skeletonSpec('5'));
const specPath = path.join(OUT, '_spec.json');
fs.writeFileSync(specPath, JSON.stringify(spec));

// ② publish-insight → 타깃 OUT
const r = spawnSync(node, [path.join(ROOT, 'scripts', 'publish-insight.mjs'), specPath, '--date', DATE, '--target', OUT], { encoding: 'utf-8' });
ok(r.status === 0, `publish-insight exit ${r.status} (guard 포함)`);
if (r.status !== 0) { console.log(r.stdout, r.stderr); console.log(`\n=== insight verify: ${fail} fail ===`); process.exit(1); }

// ③ cards.json 스키마(recruitment 7키)
const cards = JSON.parse(fs.readFileSync(path.join(OUT, 'cards.json'), 'utf-8'));
ok(Array.isArray(cards) && cards.length >= 1, `cards.json 배열 ${cards.length}항목`);
const e = cards.find(c => c.date === DATE) || {};
const KEYS = ['date', 'category', 'handle', 'title', 'subtitle', 'image', 'link'];
ok(KEYS.every(k => k in e), `스키마 7키 일치: ${KEYS.filter(k => k in e).join(',')}`);
ok(e.handle === '@melanoir', `handle "${e.handle}"`);
ok(e.image === `${DATE}.png`, `image 파일명 "${e.image}"`);
ok((e.title || '').length > 0 && (e.subtitle || '').length > 0, `title/subtitle: "${e.title}" / "${(e.subtitle || '').slice(0, 28)}…"`);

// ④ PNG 실재 + 크기
const png = path.join(OUT, 'cards', `${DATE}.png`);
const sz = fs.existsSync(png) ? fs.statSync(png).size : 0;
ok(sz > 50000, `카드 PNG ${(sz / 1024 | 0)}KB`);

// ⑤ 헤드리스 렌더
const require = createRequire(path.join(ROOT, '..', '마케팅 자동화 에이전트', 'package.json'));
const { chromium } = require('playwright');
const srv = http.createServer((req, res) => {
  const fp = path.join(OUT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html');
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('x'); }
  const ext = path.extname(fp);
  res.writeHead(200, { 'Content-Type': ext === '.png' ? 'image/png' : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : 'text/html' });
  res.end(fs.readFileSync(fp));
});
await new Promise(r => srv.listen(5179, r));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errs = [];
  // recruitment 페이지는 ../assets/* 를 부르므로 그 404 는 무시(인사이트 그리드 스크립트와 무관)
  // recruitment 페이지는 격리 테스트 디렉터리에 없는 ../assets/* (shell/header CSS·JS), 폰트, favicon 을
  // 부르므로 그 리소스 404 는 무시(인사이트 카드 그리드와 무관). 실제 JS 예외만 집계.
  page.on('console', m => { if (m.type() === 'error' && !/assets\/|favicon|apple-touch|fonts\.|pretendard|Failed to load resource|404|net::ERR/i.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://localhost:5179/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const sel = usingRecruitPage ? '.insight-card' : '.insight-card';
  const n = await page.$$eval(sel, els => els.length).catch(() => 0);
  ok(n >= 1, `${usingRecruitPage ? 'recruitment' : '프리뷰'} 페이지 카드 ${n}개 렌더`);
  const imgSrc = await page.$eval('.insight-card img', el => el.getAttribute('src')).catch(() => '');
  ok(/cards\/2026-06-25\.png/.test(imgSrc), `카드 이미지 경로 "${imgSrc}"`);
  const imgOk = await page.$eval('.insight-card img', el => el.complete && el.naturalWidth > 0).catch(() => false);
  ok(imgOk, `카드 이미지 실제 로드(naturalWidth>0)`);
  ok(errs.length === 0, `JS 콘솔 에러 ${errs.length}`);
  errs.slice(0, 3).forEach(e => console.log('     ! ' + e));
  await page.screenshot({ path: path.join(ROOT, 'out', 'insight-verify.png'), fullPage: true });
} finally { await browser.close(); srv.close(); }

console.log(`\n=== insight verify: ${fail ? fail + ' fail' : 'OK'} === (page: ${usingRecruitPage ? 'recruitment index.html' : 'preview'})`);
process.exit(fail ? 1 : 0);
