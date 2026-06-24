#!/usr/bin/env node
// verify-console-write.mjs — 콘솔 쓰기 경로 직접 검증(라이브 Supabase, anon RLS).
//   ④ distill → learnings(active=false) 제안 → 콘솔 학습탭 승인 클릭 → active=true (DB 반영)
//   ① 소스탭: 이미지 토글 → sources.active / 지침 저장(glsave) → sources.text (DB 반영)
// 임시 데이터 생성 → 헤드리스 UI 조작 → DB 재조회 검증 → 전부 원복.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { sbEnv, hasCreds } from './_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const env = sbEnv();
let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };
console.log('=== console write verify (① 소스·지침 / ④ 학습 승인) ===');
if (!hasCreds(env)) { console.log('  Supabase creds 없음 — 스킵.'); process.exit(0); }
if (!fs.existsSync(path.join(WEB, 'config.js'))) { console.log('  web/config.js 없음 — 라이브 아님. 스킵.'); process.exit(0); }

const auth = { apikey: env.KEY, Authorization: 'Bearer ' + env.KEY };
const J = { ...auth, 'Content-Type': 'application/json' };
const REST = env.URL + '/rest/v1';
const q = async (p, o = {}) => {
  const headers = { ...(o.body ? J : auth), ...(o.headers || {}) };
  const r = await fetch(REST + p, { ...o, headers });
  const t = await r.text(); return t ? JSON.parse(t) : [];
};

const TAG = '__ctest';
const RULE = `${TAG} 첫 문장을 8자 이내로 끊어 임팩트`;
const NEWGL = `${TAG} 톤: 데이터 우선 · 단정 금지 · 채널 파생 · 편집테스트`;

// ── setup: 백업 + 임시 데이터 ──
const mdPath = path.join(ROOT, 'learnings', '01-distilled.md');
const propPath = path.join(ROOT, 'learnings', '_proposals.json');
const mdOrig = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : null;
const propOrig = fs.existsSync(propPath) ? fs.readFileSync(propPath, 'utf-8') : null;
const glRows = await q('/sources?kind=eq.guideline&select=id,text&limit=1');
const glId = glRows[0] && glRows[0].id, glOrig = (glRows[0] && glRows[0].text) || '';
const imgIns = await q('/sources', { method: 'POST', headers: { ...J, Prefer: 'return=representation' }, body: JSON.stringify({ kind: 'image', url: 'https://placehold.co/160', label: TAG + '-img', active: true }) });
const imgId = imgIns[0] && imgIns[0].id;

// ④ distill: 동일 노트 2건(weight 2) → learnings(active=false)
const inbox = path.join(ROOT, 'out', '_ctest-inbox.json');
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(inbox, JSON.stringify([{ id: 'ct1', channel: null, verdict: 'up', note: RULE }, { id: 'ct2', channel: null, verdict: 'up', note: RULE }]));
const dr = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'distill.mjs'), '--inbox', inbox], { encoding: 'utf-8' });
ok(dr.status === 0, `distill 실행 (exit ${dr.status})`);
let prop = await q(`/learnings?rule=eq.${encodeURIComponent(RULE)}&select=id,active`);
ok(prop.length === 1 && prop[0].active === false, `distill → learnings(active=false) 제안 생성 ${prop.length}건`);
const ruleId = prop[0] && prop[0].id;

// ── 헤드리스 UI ──
const PORT = 5180;
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const fp = path.join(WEB, rel);
  if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('x'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
});
await new Promise(r => srv.listen(PORT, r));
const require = createRequire(path.join(ROOT, '..', '마케팅 자동화 에이전트', 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.click('[data-s="learning"]'); await page.waitForTimeout(600);
  const propBtn = await page.$(`[data-id="${ruleId}"] .prop-ok`);
  ok(!!propBtn, `학습탭에 제안 카드 표시(검토 대기)`);
  if (propBtn) { await page.click(`[data-id="${ruleId}"] .prop-ok`); await page.waitForTimeout(900); }
  await page.click('[data-s="sources"]'); await page.waitForTimeout(600);
  const tog = await page.$(`.toggle[data-id="${imgId}"]`);
  ok(!!tog, `소스탭에 이미지 토글 표시`);
  if (tog) { await page.click(`.toggle[data-id="${imgId}"]`); await page.waitForTimeout(800); }
  await page.fill('#gl', NEWGL); await page.click('#glsave'); await page.waitForTimeout(900);
} finally { await browser.close(); srv.close(); }

// ── assert: DB 재조회 ──
prop = await q(`/learnings?id=eq.${ruleId}&select=active`);
ok(prop[0] && prop[0].active === true, `④ 승인 → learnings.active=true (DB)`);
const img2 = await q(`/sources?id=eq.${imgId}&select=active`);
ok(img2[0] && img2[0].active === false, `① 토글 → sources.active=false (DB)`);
const gl2 = await q(`/sources?kind=eq.guideline&select=text&limit=1`);
ok((gl2[0] && gl2[0].text || '').startsWith(TAG), `① 지침 저장 → sources.text 갱신 (DB)`);

// ── cleanup: 원복 ──
if (ruleId) await q(`/learnings?id=eq.${ruleId}`, { method: 'DELETE' });
if (imgId) await q(`/sources?id=eq.${imgId}`, { method: 'DELETE' });
if (glId) await q(`/sources?id=eq.${glId}`, { method: 'PATCH', body: JSON.stringify({ text: glOrig }) });
if (mdOrig !== null) fs.writeFileSync(mdPath, mdOrig); else fs.rmSync(mdPath, { force: true });
if (propOrig !== null) fs.writeFileSync(propPath, propOrig); else fs.rmSync(propPath, { force: true });
fs.rmSync(inbox, { force: true });
console.log('  (정리: 임시 규칙/이미지 삭제, 지침·distill 산출물 원복)');

console.log(`\n=== console write verify: ${fail ? fail + ' fail' : 'OK'} ===`);
process.exit(fail ? 1 : 0);
