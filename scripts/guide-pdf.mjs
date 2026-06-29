#!/usr/bin/env node
// guide-pdf.mjs — docs/INSTALL-CLIENT.md → docs/INSTALL-CLIENT.pdf
// 스크린샷을 node-canvas로 620px JPEG 다운스케일(파일 크기↓ → Drive 업로드 가능) 후 헤드리스 크롬 print.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const IMG = path.join(DOCS, 'img');
const SDIR = path.join(IMG, '_s');
const PORT = 5185;
const MIME = { '.html': 'text/html', '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };

// 1) 스크린샷 다운스케일 (node-canvas, Buffer 로드 = 한글경로 안전)
fs.mkdirSync(SDIR, { recursive: true });
const NAME = process.argv[2] || 'INSTALL-CLIENT';   // 렌더할 docs/<NAME>.md → docs/<NAME>.pdf
let mdText = fs.readFileSync(path.join(DOCS, NAME + '.md'), 'utf8');
try {
  const { createCanvas, loadImage } = await import('canvas');
  for (const f of fs.readdirSync(IMG).filter(f => /\.png$/i.test(f))) {
    const img = await loadImage(fs.readFileSync(path.join(IMG, f)));
    const maxW = 620, s = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * s), h = Math.round(img.height * s);
    const c = createCanvas(w, h); c.getContext('2d').drawImage(img, 0, 0, w, h);
    const out = f.replace(/\.png$/i, '.jpg');
    fs.writeFileSync(path.join(SDIR, out), c.toBuffer('image/jpeg', { quality: 0.6 }));
    mdText = mdText.split(`img/${f}`).join(`img/_s/${out}`);
  }
  console.log('  스크린샷 다운스케일 완료 (620px JPEG)');
} catch (e) { console.log('  (canvas 없음 — 원본 이미지 사용):', e.message); }
fs.writeFileSync(path.join(DOCS, '_guide.md'), mdText);

const PRINT = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
@page{margin:16mm 14mm}
body{font-family:Pretendard,system-ui,sans-serif;color:#1f2230;line-height:1.65;font-size:13.5px;max-width:880px;margin:0 auto;padding:8px}
h1{font-size:25px;border-bottom:3px solid #c2a15a;padding-bottom:10px;margin:0 0 18px}
h2{font-size:18px;margin:26px 0 10px;color:#111;border-left:4px solid #c2a15a;padding-left:10px}
h3{font-size:15px;margin:18px 0 8px;color:#333}
code{background:#f5f3ee;padding:2px 6px;border-radius:5px;font-size:12px;color:#9c5b00}
pre{background:#15151a;color:#eee;padding:14px 16px;border-radius:10px;overflow:auto;font-size:12px;line-height:1.5}
pre code{background:none;color:#eee;padding:0}
img{max-width:78%;border:1px solid #e6e3dc;border-radius:10px;margin:10px 0;box-shadow:0 2px 12px rgba(0,0,0,.08)}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:12.5px}
th,td{border:1px solid #e2ded5;padding:7px 10px;text-align:left}
th{background:#faf7f0}
blockquote{border-left:4px solid #d9c08a;background:#fbf7ee;margin:12px 0;padding:8px 14px;color:#6b5b33;border-radius:0 8px 8px 0}
a{color:#1a73c0;text-decoration:none} hr{border:none;border-top:1px solid #eee;margin:24px 0}
h2,h3,img,pre,table{break-inside:avoid}
</style></head><body><div id="md">로딩…</div>
<script>fetch('_guide.md',{cache:'no-store'}).then(r=>r.text()).then(t=>{document.getElementById('md').innerHTML=marked.parse(t);window.__ready=true;});</script>
</body></html>`;

const tmp = path.join(DOCS, '_print.html');
fs.writeFileSync(tmp, PRINT);
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || '_print.html';
  const fp = path.join(DOCS, rel);
  if (!fp.startsWith(DOCS) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('x'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => srv.listen(PORT, r));
const require = createRequire(path.join(ROOT, '..', '마케팅 자동화 에이전트', 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/_print.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__ready===true', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const out = path.join(DOCS, NAME + '.pdf');
  await page.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
  console.log('✓ PDF:', path.relative(ROOT, out), (fs.statSync(out).size / 1024 | 0) + 'KB');
} finally {
  await browser.close(); srv.close();
  fs.rmSync(tmp, { force: true });
  fs.rmSync(path.join(DOCS, '_guide.md'), { force: true });
  fs.rmSync(SDIR, { recursive: true, force: true });
}
