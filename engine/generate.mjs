#!/usr/bin/env node
// 콘텐츠 생성 — BUILD-SPEC §0 정정: 구동은 Claude Code 플러그인(구독). Anthropic API 직접 호출 금지.
// 생성 = melanoir-copywriter 서브에이전트(구독 LLM)가 brief→spec 작성. 이 파일은 그 앞뒤 결정론 단계만:
//   --brief <topic>      → out/brief_NN.json (토픽+thesis+레이어+facts+락+톤+콘텐츠모델+골드 few-shot, LLM 없음)
//   [copywriter 에이전트가 brief 읽고 spec_NN.json 작성 — 명령/스킬이 디스패치]
//   --finalize <spec>    → image-assign + caption + guard → 최종 스펙 (LLM 없음)
//   --offline <topic>    → 스켈레톤→finalize (에이전트 없이 파이프라인 결정론 테스트용. 골드 품질 아님)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assignImages } from './image-assign.mjs';
import { buildCaption } from './caption.mjs';
import { guardSpec } from './guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DNA = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/brand-dna.json'), 'utf-8'));
const SPECDIR = path.join(ROOT, 'reference/gold-reference/carousel_specs');
const OUT = path.join(ROOT, 'out');

export function readLearnings() {
  const dir = path.join(ROOT, 'learnings');
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir).filter(f => /\.(md|json|txt)$/.test(f) && !f.startsWith('_'))
    .map(f => fs.readFileSync(path.join(dir, f), 'utf-8')).join('\n\n');
}
function fewShot(layer) {
  const pick = layer === 'data' ? [5, 4] : layer === 'recruit' ? [9] : layer === 'product' ? [10] : layer === 'identity' ? [8] : [1, 2];
  return pick.map(n => {
    const p = path.join(SPECDIR, `carousel_${String(n).padStart(2, '0')}.json`);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null;
  }).filter(Boolean);
}
export function resolveTopic(arg) {
  if (/^\d+$/.test(String(arg))) {
    const t = DNA.topics.find(t => t.id === Number(arg));
    if (t) return { ...t, free: false };
  }
  return { id: 99, title: String(arg), thesis: String(arg), layer: 'declaration', length: 7, free: true };
}

// ---- brief: copywriter 에이전트가 읽는 구조화 입력 (LLM 호출 없음) ----
export function buildBrief(topicArg) {
  const topic = resolveTopic(topicArg);
  const facts = (topic.factIds || []).map(id => DNA.facts.find(f => f.id === id)).filter(Boolean);
  return {
    _agent: 'melanoir-copywriter',
    _instructions: '이 brief를 읽고 캐러셀 스펙 JSON을 outputPath에 Write로 저장하라. 스펙 스키마·콘텐츠모델·브랜드락을 엄격히 지킬 것. JSON 외 텍스트 금지.',
    topic: { id: topic.id, title: topic.title, thesis: topic.thesis, layer: topic.layer, length: topic.length || 7 },
    facts,
    brand: { name: DNA.brand.name, handle: DNA.brand.handle, productUrl: DNA.brand.productUrl, slogan: DNA.brand.slogan, sloganFrame: DNA.brand.sloganFrame },
    locks: DNA.locks,
    tone: { byLayer: DNA.tone.byLayer, principles: DNA.tone.principles, lexicon: DNA.tone.lexicon },
    contentModel: DNA.contentModel,
    learnings: readLearnings().slice(0, 4000),
    fewShot: fewShot(topic.layer),
    specSchema: {
      id: topic.id, topic: 'string', thesis: 'string', layer: topic.layer,
      slides: ['{type:cover_stmt, lines:[...]} | {type:cover_data, number, label, hook} | {type:body, mode:A|B|C, num:"01", title, segments:[[gray,false],[highlight,true]]} | {type:closing, lines:[...]}'],
      caption: 'string (후킹→설명→(데이터)홈페이지안내→더 알아보기 →→URL→해시태그)',
    },
    rules: [
      '길이 7~10장(커버1+본문5~8+마무리1). 회색 부연 2~3문장(60~110자). 본문 핵심 1문장만 highlight=true.',
      `금지어: ${DNA.locks.bannedExact.join(' / ')}. '안전하다/무독성' 단독·'100% 안전' 금지.`,
      '검출/불검출(N.D.)=유해물질 자가품질검사 전용. ISO 10993-23=자극 지수, 세포독성=생존율.',
      `레이어 분리: ${DNA.locks.layerSeparation.forbiddenInLayers.join('/')} 레이어 본문에 제품 수치(0.00·97%·All N.D.·ISO 10993-23) 귀속 금지.`,
      '시험성적서 공개/원본 금지 → "시험 기준·데이터는 홈페이지에서". 슬라이드에 "→ URL" 금지(링크는 캡션). image 필드 넣지 말 것(후처리 배정).',
      '브랜드 facts에 없는 수치·날짜·인용 만들지 말 것.',
    ],
    outputPath: path.join(OUT, `spec_${String(topic.id).padStart(2, '0')}.json`),
  };
}

// ---- finalize: 에이전트가 쓴 spec → 이미지 배정 + 캡션 + 가드 (LLM 없음) ----
export function finalizeSpec(specInput) {
  let spec = typeof specInput === 'string' ? JSON.parse(fs.readFileSync(specInput, 'utf-8')) : specInput;
  spec = assignImages(spec);
  if (!spec.caption) spec.caption = buildCaption(spec);
  const guard = guardSpec(spec);
  return { spec, guard };
}

// ---- 오프라인 스켈레톤 (에이전트 없이 결정론 파이프라인 테스트용 — 골드 품질 아님) ----
export function skeletonSpec(topicArg) {
  const topic = resolveTopic(topicArg);
  const n = Math.max(3, (topic.length || 7) - 2);
  const slides = [];
  const isDataNum = topic.layer === 'data' && /0\.00|97%|N\.D|\d/.test(topic.title);
  if (isDataNum) {
    const num = (topic.title.match(/0\.00|97%|All N\.D\.|[0-9.]+%?/) || ['0.00'])[0];
    slides.push({ type: 'cover_data', number: num, label: topic.title.replace(num, '').trim() || '데이터', hook: '느낌이 아니라 숫자로 확인합니다.' });
  } else slides.push({ type: 'cover_stmt', lines: [topic.title + '.'] });
  for (let i = 1; i <= n; i++) slides.push({
    type: 'body', mode: i % 2 ? 'C' : 'A', num: String(i).padStart(2, '0'),
    title: `${topic.title}, 그 ${i}번째 이야기.`,
    segments: [[`${topic.thesis} 이 슬라이드는 그 흐름의 ${i}단계를 담백하게 설명하는 회색 부연입니다.`, false], ['핵심 메시지를 한 문장으로 분명하게 전합니다.', true]],
  });
  slides.push({ type: 'closing', lines: ['멜라누아는', topic.layer === 'declaration' ? DNA.brand.slogan + '을 추구합니다.' : '숫자로 말합니다.'] });
  return { id: topic.id, topic: topic.title, thesis: topic.thesis, layer: topic.layer, slides, _generated: 'skeleton-offline' };
}

// ---- CLI ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = args.find(a => a.startsWith('--')) || '--brief';
  const val = args.find(a => !a.startsWith('--')) ?? '1';
  const oi = args.indexOf('--out'); const outOverride = oi >= 0 ? args[oi + 1] : null;
  fs.mkdirSync(OUT, { recursive: true });

  if (flag === '--brief') {
    const brief = buildBrief(val);
    const p = outOverride || path.join(OUT, `brief_${String(brief.topic.id).padStart(2, '0')}.json`);
    fs.writeFileSync(p, JSON.stringify(brief, null, 2));
    console.log(`brief → ${path.relative(ROOT, p)}`);
    console.log(`다음: melanoir-copywriter 에이전트가 이 brief를 읽고 ${path.relative(ROOT, brief.outputPath)} 작성 → generate.mjs --finalize`);
  } else if (flag === '--finalize') {
    const { spec, guard } = finalizeSpec(val);
    const p = outOverride || path.join(OUT, `final_${String(spec.id).padStart(2, '0')}.json`);
    fs.writeFileSync(p, JSON.stringify(spec, null, 2));
    console.log(`finalize → ${path.relative(ROOT, p)}  guard=${guard.blocked ? 'BLOCKED' : 'OK'} (${guard.findings.length} findings, ${spec.slides.length} slides)`);
    if (guard.blocked) { console.error('guard BLOCKED:', JSON.stringify(guard.findings.filter(f => f.sev === 'block'))); process.exit(1); }
  } else if (flag === '--offline') {
    const { spec, guard } = finalizeSpec(skeletonSpec(val));
    const p = outOverride || path.join(OUT, `final_${String(spec.id).padStart(2, '0')}.json`);
    fs.writeFileSync(p, JSON.stringify(spec, null, 2));
    console.log(`[skeleton] → ${path.relative(ROOT, p)}  guard=${guard.blocked ? 'BLOCKED' : 'OK'} (${spec.slides.length} slides) — 골드 품질 아님(테스트용)`);
    if (guard.blocked) process.exit(1);
  } else { console.error('usage: generate.mjs --brief <topic> | --finalize <spec> | --offline <topic> [--out f]'); process.exit(2); }
}
