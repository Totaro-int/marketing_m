#!/usr/bin/env node
// 웹 콘솔 스모크 검증 — web/ 정적 서빙 → (Playwright 있으면)브라우저 렌더 검증 + 스크린샷,
// 없으면 fetch 기반 계약 검증(fixture↔콘솔 키, 6섹션 nav). 사용: node scripts/verify-web.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const PORT = 5177;
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };

// config.js 존재 = 라이브 모드 → 데모 스모크는 무의미. verify-web-live 로 안내.
if (fs.existsSync(path.join(WEB, 'config.js'))) {
  console.log('config.js 존재 → 라이브 모드. 데모 스모크 건너뜀 (라이브는 `node scripts/verify-web-live.mjs`).');
  process.exit(0);
}

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const fp = path.join(WEB, rel);
  if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

const NAV = ['오늘 발행', '소스', '브랜드 DNA', '학습', '캘린더', '설정'];
let fail = 0;

async function browserCheck() {
  const require = createRequire(path.join(ROOT, '..', '마케팅 자동화 에이전트', 'package.json'));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.nav', { timeout: 10000 });
    const navTexts = await page.$$eval('.nav', els => els.map(e => e.textContent.trim()));
    for (const n of NAV) { if (navTexts.some(t => t.includes(n))) console.log(`  ✓ nav: ${n}`); else { console.log(`  ✗ nav missing: ${n}`); fail++; } }
    const cards = await page.$$eval('.card', els => els.length);
    console.log(cards >= 3 ? `  ✓ 오늘발행 draft 카드 ${cards}개 렌더` : `  ✗ 카드 ${cards}개 (3 기대)`); if (cards < 3) fail++;
    const foot = await page.$eval('#foot', e => e.textContent).catch(() => '');
    console.log(foot.includes('데모') ? `  ✓ DEMO 모드(fixture) 동작` : `  ⚠ foot: ${foot}`);
    // 브랜드 DNA 탭 → 잠금 항목 렌더
    await page.click('[data-s="brand"]'); await page.waitForTimeout(200);
    const locks = await page.$$eval('.lock', els => els.length);
    console.log(locks >= 1 ? `  ✓ 브랜드 DNA 잠금 항목 ${locks}개` : `  ✗ 잠금 항목 없음`); if (locks < 1) fail++;
    // 학습 탭
    await page.click('[data-s="learning"]'); await page.waitForTimeout(200);
    const rules = await page.$$eval('.rule', els => els.length);
    console.log(rules >= 1 ? `  ✓ 학습 규칙 ${rules}개 렌더` : `  ✗ 학습 규칙 없음`); if (rules < 1) fail++;
    await page.click('[data-s="today"]'); await page.waitForTimeout(200);
    fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
    await page.screenshot({ path: path.join(ROOT, 'out', 'web-console.png'), fullPage: true });
    if (errs.length) { console.log(`  ✗ page errors: ${errs.slice(0, 2).join(' | ')}`); fail++; }
    else console.log(`  ✓ JS 콘솔 에러 0`);
    console.log(`  → 스크린샷: out/web-console.png`);
  } finally { await browser.close(); }
}

function contractCheck() {
  // fetch 폴백: fixture 키 ↔ 콘솔 참조 계약
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf-8');
  const fx = JSON.parse(fs.readFileSync(path.join(WEB, 'fixture.json'), 'utf-8'));
  for (const n of NAV) { const has = html.includes(`>${n}<`) || html.includes(n); console.log(has ? `  ✓ nav: ${n}` : `  ✗ nav: ${n}`); if (!has) fail++; }
  for (const k of ['campaign', 'drafts', 'sources', 'brandDna', 'learnings', 'calendar']) {
    const inFx = k in fx, used = html.includes(`DATA.${k}`);
    console.log(inFx && used ? `  ✓ fixture↔console: ${k}` : `  ✗ ${k} (fixture:${inFx} console:${used})`); if (!(inFx && used)) fail++;
  }
  console.log(`  ✓ drafts ${fx.drafts.length} · sources ${fx.sources.images.length} · learnings ${fx.learnings.length}`);
}

await new Promise(r => server.listen(PORT, r));
console.log(`=== web console smoke (serving web/ @ :${PORT}) ===`);
try { await browserCheck(); }
catch (e) { console.log(`  (Playwright 미가용: ${e.message.slice(0, 60)} → fetch 계약 검증으로 폴백)`); contractCheck(); }
server.close();
console.log(`\n=== web verify: ${fail ? fail + ' fail' : 'OK'} ===`);
process.exit(fail ? 1 : 0);
