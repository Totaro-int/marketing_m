#!/usr/bin/env node
// 라이브 UI 피드백 루프 검증 — 콘솔에서 아쉬움+메모 저장 → feedback 테이블 INSERT 확인 → pull.
// 끝나면 테스트 피드백 행/로컬 학습 산출물 정리. 사용: node scripts/verify-feedback-loop.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { sbEnv } from './_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const PORT = 5179;
const NOTE = '루프검증 ' + '커버에서 핵심이 더 빨리 잡히게';
const env = sbEnv();
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const fp = path.join(WEB, rel);
  if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
});
let fail = 0; const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { fail++; console.log('  ✗ ' + m); } };
const sb = (p, opt = {}) => fetch(env.URL + '/rest/v1/' + p, { headers: { apikey: env.ANON, Authorization: 'Bearer ' + env.ANON, ...(opt.headers || {}) }, ...opt });

await new Promise(r => server.listen(PORT, r));
console.log('=== 라이브 UI 피드백 루프 검증 ===');
const require = createRequire(path.join(ROOT, '..', '마케팅 자동화 에이전트', 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 40000 });
  await page.waitForSelector('.card .fb', { timeout: 15000 });
  await page.click('.act-down');                       // 아쉬움
  await page.fill('.card .fb', NOTE);                  // 메모
  await page.click('.act-fbsave');                     // 저장 → insertFeedback
  await page.waitForTimeout(2500);
  ok(errs.length === 0, `콘솔 JS 에러 ${errs.length}` + (errs[0] ? ` (${errs[0].slice(0, 50)})` : ''));
} finally { await browser.close(); }

// feedback 테이블에 들어갔나 (anon select)
const rows = await (await sb('feedback?select=verdict,note,channel,draft_id&note=eq.' + encodeURIComponent(NOTE))).json();
ok(Array.isArray(rows) && rows.length >= 1, `feedback 테이블 INSERT 확인 (${rows.length || 0}행, verdict=${rows[0]?.verdict})`);

// pull → distill
const pull = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'pull-supabase.mjs')], { encoding: 'utf-8' });
const inbox = path.join(ROOT, 'learnings', '_inbox-feedback.json');
const inboxHas = fs.existsSync(inbox) && JSON.parse(fs.readFileSync(inbox, 'utf-8')).some(f => f.note === NOTE);
ok(pull.status === 0 && inboxHas, 'pull → learnings/_inbox-feedback.json 반영');
const dis = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'distill.mjs')], { encoding: 'utf-8' });
const distilled = path.join(ROOT, 'learnings', '01-distilled.md');
ok(dis.status === 0 && fs.existsSync(distilled) && fs.readFileSync(distilled, 'utf-8').includes('커버에서 핵심'), 'distill → 규칙 생성');

// cleanup — 테스트 피드백 행 + 로컬 산출물
const del = await sb('feedback?note=eq.' + encodeURIComponent(NOTE), { method: 'DELETE', headers: { apikey: env.KEY, Authorization: 'Bearer ' + env.KEY, Prefer: 'return=minimal' } });
for (const f of [inbox, distilled, path.join(ROOT, 'learnings', '_proposals.json'), inbox + '.bak', path.join(ROOT, 'brand', '_pulled-guidelines.txt')]) if (fs.existsSync(f)) fs.rmSync(f);
console.log(`  · cleanup: feedback 행 삭제 ${del.status}, 로컬 테스트 산출물 제거`);
server.close();
console.log(`\n=== feedback loop verify: ${fail ? fail + ' fail' : 'OK'} ===`);
process.exit(fail ? 1 : 0);
