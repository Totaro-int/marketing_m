#!/usr/bin/env node
// verify-story.mjs — 작가·기자 레이어 검증 (오프라인 · creds 불요).
//   sbrief 구성 · 스켈레톤 finalize · 인용락(수치/ref/pending) · 레이어 분리 · 이미지 정책
//   · figure 4종 렌더 · 인사이트 dossier 모드(참고문헌+JSON-LD citation+SVG) · brief 도시어 주입
// 사용: node scripts/verify-story.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ui, ROOT } from './_lib.mjs';
import { buildStoryBrief, skeletonDossier, finalizeDossier } from '../engine/story.mjs';
import { guardArticle } from '../engine/guard.mjs';
import { renderFigure } from '../engine/figure.mjs';
import { buildInsightArticle } from '../engine/insight-page.mjs';
import { buildBrief } from '../engine/generate.mjs';
import { buildChannelBrief } from '../engine/channels.mjs';

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; ui.ok(name); } else { fail++; ui.err('FAIL ' + name); } };
const base = { id: 5, style: 'feature', layer: 'data', thesis: 't', title: 'x', lead: 'l', conclusion: 'c', sections: [{ h: 'a', body: 'b', pullQuote: 'p' }] };

// 1) sbrief
const bf = buildStoryBrief(5);
t('sbrief: data 토픽 → feature · journalist', bf.style === 'feature' && bf._agent === 'melanoir-journalist');
const be = buildStoryBrief(1);
t('sbrief: 선언 토픽 → essay · storyteller', be.style === 'essay' && be._agent === 'melanoir-storyteller');
t('sbrief: essay엔 데이터 facts 미주입(레이어 분리)', !be.facts.some(f => f.layer === 'data'));
t('sbrief: writer-locks 포함', (bf.writerLocks || '').includes('인용락'));
const bc = buildStoryBrief(5, { style: 'column' });
t('sbrief: column = feature + stance', bc.style === 'feature' && bc.stance === true);

// 2) 스켈레톤 finalize (feature: 수치+각주+figure 포함)
const sk = skeletonDossier(5);
const fz = finalizeDossier(sk, { figuresDir: path.join(ROOT, 'out', 'figures') });
t('skeleton feature: guard OK', !fz.guard.blocked && !fz.guard.pending);
t('skeleton feature: figure SVG 렌더', Object.values(fz.figures).every(s => s.startsWith('<svg')) && Object.keys(fz.figures).length === 1);
t('skeleton feature: markdown에 참고 문헌', fz.markdown.includes('참고 문헌') && fz.markdown.includes('[1]'));
const ske = skeletonDossier(1, 'essay');
t('skeleton essay: guard OK (수치 없음)', !finalizeDossier(ske).guard.blocked);

// 3) 인용락
t('인용락: 근거 없는 수치 → block', guardArticle({ ...base, lead: '연구에 따르면 83%가 그렇다.', factRefs: ['P-001'] }).findings.some(f => f.id === 'cite-lock' && f.sev === 'block'));
t('인용락: 근거 있는 수치(0.00) → OK', !guardArticle({ ...base, lead: '자극 지수 0.00이었다.', factRefs: ['P-001'] }).blocked);
t('인용락: 미등록 ref → block', guardArticle({ ...base, factRefs: ['VS-999'] }).blocked);
t('인용락: ⟦후보⟧ 마커 → pending', guardArticle({ ...base, lead: '⟦후보 FC-1⟧이라 한다.', factRefs: [] }).pending === 1);
t('인용락: figure factRefs 누락 → block', guardArticle({ ...base, factRefs: ['P-001'], figures: [{ id: 'f1', type: 'bar', data: {}, caption: 'c' }] }).blocked);

// 4) 레이어 분리·브랜드락 (장문)
t('레이어: essay에 제품 수치 → block', guardArticle({ ...base, style: 'essay', layer: 'declaration', lead: '우리는 0.00을 얻었다.' }).findings.some(f => f.id === 'L-05'));
t('브랜드락: 금지어(28종) → block', guardArticle({ ...base, lead: '28종 검사를 했다.', factRefs: [] }).blocked);
t('브랜드락: 효능 주장 → block', guardArticle({ ...base, lead: '트러블이 줄어듭니다.', factRefs: [] }).blocked);

// 5) 이미지 정책
t('이미지: 라이선스 불명 → block', guardArticle({ ...base, factRefs: [], images: [{ url: 'https://x/y.jpg', license: 'unknown', source: 's' }] }).blocked);
t('이미지: CC-BY 크레딧 없음 → block', guardArticle({ ...base, factRefs: [], images: [{ url: 'https://x/y.jpg', license: 'CC-BY', source: 's' }] }).blocked);
t('이미지: CC0 + 메타 → OK', !guardArticle({ ...base, factRefs: [], images: [{ url: 'https://x/y.jpg', license: 'CC0', source: 'wikimedia' }] }).blocked);

// 6) figure 4종
for (const [type, data] of [['numberCard', { number: '0.00', label: 'L' }], ['bar', { items: [{ label: 'a', value: 3 }] }], ['compare', { items: [{ label: 'a', value: '1' }, { label: 'b', value: '2' }] }], ['process', { steps: ['하나', '둘', '셋'] }]]) {
  const svg = renderFigure({ type, data });
  t(`figure ${type}: SVG + 브랜드 골드`, svg.startsWith('<svg') && svg.includes('194,161,90'));
}

// 7) 인사이트 dossier 모드
const ins = buildInsightArticle(sk, { date: '2026-01-01', slug: 'v', figures: fz.figures });
t('인사이트: 참고 문헌 섹션', ins.html.includes('참고 문헌') && ins.html.includes('id="ref-1"'));
t('인사이트: JSON-LD citation', Array.isArray(ins.ld.citation) && ins.ld.citation.length === 1);
t('인사이트: inline SVG 도식', ins.html.includes('<svg'));
t('인사이트: 각주 위첨자 링크', ins.html.includes('href="#ref-1"'));

// 8) 파생 주입 (brief/chbrief --dossier)
const tmp = path.join(ROOT, 'out', '_verify_dossier.json');
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(tmp, JSON.stringify(sk));
t('generate: brief에 dossier 주입', !!buildBrief(5, { dossierPath: tmp }).dossier?.keyLines);
t('generate: 미지정 시 주입 없음(승인 게이트)', !buildBrief(5).dossier);
t('channels: chbrief에 dossier 주입', !!buildChannelBrief(5, { dossierPath: tmp }).dossier);
try { fs.unlinkSync(tmp); } catch { /* 샌드박스 unlink 제한 무해 */ }

console.log('');
if (fail) { ui.err(`verify-story: ${fail} 실패 / ${pass} 통과`); process.exit(1); }
ui.ok(`verify-story: 전체 통과 (${pass})`);
