#!/usr/bin/env node
// doctor.mjs — 설치/운영 진단 + 자가수정 안내.
//   각 항목에 [CODE] → docs/RUNBOOK.md 의 같은 코드에서 자가수정 지침을 찾는다.
//   Claude Code 자가수정 루프: doctor → ✗[CODE] → RUNBOOK 적용 → doctor 재실행 → 반복.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sbEnv, hasCreds, ROOT } from './_lib.mjs';

const fails = [];
const ok = (code, c, m, hint) => { console.log(`  ${c ? '✓' : '✗'} ${m}${c ? '' : `  [${code}]`}`); if (!c) { fails.push(code); if (hint) console.log(`      → ${hint}`); } return c; };
const warn = m => console.log(`  • ${m}`);
function inGitRepo(s) { let d = path.resolve(s); while (d && d !== path.dirname(d)) { if (fs.existsSync(path.join(d, '.git'))) return true; d = path.dirname(d); } return false; }

console.log('=== 멜라누아 스튜디오 — 진단 (doctor) ===\n');

// 필수
ok('NODE', +process.versions.node.split('.')[0] >= 18, `Node.js ${process.version}`, 'Node 18+ 설치: nodejs.org (LTS)');
let depsOk = false; try { await import('pg'); depsOk = true; } catch { }
ok('DEPS', depsOk, '의존성 설치(pg)', 'npm install 실행');
const env = sbEnv();
ok('ENV', fs.existsSync(path.join(ROOT, '.env.local')), '.env.local 존재', 'cp .env.local.example .env.local → Supabase 키 입력');
ok('KEYS', hasCreds(env), 'Supabase 키(URL·SERVICE_KEY)', '.env.local 채우기 (Supabase 대시보드 → Settings → API)');
ok('CONFIG', fs.existsSync(path.join(ROOT, 'web', 'config.js')), 'web/config.js(콘솔 anon)', 'cp web/config.example.js web/config.js → SB_URL·SB_ANON');
ok('FONTS', fs.existsSync(path.join(ROOT, 'web', 'fonts', 'Pretendard-Bold.otf')), '카드 폰트(web/fonts)', 'reference/gold-reference/fonts → web/fonts 복사');
ok('GIT', spawnSync('git', ['--version'], { shell: false }).status === 0, 'git 사용 가능', 'git 설치(자사몰 자동 발행에 필요)');
if (hasCreds(env)) {
  try {
    const r = await fetch(`${env.URL}/rest/v1/marketing_drafts?select=id&limit=1`, { headers: { apikey: env.KEY, Authorization: 'Bearer ' + env.KEY } });
    ok('SB', r.ok, `Supabase 연결·스키마(HTTP ${r.status})`, '401/403→키 확인 · 404/relation 없음→node scripts/apply-schema.mjs');
  } catch (e) { ok('SB', false, 'Supabase 연결', `${e.message} → 네트워크/URL 확인`); }
} else warn('Supabase 연결 점검 생략([KEYS] 먼저)');

// 선택 (실패해도 blocker 아님 — 참고)
console.log('\n  — 선택 —');
let canvasOk = false; try { await import('canvas'); canvasOk = true; } catch { }
warn(canvasOk ? 'canvas — 서버 렌더 가능' : 'canvas 미설치 — IG 카드는 브라우저 편집기에서 렌더(생성·발행 지장 없음) · [CANVAS]');
const siteRepo = process.env.MELANOIR_SITE_REPO;
if (siteRepo) warn((fs.existsSync(siteRepo) && inGitRepo(siteRepo)) ? `자사몰 자동발행 경로 OK (${siteRepo})` : `MELANOIR_SITE_REPO 경로/레포 문제 — 클론·경로 확인 · [SITE]`);
else warn('MELANOIR_SITE_REPO 미설정 — 자사몰 자동발행 OFF (설정하면 /melanoir가 자사몰까지 자동) · [SITE]');

console.log('');
if (fails.length) {
  console.log(`✗ 준비 안 됨 — 필수 ${fails.length}개: [${fails.join('] [')}]`);
  console.log(`  자가수정: docs/RUNBOOK.md 에서 위 [CODE]를 찾아 지침 적용 → 'npm run doctor' 재실행 (모두 ✓ 까지 반복).`);
} else {
  console.log('✓ 준비 완료 — 작업 폴더에서 /melanoir 실행 가능' + (canvasOk ? '' : ' (IG 카드는 콘솔 카드편집기)') + '.');
}
process.exit(fails.length ? 1 : 0);
