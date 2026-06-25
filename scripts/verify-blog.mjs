#!/usr/bin/env node
// verify-blog.mjs — 블로그 미리보기가 캠페인별로 이미지를 실제로 렌더·로드하는지 검증(큐 유/무 모두).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const PORT = 5184;
const SLUGS = ['carousel_01-지구에서-가장-안전한-Black', 'carousel_02-내-몸이-가장-잘-아는-색소', 'carousel_06-97%-(세포-생존율)'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.otf': 'font/otf' };
let fail = 0; const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
const srv = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'; const fp = path.join(WEB, rel); if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('x'); } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res); });
await new Promise(r => srv.listen(PORT, r));
console.log('=== blog 이미지 렌더 검증 ===');
const require = createRequire(path.join(ROOT, '..', '마케팅 자동화 에이전트', 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
try {
  for (const slug of SLUGS) {
    const p = await browser.newPage();
    await p.goto(`http://localhost:${PORT}/blog.html?slug=${encodeURIComponent(slug)}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1800);
    const r = await p.evaluate(() => { const figs = document.querySelectorAll('figure').length; const imgs = [...document.querySelectorAll('figure img')]; const loaded = imgs.filter(i => i.complete && i.naturalWidth > 0).length; return { figs, imgs: imgs.length, loaded }; });
    ok(r.figs >= 1 && r.loaded === r.imgs && r.imgs >= 1, `${slug.slice(0, 22)} — figure ${r.figs} · 이미지 로드 ${r.loaded}/${r.imgs}`);
    await p.close();
  }
} finally { await browser.close(); srv.close(); }
console.log(`\n=== blog verify: ${fail ? fail + ' fail' : 'OK'} ===`);
process.exit(fail ? 1 : 0);
