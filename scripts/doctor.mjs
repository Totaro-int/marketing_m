#!/usr/bin/env node
// doctor.mjs — 설치/운영 프리플라이트. 새 기기(클라이언트 포함)에서 `npm run doctor` 로 준비 상태 점검.
// canvas 는 선택(없어도 생성·발행 OK — IG 카드는 브라우저 편집기가 렌더).
import fs from 'node:fs';
import path from 'node:path';
import { sbEnv, hasCreds, ROOT } from './_lib.mjs';

const ok = (c, m, hint) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c && hint) console.log(`      → ${hint}`); return c; };
const warn = m => console.log(`  • ${m}`);
console.log('=== 멜라누아 스튜디오 — 설치 점검 (doctor) ===');
let blockers = 0;

// 1) Node
if (!ok(+process.versions.node.split('.')[0] >= 18, `Node.js ${process.version}`, 'Node 18+ 설치: nodejs.org')) blockers++;

// 2) .env.local (생성·발행 필수)
const env = sbEnv();
if (!ok(fs.existsSync(path.join(ROOT, '.env.local')), '.env.local 존재', 'cp .env.local.example .env.local → Supabase 키 입력')) blockers++;
if (!ok(hasCreds(env), 'Supabase 키(URL·SERVICE_KEY) 설정', '.env.local 의 SUPABASE_URL·SUPABASE_SERVICE_KEY 채우기')) blockers++;

// 3) 웹 콘솔 anon 키(선택 — 콘솔 라이브 연결용)
ok(fs.existsSync(path.join(ROOT, 'web', 'config.js')), 'web/config.js (콘솔 anon 키)', 'cp web/config.example.js web/config.js → SB_URL·SB_ANON');

// 4) canvas (선택)
let canvasOk = false; try { await import('canvas'); canvasOk = true; } catch { }
if (canvasOk) ok(true, 'canvas — 서버 렌더 가능');
else warn('canvas 미설치 — 서버 렌더 생략. IG 카드는 브라우저 편집기(web/cards.html)에서 렌더. 생성·발행엔 지장 없음.');

// 5) 카드 폰트
ok(fs.existsSync(path.join(ROOT, 'web', 'fonts', 'Pretendard-Bold.otf')), '카드 폰트(web/fonts)', 'reference/gold-reference/fonts → web/fonts 복사');

// 6) Supabase 연결
if (hasCreds(env)) {
  try {
    const r = await fetch(`${env.URL}/rest/v1/marketing_drafts?select=id&limit=1`, { headers: { apikey: env.KEY, Authorization: 'Bearer ' + env.KEY } });
    if (!ok(r.ok, `Supabase 연결 (HTTP ${r.status})`, '키·URL 확인 / 스키마 미적용 시: node scripts/apply-schema.mjs')) blockers++;
  } catch (e) { ok(false, 'Supabase 연결', e.message); blockers++; }
} else warn('Supabase 연결 점검 생략(키 없음)');

console.log('');
console.log(blockers
  ? `✗ 준비 안 됨 — 필수 ${blockers}개 해결 필요 (README 1~4단계).`
  : '✓ 생성·발행 준비 완료. Claude Desktop에서 /melanoir-daily 실행 가능' + (canvasOk ? '' : ' (IG 카드는 콘솔→카드 편집기에서 렌더)') + '.');
process.exit(blockers ? 1 : 0);
