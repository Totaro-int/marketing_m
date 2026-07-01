// seo.mjs — 자사몰 인사이트 GEO/SEO 색인 유틸(내장 · 인증키 불요).
// 클라이언트 패키지에 정식 편입된 "색인기"다. publish-insight 와 scripts/seo-index CLI 가 공유.
//   · IndexNow: 네이버 서치어드바이저 + api.indexnow.org(→ Bing·Yandex·Seznam·ChatGPT 공유) 즉시 색인 통보.
//     인증 = 도메인 루트에 <key>.txt 호스팅(자동 생성). Google API 키/OAuth 불필요.
//   · sitemap.xml / llms.txt / IndexNow 키파일 을 사이트 루트에 유지.
// 구글: 공식 즉시색인 API 없음 → sitemap 자동 크롤(여기서 유지) + 1회 Search Console 소유확인(소유자 수동).
import fs from 'node:fs';
import path from 'node:path';

export const BASE_URL = 'https://melanoir.co.kr';
// IndexNow 키(공개 안전 — 도메인 소유 증명용 토큰일 뿐, 비밀 아님). 도메인 루트 <key>.txt 로 호스팅.
export const INDEXNOW_KEY = '7f3c9e21b8d4f06a5c1e9b3d7f2068ca';
const INDEXNOW_ENDPOINTS = ['https://searchadvisor.naver.com/indexnow', 'https://api.indexnow.org/indexnow'];

// 도메인 루트에 IndexNow 키파일 보장(<siteRoot>/<key>.txt → https://도메인/<key>.txt)
export function ensureIndexNowKey(siteRoot) {
  const p = path.join(siteRoot, `${INDEXNOW_KEY}.txt`);
  const created = !fs.existsSync(p);
  if (created) fs.writeFileSync(p, INDEXNOW_KEY);
  return { path: p, url: `${BASE_URL}/${INDEXNOW_KEY}.txt`, created };
}

// sitemap.xml 에 URL 추가(중복 방지). 파일 없으면 skip(false). urls=문자열 배열.
export function updateSitemap(siteRoot, urls) {
  const p = path.join(siteRoot, 'sitemap.xml');
  if (!fs.existsSync(p)) return false;
  let xml = fs.readFileSync(p, 'utf-8');
  for (const u of urls) if (!xml.includes(`<loc>${u}</loc>`)) xml = xml.replace('</urlset>', `  <url><loc>${u}</loc></url>\n</urlset>`);
  fs.writeFileSync(p, xml);
  return true;
}

// llms.txt — AI 크롤러용 사이트/인사이트 안내(emerging standard). cards=[{date,title,subtitle}]
export function writeLlmsTxt(siteRoot, cards, baseUrl = BASE_URL) {
  const L = ['# 멜라누아 (Melanoir)', '', '> 반영구 색소·멜라닌 기반 PMU 브랜드. 멜라닌 단일 색소 설계와 공인기관 자가품질검사로 안전을 숫자로 증명한다.', '', '## 인사이트 (Insights)', ''];
  for (const c of [...(cards || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))) {
    if (c.date) L.push(`- [${(c.title || c.date)}](${baseUrl}/insights/${c.date}): ${c.subtitle || ''}`);
  }
  L.push('', '## 제품 (Products)', `- [엠보 반영구 색소](${baseUrl}/products/embo)`, '');
  fs.writeFileSync(path.join(siteRoot, 'llms.txt'), L.join('\n'));
}

// IndexNow 즉시 색인 통보. urls=발행 URL 배열. 반환: [{url,endpoint,status,ok}]
export async function pingIndexNow(urls, { log = console.log } = {}) {
  const out = [];
  for (const u of urls) for (const ep of INDEXNOW_ENDPOINTS) {
    const who = ep.includes('naver') ? 'Naver ' : '공통  ';
    try {
      const r = await fetch(`${ep}?url=${encodeURIComponent(u)}&key=${INDEXNOW_KEY}`);
      out.push({ url: u, endpoint: ep, status: r.status, ok: r.ok });
      log(`  IndexNow ${who} ${r.status} ${u}`);
    } catch (e) {
      out.push({ url: u, endpoint: ep, status: 0, ok: false, error: e.message });
      log(`  IndexNow 실패(${who.trim()}): ${e.message}`);
    }
  }
  return out;
}

// 색인 오케스트레이터 — 사이트 루트의 sitemap/llms/keyfile 유지 + (ping시) IndexNow 통보.
// { siteRoot, urls, cards, ping } → 리포트. urls 미지정이면 cards 최신분에서 /insights/<date> 유도.
export async function seoIndex({ siteRoot, urls, cards = [], ping = true, log = console.log } = {}) {
  if (!siteRoot) throw new Error('seoIndex: siteRoot 필요');
  const targetUrls = (urls && urls.length)
    ? urls
    : [`${BASE_URL}/insights`, ...[...cards].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 1).filter(c => c.date).map(c => `${BASE_URL}/insights/${c.date}`)];
  const key = ensureIndexNowKey(siteRoot);
  const sitemap = updateSitemap(siteRoot, targetUrls);
  writeLlmsTxt(siteRoot, cards);
  log(`  색인 자산: sitemap ${sitemap ? '갱신' : '없음'} · llms.txt · IndexNow키 ${key.created ? '생성' : 'OK'}`);
  const pings = ping ? await pingIndexNow(targetUrls, { log }) : [];
  const okCount = pings.filter(p => p.ok).length;
  if (ping) log(`  IndexNow 통보: ${okCount}/${pings.length} OK · 대상 ${targetUrls.length}개 URL`);
  return { urls: targetUrls, sitemap, keyFile: key, pings, okCount };
}
