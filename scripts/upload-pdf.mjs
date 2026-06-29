#!/usr/bin/env node
// upload-pdf.mjs — 설치 가이드 PDF를 Supabase Storage(public)에 업서트. 폰에서 바로 열리는 링크 제공.
// 사용: npm run guide:pdf && node scripts/upload-pdf.mjs
import fs from 'node:fs';
const env = {};
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY;
if (!url || !key) { console.error('✗ .env.local 에 SUPABASE URL/service_role 키 없음'); process.exit(1); }
const NAME = process.argv[2] || 'INSTALL-CLIENT';
const buf = fs.readFileSync(new URL(`../docs/${NAME}.pdf`, import.meta.url));
const bucket = 'card-images', obj = `docs/${NAME}.pdf`;
const r = await fetch(`${url}/storage/v1/object/${bucket}/${obj}`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + key, apikey: key, 'content-type': 'application/pdf', 'x-upsert': 'true' },
  body: buf,
});
if (r.status !== 200) { console.error('✗ 업로드 실패', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
console.log('✓ 업로드 완료 (', (buf.length / 1024 | 0), 'KB )');
console.log('  PUBLIC:', `${url}/storage/v1/object/public/${bucket}/${obj}`);
