#!/usr/bin/env node
// apply-schema.mjs — supabase/schema.sql 을 Postgres에 직접 적용(DDL). 파일에서 읽으므로 전사 오류 0.
// 연결: 직접(db.{ref}) → 세션 풀러(aws-N-{region}) 순서로 시도. SSL 필수.
// 사용: node scripts/apply-schema.mjs  (.env.local 의 SUPABASE_URL + SUPABASE_DB_PASSWORD 사용)
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadEnv, ROOT, ui } from './_lib.mjs';

loadEnv();
const URL = process.env.SUPABASE_URL || '';
const PW = process.env.SUPABASE_DB_PASSWORD || '';
const ref = (URL.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
if (!ref || !PW) { ui.err('SUPABASE_URL / SUPABASE_DB_PASSWORD 필요(.env.local)'); process.exit(2); }
const region = process.env.SUPABASE_REGION || 'ap-northeast-2';
const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'schema.sql'), 'utf-8');

const candidates = [
  { label: 'direct', host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres' },
  { label: 'session-pooler(aws-0)', host: `aws-0-${region}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { label: 'session-pooler(aws-1)', host: `aws-1-${region}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
];

async function tryRun(c) {
  const client = new pg.Client({ host: c.host, port: c.port, user: c.user, password: PW, database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000, query_timeout: 60000 });
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(`select tablename from pg_tables where schemaname='public' order by tablename`);
  const { rows: pub } = await client.query(`select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by tablename`);
  await client.end();
  return { tables: rows.map(r => r.tablename), realtime: pub.map(r => r.tablename) };
}

let lastErr;
for (const c of candidates) {
  try {
    ui.info(`연결 시도: ${c.label} (${c.host}:${c.port})`);
    const r = await tryRun(c);
    ui.ok(`스키마 적용 완료 via ${c.label}`);
    const need = ['marketing_drafts', 'feedback', 'sources', 'learnings'];
    const have = need.filter(t => r.tables.includes(t));
    ui.ok(`public 테이블: ${r.tables.join(', ')}`);
    console.log(`  4테이블 확인: ${have.length}/4 (${have.join(', ')})`);
    console.log(`  realtime publication: ${r.realtime.join(', ') || '(없음)'}`);
    process.exit(have.length === 4 ? 0 : 1);
  } catch (e) { lastErr = e; ui.warn(`${c.label} 실패: ${e.message.slice(0, 80)}`); }
}
ui.err('모든 연결 실패: ' + (lastErr?.message || '')); process.exit(1);
