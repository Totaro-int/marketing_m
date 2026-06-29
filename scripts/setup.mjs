#!/usr/bin/env node
// setup.mjs — 멜라누아 스튜디오 1-방 셋업: 설정 템플릿 복사 → npm install → doctor 점검.
// (레포 clone 후) `node scripts/setup.mjs` 또는 `npm run setup`. 빌트인만 사용 — deps 전 실행 가능.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cp = (ex, dst) => {
  const e = path.join(ROOT, ex), d = path.join(ROOT, dst);
  if (fs.existsSync(d)) { console.log(`  • ${dst} 이미 있음 (유지)`); return; }
  if (fs.existsSync(e)) { fs.copyFileSync(e, d); console.log(`  ✓ ${dst} 생성 — 값 입력 필요`); }
  else console.log(`  ✗ 템플릿 없음: ${ex}`);
};

console.log('=== 멜라누아 스튜디오 셋업 ===\n1) 설정 템플릿 복사');
cp('.env.local.example', '.env.local');
// web/config.js 는 .env.local 의 anon 으로 자동 생성(3단계) — 별도 전달/첨부 불필요

console.log('\n2) npm install (canvas 선택 — 실패해도 진행)');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const ni = spawnSync(npm, ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit' });
if (ni.status !== 0) console.log('  • npm install 경고/실패 — canvas(선택 의존성)면 무시 가능. doctor로 확인.');

console.log('\n3) web/config.js 자동 생성 (.env.local 의 URL·anon)');
const gc = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'gen-config.mjs')], { stdio: 'inherit' });
if (gc.status !== 0) console.log('   • .env.local 에 키(URL·SERVICE_KEY·ANON) 넣은 뒤 `npm run gen:config` 재실행 → config.js 생성.');

console.log('\n4) 준비 점검 (doctor)');
spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { stdio: 'inherit' });

console.log('\n다음: 키 채운 뒤 `npm run doctor` 가 ✓ 면 Claude Desktop에서 "오늘 콘텐츠 만들어줘".');
