// 공용 유틸 — .env.local 로더 + Supabase env + REST 헬퍼 + 로거. 의존성 0 (Node fetch).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .env.local → process.env (이미 설정된 값은 보존)
export function loadEnv() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function sbEnv() {
  loadEnv();
  return {
    URL: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    KEY: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE || '',
    ANON: process.env.SUPABASE_ANON_KEY || '',
    BUCKET: process.env.SUPABASE_BUCKET || 'card-images',
  };
}
export const hasCreds = (e) => !!(e.URL && e.KEY);

// Supabase REST/Storage (service_role)
export function sbHeaders(KEY) { return { apikey: KEY, Authorization: `Bearer ${KEY}` }; }

export async function sbSelect(env, table, query = '') {
  const res = await fetch(`${env.URL}/rest/v1/${table}?${query}`, { headers: { ...sbHeaders(env.KEY), Accept: 'application/json' } });
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
export async function sbUpsert(env, table, rows, onConflict) {
  const q = onConflict ? `?on_conflict=${onConflict}` : '';
  const res = await fetch(`${env.URL}/rest/v1/${table}${q}`, {
    method: 'POST',
    headers: { ...sbHeaders(env.KEY), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
export async function sbUploadObject(env, key, buf, mime) {
  const encKey = key.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${env.URL}/storage/v1/object/${env.BUCKET}/${encKey}`, {
    method: 'POST',
    headers: { ...sbHeaders(env.KEY), 'Content-Type': mime || 'application/octet-stream', 'x-upsert': 'true' },
    body: buf,
  });
  if (!res.ok && res.status !== 409) throw new Error(`upload ${key} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${env.URL}/storage/v1/object/public/${env.BUCKET}/${encKey}`;
}

const c = (n) => (s) => `\x1b[${n}m${s}\x1b[0m`;
export const ui = {
  info: (s) => console.log(c(36)('• ') + s),
  ok: (s) => console.log(c(32)('✓ ') + s),
  warn: (s) => console.log(c(33)('⚠ ') + s),
  err: (s) => console.log(c(31)('✗ ') + s),
  dim: (s) => console.log(c(90)(s)),
};
