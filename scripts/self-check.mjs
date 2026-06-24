#!/usr/bin/env node
// 회귀·보안 가드 — 발행/생성 콘텐츠에 금지 토큰이 되살아나거나 비밀키가 새지 않는지 점검.
// 스코프: 발행·생성 산출물(brand/web/learnings/out/generated). 참고 SSoT 문서(reference/·*.md)는
//   금지어를 '금지 대상'으로 명시하므로 제외. 사용: node scripts/self-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 발행/생성 콘텐츠만 스캔 (참고 문서 제외)
const SCAN_DIRS = ['brand', 'web', 'learnings', 'out'];
const SKIP = /node_modules|[\\/]\.git[\\/]|reference[\\/]/;
const TEXT_EXT = /\.(json|js|mjs|html|css|md|txt|yaml|yml)$/;

const BANNED = ['28종', '28-FREE', '28종 N.D.', '28종 불검출', '@melanoir.official'];
// 금지어를 '금지 목록'으로 정의하는 파일은 스캔 제외: brand-dna.json(SSoT) + brief_*.json(에이전트 입력, 락 목록 포함).
// (생성 산출물 final_*/spec_* 는 계속 스캔 — 실제 금지어 회귀 탐지.)
const BANNED_SKIP = (f) => { const b = path.basename(f); return b === 'brand-dna.json' || /^(brief|chbrief)_.*\.json$/.test(b); };
// config.js(=anon 키, RLS 안전, gitignore)는 시크릿 스캔 제외. service_role은 .env.local(미스캔)에만.
const SECRET_SKIP = (f) => path.basename(f) === 'config.js';
// 실제 비밀'값'만 탐지 ('service_role'이라는 단어가 경고 주석에 있는 건 정상).
const SECRETS = [
  { re: /sk-ant-[A-Za-z0-9_-]{10,}/, what: 'Anthropic API 키' },
  { re: /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{8,}/, what: 'JWT(서비스/anon 키 값)' },
  { re: /service_role['"\s:=]+eyJ/i, what: 'service_role 키 값' },
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p, acc);
    else if (TEXT_EXT.test(e.name)) acc.push(p);
  }
  return acc;
}

let fail = 0, scanned = 0;
const files = SCAN_DIRS.flatMap(d => walk(path.join(ROOT, d)));
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf-8'); scanned++;
  const rel = path.relative(ROOT, f);
  if (!BANNED_SKIP(f)) for (const b of BANNED) if (txt.includes(b)) { console.log(`  ✗ BANNED '${b}' in ${rel}`); fail++; }
  if (!SECRET_SKIP(f)) for (const s of SECRETS) { const m = txt.match(s.re); if (m) { console.log(`  ✗ SECRET ${s.what} in ${rel}: ${m[0].slice(0, 12)}…`); fail++; } }
}

// 필수 마커 존재 (브랜드 정합)
const dnaP = path.join(ROOT, 'brand/brand-dna.json');
if (fs.existsSync(dnaP)) {
  const d = fs.readFileSync(dnaP, 'utf-8');
  for (const need of ['@melanoir_official', '필수 항목 All N.D.']) if (!d.includes(need)) { console.log(`  ✗ brand-dna.json 누락: '${need}'`); fail++; }
}

// .gitignore 보안 항목
const giP = path.join(ROOT, '.gitignore');
const giNeed = ['.env.local', 'web/config.js', 'assets/', 'node_modules', 'out/'];
if (!fs.existsSync(giP)) { console.log('  ⚠ .gitignore 없음 — 생성 권장(.env.local·config.js·assets·node_modules·out)'); fail++; }
else { const gi = fs.readFileSync(giP, 'utf-8'); for (const g of giNeed) if (!gi.split(/\r?\n/).some(l => l.trim().replace(/\/$/, '') === g.replace(/\/$/, ''))) console.log(`  ⚠ .gitignore에 '${g}' 권장`); }

console.log(`\nself-check: scanned ${scanned} files · ${fail} fail`);
process.exit(fail ? 1 : 0);
