#!/usr/bin/env node
// verify-card-web.mjs — 브라우저 카드 렌더러(web/card-render.js)가 골드 카드와 일치하는지 직접 검증.
// web/ + bg/lib + specs 서빙 → 헤드리스로 _cardtest.html 렌더 → canvas PNG 추출 → 골드 픽셀 diff.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import canvasPkg from 'canvas';
import pixelmatch from 'pixelmatch';
const { createCanvas, loadImage } = canvasPkg;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const BG = path.join(ROOT, 'reference/gold-reference/bg/lib');
const SPECS = path.join(ROOT, 'reference/gold-reference/carousel_specs');
const GOLD = path.join(ROOT, 'reference/gold-reference/cards/carousel_01');
const PORT = 5181;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.woff2': 'font/woff2' };
let fail = 0; const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };

const srv = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  let fp;
  if (rel.startsWith('/bg/')) fp = path.join(BG, path.basename(rel));
  else if (rel.startsWith('/specs/')) fp = path.join(SPECS, path.basename(rel));
  else fp = path.join(WEB, rel.replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('x'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

async function rgba(srcPngBufOrPath) {
  const img = await (typeof srcPngBufOrPath === 'string' ? loadImage(fs.readFileSync(srcPngBufOrPath)) : loadImage(srcPngBufOrPath));
  const c = createCanvas(img.width, img.height); const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
}

await new Promise(r => srv.listen(PORT, r));
console.log('=== card-web verify (브라우저 렌더 vs 골드 carousel_01) ===');
const require = createRequire(path.join(ROOT, '..', '마케팅 자동화 에이전트', 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
try {
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  for (const slide of [0, 2, 7]) { // cover_stmt, body, closing
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto(`http://localhost:${PORT}/_cardtest.html?spec=/specs/carousel_01.json&slide=${slide}`, { waitUntil: 'networkidle' });
    await page.waitForFunction('window.__done === true', { timeout: 20000 });
    const err = await page.evaluate('window.__err || null');
    const dataUrl = await page.evaluate('window.__png || null');
    await page.close();
    if (err || !dataUrl) { ok(false, `slide ${slide + 1} 렌더 실패: ${err}`); continue; }
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(ROOT, 'out', `cardweb-s${slide + 1}.png`), buf);
    const goldP = path.join(GOLD, `s${slide + 1}.png`);
    if (!fs.existsSync(goldP)) { ok(false, `골드 없음 s${slide + 1}`); continue; }
    const g = await rgba(goldP), m = await rgba(buf);
    if (g.w !== m.w || g.h !== m.h) { ok(false, `slide ${slide + 1} 크기 불일치 ${m.w}x${m.h} vs ${g.w}x${g.h}`); continue; }
    const out = Buffer.alloc(g.w * g.h * 4);
    const mm = pixelmatch(g.data, m.data, out, g.w, g.h, { threshold: 0.1 });
    const pct = (mm / (g.w * g.h)) * 100;
    ok(pct < 6, `slide ${slide + 1} (${['cover','','body','','','','','closing'][slide] || 'slide'}) diff ${pct.toFixed(2)}% ${pct < 6 ? '' : '(>6% — 폰트/메트릭 점검)'}`);
  }
} finally { await browser.close(); srv.close(); }
console.log(`\n=== card-web verify: ${fail ? fail + ' fail' : 'OK'} ===`);
process.exit(fail ? 1 : 0);
