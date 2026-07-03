#!/usr/bin/env node
// story.mjs — 작가·기자 레이어(상류 원천 콘텐츠) 결정론 단계. 구동 = Claude Code 플러그인(구독) — API 직접 호출 금지.
//   집필 = melanoir-storyteller(essay·campaign) / melanoir-journalist(feature·column·press) 서브에이전트.
//   이 파일은 그 앞뒤 결정론만:
//     --brief <topic|"주제"> [--style essay|feature|press|campaign] [--stance]
//         → out/sbrief_NN.json (주제+thesis+facts+verified-sources+락+구조템플릿+골드 few-shot)
//     [작가/기자 에이전트가 sbrief 읽고 out/dossier_NN.json 작성 — 명령/스킬이 디스패치]
//     --finalize <dossier>  → guardArticle(브랜드락+인용락) + figures 렌더 + md 추출 → out/final_article_NN.json
//     --offline <topic>     → 스켈레톤 도시어→finalize (파이프라인 결정론 테스트용. 골드 품질 아님)
//     --check <topicId>     → 승인된 도시어 유무 (daily 파생용)
//
//   dossier 스키마 (SSoT — sbrief.dossierSchema 로 에이전트에 주입):
//   { id, style, stance?, topic, thesis, layer, voice, title, subtitle?, lead,
//     factRefs: ["P-001","VS-001"], citations: [{marker:1, ref:"P-001"}],
//     sections: [{ h, body(markdown, 각주 [1]), pullQuote, figure? }],
//     conclusion, figures: [{ id, type, data, caption, factRefs }],
//     pendingFacts: [{ claim, value, quote, sourceTitle, publisher, publishedAt, url, reliability }],
//     images: [{ url, license, source, credit }],
//     derivatives: { keyLines: [...], beats: [...], seo: { title, description } } }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guardArticle, loadVerifiedSources, dossierFullText, DNA } from './guard.mjs';
import { renderDossierFigures } from './figure.mjs';
import { resolveTopic, readLearnings } from './generate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const GOLD_DIR = path.join(ROOT, 'reference', 'gold-articles');
const pad2 = n => String(n).padStart(2, '0');

// ---- 스타일 결정: 인자 > 토픽 레이어 (data→feature, 그 외→essay) ----
export const STYLES = { essay: 'melanoir-storyteller', campaign: 'melanoir-storyteller', feature: 'melanoir-journalist', column: 'melanoir-journalist', press: 'melanoir-journalist' };
export function styleForTopic(topic, styleArg) {
  if (styleArg) {
    const s = styleArg === 'column' ? 'feature' : styleArg; // column = feature 의 stance 모드
    if (!STYLES[s]) throw new Error(`style '${styleArg}' 미지원 (${Object.keys(STYLES).join('/')})`);
    return { style: s, stance: styleArg === 'column' };
  }
  return { style: topic.layer === 'data' ? 'feature' : 'essay', stance: false };
}

const TEMPLATES = {
  essay: {
    voice: 'storyteller', persona: '브랜드 1인칭("우리는") — 문학적·선언적. 브랜드가 말한다.',
    arc: '긴장(왜 이 브랜드가 존재해야 했나 — 통념·공백·불편) → 전환(우리가 내린 결정과 그 대가) → 선언(그래서 우리는 무엇인가)',
    sections: '3~5개 (아크의 비트)', chars: '2,000~4,000자',
    forbid: '본문에 제품 수치(0.00·97%·All N.D.·ISO 10993-23) 귀속 금지 — 측정했다는 접근·태도만.',
  },
  campaign: {
    voice: 'storyteller', persona: '2인칭("당신") — 초대·긍정. 비장·과장 금지.',
    arc: '초대의 이유(당신에게 왜 지금인가) → 우리가 준비한 것 → 함께 만드는 다음. CTA는 마지막 1문장.',
    sections: '3~4개', chars: '1,000~2,500자',
    forbid: '본문에 제품 수치 귀속 금지(모집·캠페인 레이어). 시험 "했다"는 접근 언급은 허용.',
  },
  feature: {
    voice: 'journalist', persona: '3인칭 객관 — 멜라누아도 취재 대상처럼. 자사 홍보 톤 = 실패. 정확성이 우아함.',
    arc: '리드(장면/긴장 1문단) → 넛그래프(왜 지금 중요한가) → 메커니즘(어떻게 작동하나) → 숫자(측정과 결과, 인용과 함께) → 의미(독자에게 남는 것)',
    sections: '3~5개', chars: '1,500~3,000자',
    forbid: '근거 없는 수치·연도 금지(인용락). 일반 과학 문장에 제품명 병치 금지. 용어 분리(검출/N.D.=유해물질 전용).',
  },
  press: {
    voice: 'journalist', persona: '기관 보이스 — 건조·3인칭. 역피라미드.',
    arc: '헤드라인 → 리드(누가·무엇을·왜) → 본문(근거·맥락) → 인용문(대표 코멘트 1개) → 보일러플레이트 → 예상 Q&A 2~3',
    sections: '4~6개', chars: '800~1,800자',
    forbid: '최상급·과장 금지. 효능 주장 금지. 수치는 인용락.',
  },
};

function goldFewShot(style) {
  if (!fs.existsSync(GOLD_DIR)) return [];
  return fs.readdirSync(GOLD_DIR).filter(f => f.startsWith('gold_') && f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(GOLD_DIR, f), 'utf-8')))
    .filter(d => d.style === style).slice(0, 2);
}

// ---- sbrief: 작가/기자 에이전트가 읽는 구조화 입력 (LLM 호출 없음) ----
export function buildStoryBrief(topicArg, { style: styleArg, stance: stanceArg } = {}) {
  const topic = resolveTopic(topicArg);
  const { style, stance } = styleForTopic(topic, styleArg);
  const agent = STYLES[style];
  const t = TEMPLATES[style];
  const layer = style === 'feature' || style === 'press' ? (topic.layer === 'data' ? 'data' : topic.layer) : topic.layer;
  const facts = style === 'essay' || style === 'campaign'
    ? DNA.facts.filter(f => f.layer !== 'data' && f.bodyExposure !== false) // essay 는 제품 수치·비노출 성분 사실을 주지 않는다(레이어 분리)
    : DNA.facts.filter(f => f.bodyExposure !== false);
  const writerLocks = fs.readFileSync(path.join(ROOT, 'agents', '_writer-locks.md'), 'utf-8');
  return {
    _agent: agent,
    _instructions: `이 sbrief를 읽고 ${style} 스타일 장문 도시어 JSON을 outputPath에 Write로 저장하라. dossierSchema·구조템플릿·공통 락을 엄격히 지킬 것. JSON 외 텍스트 금지.`,
    topic: { id: topic.id, title: topic.title, thesis: topic.thesis, layer: topic.layer },
    style, stance, layer,
    structureTemplate: t,
    facts,
    verifiedSources: loadVerifiedSources(),
    brand: { name: DNA.brand.name, handle: DNA.brand.handle, site: DNA.brand.site, productUrl: DNA.brand.productUrl, slogan: DNA.brand.slogan, sloganFrame: DNA.brand.sloganFrame, maker: DNA.brand.maker },
    locks: DNA.locks,
    writerLocks,
    tone: { byLayer: DNA.tone.byLayer, principles: DNA.tone.principles, lexicon: DNA.tone.lexicon },
    learnings: readLearnings().slice(0, 4000),
    fewShot: goldFewShot(style),
    dossierSchema: {
      id: topic.id, style, topic: 'string', thesis: 'string', layer, voice: t.voice,
      title: 'string', subtitle: 'string?', lead: '도입 문단',
      factRefs: ['사용한 근거 id 전부 — facts(P-/F-) 또는 verifiedSources(VS-)'],
      citations: [{ marker: 1, ref: 'P-001 — 본문 [1] 마커와 매핑' }],
      sections: [{ h: '소제목', body: '마크다운 문단 2~4개 (각주 [1])', pullQuote: '발췌 한 줄', figure: 'fig-1 (선택)' }],
      conclusion: '마무리 단락',
      figures: [{ id: 'fig-1', type: 'numberCard|bar|compare|process', data: {}, caption: 'string', factRefs: [] }],
      pendingFacts: [{ claim: '', value: '', quote: '원문 발췌', sourceTitle: '', publisher: '', publishedAt: '', url: '', reliability: 'peer-reviewed|institution|industry|media' }],
      images: [{ url: '', license: 'public-domain|CC0|CC-BY|unsplash|pexels', source: '', credit: '' }],
      derivatives: { keyLines: ['IG 카드 커버 후보 3~5개'], beats: ['서사 비트'], seo: { title: '', description: '' } },
    },
    rules: [
      `구조: ${t.arc}`,
      `분량: ${t.chars}(공백 제외 아님, 대략) · 섹션 ${t.sections}. 섹션마다 pullQuote 1개.`,
      `보이스: ${t.persona}`,
      `스타일 특칙: ${t.forbid}`,
      '인용락: 본문의 모든 수치·연도·연구 언급은 factRefs id 필수. 새 사실은 pendingFacts + ⟦후보 FC-n⟧ 마커 — 본문에 바로 쓰지 말 것.',
      '도식은 figures 스펙만 선언(직접 그리지 않음). figure 수치도 factRefs 필수.',
      'AI 냄새 금지: 단문 나열·불릿 도배·동일 어미 3연속·공허한 수식어·메타 안내.',
      ...(stance ? ['stance 모드(column): 통념→반박→근거→제안 논증 구조, 필자 1인칭 허용. 근거 규율 동일.'] : []),
    ],
    outputPath: path.join(OUT, `dossier_${pad2(topic.id)}.json`),
  };
}

// ---- markdown 추출 (인사이트·보도자료·검토용) ----
export function dossierToMarkdown(d, { figures = {} } = {}) {
  const lines = [`# ${d.title}`, ''];
  if (d.subtitle) lines.push(`> ${d.subtitle}`, '');
  if (d.lead) lines.push(d.lead, '');
  for (const s of d.sections || []) {
    lines.push(`## ${s.h}`, '', s.body, '');
    if (s.figure && figures[s.figure] !== undefined) lines.push(`![${(d.figures || []).find(f => f.id === s.figure)?.caption || s.figure}](figures/${pad2(d.id)}-${s.figure}.svg)`, '');
  }
  if (d.conclusion) lines.push(d.conclusion, '');
  const cits = d.citations || [];
  if (cits.length) {
    const vs = loadVerifiedSources();
    const byId = new Map([...DNA.facts.map(f => [f.id, f]), ...vs.map(s => [s.id, s])]);
    lines.push('---', '', '**참고 문헌**', '');
    for (const c of cits) {
      const f = byId.get(c.ref) || {};
      lines.push(`[${c.marker}] ${f.sourceTitle || f.label || c.ref}${f.publisher ? ` — ${f.publisher}` : ''}${f.publishedAt ? ` (${f.publishedAt})` : ''}${f.test ? ` · ${f.test}` : ''}${f.url ? ` · ${f.url}` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ---- finalize: 에이전트가 쓴 dossier → 가드 + 인용락 + 도식 렌더 (LLM 없음) ----
export function finalizeDossier(input, { figuresDir } = {}) {
  const dossier = typeof input === 'string' ? JSON.parse(fs.readFileSync(input, 'utf-8')) : input;
  const guard = guardArticle(dossier);
  let figures = {};
  if (!guard.blocked && (dossier.figures || []).length) {
    figures = renderDossierFigures(dossier, figuresDir ?? path.join(OUT, 'figures'));
  }
  const markdown = dossierToMarkdown(dossier, { figures });
  return { dossier, guard, figures, markdown };
}

// ---- 승인된 도시어 조회 (daily 파생용): 로컬 final + (creds 시) 콘솔 status ----
export async function approvedDossierFor(topicId) {
  const p = path.join(OUT, `final_article_${pad2(topicId)}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    const { sbEnv, hasCreds, sbSelect } = await import(pathToFileURL(path.join(ROOT, 'scripts', '_lib.mjs')).href);
    const env = sbEnv();
    if (!hasCreds(env)) return process.env.MELANOIR_ALLOW_LOCAL_DOSSIER ? p : null; // 콘솔 승인 확인 불가 → 안전 기본값: 미사용
    const rows = await sbSelect(env, 'marketing_drafts', `?channel=eq.article&campaign_slug=like.article_${pad2(topicId)}*&select=status`);
    return rows.some(r => r.status === 'approved') ? p : null;
  } catch { return null; }
}

// ---- 오프라인 스켈레톤 (파이프라인 결정론 테스트용 — 골드 품질 아님) ----
export function skeletonDossier(topicArg, styleArg) {
  const topic = resolveTopic(topicArg);
  const { style, stance } = styleForTopic(topic, styleArg);
  const isFeature = style === 'feature' || style === 'press';
  const factRefs = isFeature ? ['P-001', 'F-004'] : [];
  const mk = (h, i) => ({
    h: `${h}`,
    body: `${topic.thesis} 이 단락은 파이프라인 검증용 스켈레톤으로, 실제 집필은 ${STYLES[style]} 에이전트가 sbrief를 읽고 수행한다. 흐름이 이어지는 문장으로 골드 호흡을 흉내만 내되, 발행 품질은 아니다.` + (isFeature && i === 2 ? ' 측정 결과는 자극 지수 0.00으로, ISO 10993-23 기준의 측정 범위에서 최솟값이었다.[1]' : ''),
    pullQuote: `${topic.title} — 스켈레톤 발췌 ${i + 1}`,
    ...(isFeature && i === 2 ? { figure: 'fig-1' } : {}),
  });
  return {
    id: topic.id, style, stance, topic: topic.title, thesis: topic.thesis,
    layer: isFeature ? 'data' : topic.layer, voice: TEMPLATES[style].voice,
    title: `${topic.title} (스켈레톤)`, subtitle: '파이프라인 테스트', lead: `${topic.thesis} 도입 문단 스켈레톤이다.`,
    factRefs, citations: isFeature ? [{ marker: 1, ref: 'P-001' }] : [],
    sections: ['첫 번째 비트', '두 번째 비트', '세 번째 비트'].map(mk),
    conclusion: '스켈레톤 마무리 — 실제 발행 금지.',
    figures: isFeature ? [{ id: 'fig-1', type: 'numberCard', data: { number: '0.00', label: '피부 자극 지수', sub: 'ISO 10993-23 · 측정 범위의 최솟값' }, caption: '피부 자극 지수 0.00 (ISO 10993-23)', factRefs: ['P-001', 'F-004'] }] : [],
    pendingFacts: [], images: [],
    derivatives: { keyLines: [`${topic.title}`], beats: ['긴장', '척도', '의미'], seo: { title: topic.title, description: topic.thesis } },
    _generated: 'skeleton-offline',
  };
}

// ---- CLI ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = args.find(a => a.startsWith('--') && !['--style', '--stance', '--out'].includes(a)) || '--brief';
  const val = args.filter(a => !a.startsWith('--')).find((a, i, arr) => { const pi = args.indexOf(a) - 1; return !(pi >= 0 && ['--style', '--out'].includes(args[pi])); }) ?? '1';
  const si = args.indexOf('--style'); const styleArg = si >= 0 ? args[si + 1] : undefined;
  const oi = args.indexOf('--out'); const outOverride = oi >= 0 ? args[oi + 1] : null;
  const stance = args.includes('--stance');
  fs.mkdirSync(OUT, { recursive: true });

  if (flag === '--brief') {
    const brief = buildStoryBrief(val, { style: stance && !styleArg ? 'column' : styleArg, stance });
    const p = outOverride || path.join(OUT, `sbrief_${pad2(brief.topic.id)}.json`);
    fs.writeFileSync(p, JSON.stringify(brief, null, 2));
    console.log(`sbrief → ${path.relative(ROOT, p)}  (style=${brief.style}${brief.stance ? '·stance' : ''} · agent=${brief._agent})`);
    console.log(`다음: ${brief._agent} 에이전트가 이 sbrief를 읽고 ${path.relative(ROOT, brief.outputPath)} 작성 → story.mjs --finalize`);
  } else if (flag === '--finalize') {
    const { dossier, guard, markdown } = finalizeDossier(val);
    const id2 = pad2(dossier.id);
    if (guard.blocked) {
      console.error(`finalize BLOCKED (${guard.findings.filter(f => f.sev === 'block').length} blocks):`);
      for (const f of guard.findings.filter(f => f.sev === 'block')) console.error(`  [block] ${f.where} ${f.id}: ${f.match} — ${f.reason}`);
      process.exit(1);
    }
    if (guard.pending) {
      console.error(`finalize PENDING — 미승인 사실 후보 ${guard.pending}건. 발행 불가(draft).`);
      console.error(`  → node scripts/fact-candidates.mjs --submit ${typeof val === 'string' ? val : ''} 로 제출 → 콘솔/로컬 승인 → --pull → 본문 반영 후 재-finalize`);
      const p = outOverride || path.join(OUT, `draft_article_${id2}.json`);
      fs.writeFileSync(p, JSON.stringify(dossier, null, 2));
      console.log(`draft → ${path.relative(ROOT, p)}`);
      process.exit(3);
    }
    const p = outOverride || path.join(OUT, `final_article_${id2}.json`);
    fs.writeFileSync(p, JSON.stringify(dossier, null, 2));
    fs.writeFileSync(path.join(OUT, `article_${id2}.md`), markdown);
    const warns = guard.findings.filter(f => f.sev === 'warn');
    console.log(`finalize → ${path.relative(ROOT, p)}  guard=OK (warn ${warns.length}) · ${guard.chars}자 · figures ${Object.keys(dossier.figures || {}).length || (dossier.figures || []).length}개 · md=out/article_${id2}.md`);
    for (const w of warns) console.log(`  [warn] ${w.where} ${w.id}: ${w.match} — ${w.reason}`);
  } else if (flag === '--offline') {
    const d = skeletonDossier(val, styleArg);
    const { guard, markdown } = finalizeDossier(d);
    const id2 = pad2(d.id);
    const p = outOverride || path.join(OUT, `final_article_${id2}.json`);
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    fs.writeFileSync(path.join(OUT, `article_${id2}.md`), markdown);
    console.log(`[skeleton] → ${path.relative(ROOT, p)}  guard=${guard.blocked ? 'BLOCKED' : 'OK'} (${guard.chars}자) — 골드 품질 아님(테스트용·발행 금지)`);
    if (guard.blocked) { for (const f of guard.findings.filter(f => f.sev === 'block')) console.error(`  [block] ${f.where} ${f.id}: ${f.match} — ${f.reason}`); process.exit(1); }
  } else if (flag === '--check') {
    const p = await approvedDossierFor(Number(val));
    console.log(p ? `approved dossier: ${path.relative(ROOT, p)}` : `토픽 ${val}: 승인된 도시어 없음`);
  } else { console.error('usage: story.mjs --brief <topic> [--style s] [--stance] | --finalize <dossier> | --offline <topic> [--style s] | --check <topicId>'); process.exit(2); }
}
