#!/usr/bin/env node
// gen-config.mjs — .env.local 의 URL·ANON 으로 web/config.js 자동 생성.
//   config.js 는 공개키(anon)만 담으므로 메일/공유 불필요 — .env.local 만 있으면 여기서 만든다.
//   사용: node scripts/gen-config.mjs   (setup 이 자동 호출, doctor 도 권장)
import fs from 'node:fs';
import path from 'node:path';
import { sbEnv, ROOT } from './_lib.mjs';

const env = sbEnv();
const url = env.URL, anon = env.ANON;
if (!url || !anon) {
  console.error('✗ .env.local 에 SUPABASE_URL / SUPABASE_ANON_KEY 가 없습니다 — 먼저 .env.local 을 넣으세요.');
  process.exit(1);
}
const out = `// 자동 생성 (scripts/gen-config.mjs · .env.local 기반). anon 공개키만 — 커밋 금지(.gitignore).\nwindow.SB_URL  = '${url}';\nwindow.SB_ANON = '${anon}';\n`;
fs.mkdirSync(path.join(ROOT, 'web'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'web', 'config.js'), out);
console.log('✓ web/config.js 생성 완료 (.env.local 의 URL·anon 사용).');
