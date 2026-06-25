#!/usr/bin/env node
// shots.mjs — 가이드용 실제 제품 스크린샷 생성(헤드리스, 라이브 데이터). web/ 서빙 → 캡처 → docs/img/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const IMG = path.join(ROOT, 'docs', 'img');
const PORT = 5183;
const SLUG = 'carousel_01-지구에서-가장-안전한-Black';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.otf': 'font/otf' };
if (!fs.existsSync(path.join(WEB, 'config.js'))) { console.error('config.js 없음'); process.exit(2); }
fs.mkdirSync(IMG, { recursive: true });

const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const fp = path.join(WEB, rel);
  if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('x'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => srv.listen(PORT, r));
const require = createRequire(path.join(ROOT, '..', '마케팅 자동화 에이전트', 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 }, deviceScaleFactor: 2 });
const shot = async (url, file, waitFn) => {
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'networkidle' });
  if (waitFn) await p.waitForFunction(waitFn, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(IMG, file) });
  console.log('  ✓ docs/img/' + file);
  await p.close();
};
try {
  console.log('=== 가이드 스크린샷 생성 ===');
  await shot('index.html', '05-console.png');
  await shot(`cards.html?slug=${encodeURIComponent(SLUG)}`, '06-card-editor.png', 'window.__ready===true');
  await shot(`blog.html?slug=${encodeURIComponent(SLUG)}`, '07-blog-preview.png');
} finally { await browser.close(); srv.close(); }
console.log('완료. (01~04 = Claude Desktop 앱 설정 화면은 macOS에서 캡처 필요)');
