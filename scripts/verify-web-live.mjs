#!/usr/bin/env node
// 웹 콘솔 라이브 검증 — config.js(SB_URL/SB_ANON) 존재 시 콘솔이 Supabase에서 draft를 읽는지 확인.
// web/ 정적 서빙 → 로컬 헤드리스 크롬(Playwright)으로 로드 → 라이브 모드 + 라이브 draft 렌더 확인.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const PORT = 5178;
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };
if (!fs.existsSync(path.join(WEB, 'config.js'))) { console.error('web/config.js 없음 — 라이브 모드 아님. 먼저 키 설정.'); process.exit(2); }

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const fp = path.join(WEB, rel);
  if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
let fail = 0;
const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { fail++; console.log('  ✗ ' + m); } };

await new Promise(r => server.listen(PORT, r));
console.log(`=== web console LIVE smoke (serving web/ + config.js @ :${PORT}) ===`);
const require = createRequire(path.join(ROOT, '..', '마케팅 자동화 에이전트', 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 40000 });
  await page.waitForTimeout(2500); // Supabase fetch + render
  const foot = await page.$eval('#foot', e => e.textContent).catch(() => '');
  ok(/연결됨/.test(foot) && !/데모/.test(foot), `라이브 모드 (foot: "${foot.trim()}")`);
  const cards = await page.$$eval('.card', els => els.length);
  ok(cards >= 1, `Supabase draft 카드 ${cards}개 렌더`);
  const bodyTxt = await page.$eval('textarea.body', e => e.value).catch(() => '');
  ok(/멜라누아|반영구|N\.D\.|자극 지수|세포|0\.00|검정/.test(bodyTxt), `라이브 draft 본문 확인: "${bodyTxt.slice(0, 28)}…"`);
  const guard = await page.$eval('.guard', e => e.textContent).catch(() => '');
  ok(/통과|block 0/.test(guard), `guardian 표시: "${guard.trim()}"`);
  // 4테이블 라이브: 학습 탭(learnings) + 소스 탭(sources)
  await page.click('[data-s="learning"]'); await page.waitForTimeout(400);
  const rules = await page.$$eval('.rule', els => els.length);
  ok(rules >= 6, `학습 탭 라이브 규칙 ${rules}개 (Supabase learnings)`);
  await page.click('[data-s="sources"]'); await page.waitForTimeout(400);
  const gl = await page.$eval('#gl', e => e.value).catch(() => '');
  ok(/차분·데이터|All N\.D\.|홈페이지/.test(gl), `소스 탭 라이브 지침: "${gl.slice(0, 22)}…"`);
  await page.click('[data-s="today"]'); await page.waitForTimeout(200);
  ok(errs.length === 0, `JS 콘솔 에러 ${errs.length}`);
  if (errs.length) errs.slice(0, 3).forEach(e => console.log('     ! ' + e));
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, 'out', 'web-console-live.png'), fullPage: true });
  console.log('  → 스크린샷: out/web-console-live.png');
} finally { await browser.close(); server.close(); }
console.log(`\n=== web live verify: ${fail ? fail + ' fail' : 'OK'} ===`);
process.exit(fail ? 1 : 0);
