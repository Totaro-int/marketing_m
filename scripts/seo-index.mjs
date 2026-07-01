#!/usr/bin/env node
// seo-index.mjs — 자사몰 인사이트 색인기(내장 · 인증키 불요). `/melanoir` 발행이 자동 호출하고,
// 재색인/수동 통보용으로 단독 실행도 된다: `npm run seo:index`
//   대상 사이트: --target <insights디렉터리> · 없으면 $MELANOIR_SITE_REPO · 없으면 로컬 web/site/insights
//   옵션: --url <URL>(반복 가능, 특정 URL만 통보) · --no-ping(자산만 갱신, IndexNow 통보 생략)
// 하는 일: sitemap.xml/llms.txt/IndexNow 키파일 유지 + IndexNow(네이버·Bing·Yandex·ChatGPT) 즉시 색인 통보.
// 구글: 공식 즉시색인 API 없음 → sitemap 자동크롤 + 1회 Search Console 소유확인(소유자 수동, README/RUNBOOK 참고).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seoIndex, BASE_URL } from '../engine/seo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const val = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const urls = argv.reduce((a, v, i) => (v === '--url' && argv[i + 1] ? [...a, argv[i + 1]] : a), []);
const ping = !argv.includes('--no-ping');

const TARGET = path.resolve(val('--target') || process.env.MELANOIR_SITE_REPO || path.join(ROOT, 'web', 'site', 'insights'));
const siteRoot = path.resolve(TARGET, '..');

if (!fs.existsSync(siteRoot)) { console.error(`✗ 사이트 루트 없음: ${siteRoot}\n  --target <자사몰 insights 디렉터리> 또는 .env.local 의 MELANOIR_SITE_REPO 확인.`); process.exit(1); }

let cards = [];
const cardsPath = path.join(TARGET, 'cards.json');
if (fs.existsSync(cardsPath)) { try { cards = JSON.parse(fs.readFileSync(cardsPath, 'utf-8')); } catch { cards = []; } }

console.log(`색인기 — 사이트 루트 ${siteRoot}`);
console.log(`  대상 URL: ${urls.length ? urls.join(', ') : `(자동: /insights + 최신 인사이트, cards.json ${cards.length}개)`}`);
console.log(`  IndexNow 통보: ${ping ? 'ON (네이버·Bing·Yandex·ChatGPT)' : 'OFF (--no-ping · 자산만 갱신)'}`);

const rep = await seoIndex({ siteRoot, urls, cards, ping });
console.log(`✓ 색인 ${ping ? `통보 ${rep.okCount}/${rep.pings.length} OK` : '자산 갱신'} · 키파일 ${rep.keyFile.url}`);
if (ping && rep.okCount === 0 && rep.pings.length) console.log('  ⚠ 전부 실패 — 사이트가 아직 라이브가 아니거나(키파일 미노출) 네트워크 문제. 사이트 배포 후 재실행 권장.');
console.log(`  구글: sitemap 자동크롤 유지됨. 즉시색인 API는 없음 → 1회 Search Console 소유확인(소유자) 후 자동 색인.`);
