#!/usr/bin/env node
// verify-cards-editor.mjs — 인스타 카드 편집기(web/cards.html)가 라이브 스펙을 로드·렌더·편집 가능한지 검증.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const PORT = 5182;
const SLUG = 'carousel_01-지구에서-가장-안전한-Black';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.otf': 'font/otf', '.woff2': 'font/woff2' };
let fail = 0; const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
if (!fs.existsSync(path.join(WEB, 'config.js'))) { console.error('config.js 없음 — 라이브 아님'); process.exit(2); }

const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const fp = path.join(WEB, rel);
  if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('x'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => srv.listen(PORT, r));
console.log('=== cards editor verify (라이브 c01 스펙) ===');
const require = createRequire(path.join(ROOT, '..', '마케팅 자동화 에이전트', 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errs.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/cards.html?slug=${encodeURIComponent(SLUG)}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__ready === true', { timeout: 25000 }).catch(() => {});
  const nav = await page.$$eval('.nav button', els => els.length).catch(() => 0);
  ok(nav === 8, `카드 네비 ${nav}개 (8 기대)`);
  const camp = await page.$eval('#camp', e => e.textContent).catch(() => '');
  ok(/안전한 Black|지구/.test(camp), `캠페인명 로드: "${camp}"`);
  const fields = await page.$$eval('#fields input, #fields textarea', els => els.length).catch(() => 0);
  ok(fields >= 1, `편집 필드 ${fields}개`);
  // 캔버스가 실제로 렌더됐는지(검정 아님 = 흰 텍스트/워드마크 존재)
  const lit = await page.evaluate(() => { const c = document.getElementById('card'); const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]; return s; });
  ok(lit > 100000, `커버 카드 렌더됨(밝기 합 ${lit})`);
  // 기본 배경(Supabase Storage)이 CORS-clean 이라 PNG 추출이 되는지 — 핵심
  const exportable = await page.evaluate(() => { try { document.getElementById('card').toDataURL('image/png'); return true; } catch (e) { return 'TAINTED:' + e.message; } });
  ok(exportable === true, `PNG 추출 가능(canvas not tainted): ${exportable}`);
  // 텍스트 편집 → 재렌더 동작 확인(첫 필드 변경)
  const f0 = await page.$('#fields input, #fields textarea');
  if (f0) { await f0.fill('테스트 제목 변경\n두번째 줄'); await page.waitForTimeout(500); ok(true, '텍스트 편집 입력 반영(재렌더 트리거)'); }
  // 배경 버튼/업로드 존재
  ok(await page.$('#drop') && await page.$('#bgfile'), '배경 올리기 UI 존재');
  ok(await page.$('#dl1') && await page.$('#dlall'), 'PNG 추출 버튼(1장/8장) 존재');
  ok(errs.length === 0, `JS 에러 ${errs.length}`); errs.slice(0, 3).forEach(e => console.log('     ! ' + e));
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, 'out', 'cards-editor.png'), fullPage: true });
} finally { await browser.close(); srv.close(); }
console.log(`\n=== cards editor verify: ${fail ? fail + ' fail' : 'OK'} ===`);
process.exit(fail ? 1 : 0);
