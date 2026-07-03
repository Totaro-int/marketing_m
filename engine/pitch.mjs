#!/usr/bin/env node
// pitch.mjs — 스토리 앵글 발굴(기획) 레이어. 기자가 "무엇을 쓸지"를 스스로 제안 → 큐 편입.
//   기존 토픽 10개(brand-dna)는 고정이라 발굴 여지가 없었다 → 이 파일이 상류 기획 단계를 연다.
//   --brief          → out/pbrief.json (브랜드 DNA + 기존 토픽/발행물 + 피칭 규칙, LLM 없음)
//   [melanoir-journalist 에이전트가 pbrief 읽고 out/pitches.json 작성 — 5개 앵글]
//   --score <file>   → 각 앵글 결정론 채점(중복·브랜드락·근거실현성) + 요약 (LLM 없음)
// 사용: node engine/pitch.mjs --brief [--n 5]   ·   node engine/pitch.mjs --score out/pitches.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DNA } from './guard.mjs';
import { readLearnings } from './generate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');

export function buildPitchBrief({ n = 5 } = {}) {
  const writerLocks = fs.readFileSync(path.join(ROOT, 'agents', '_writer-locks.md'), 'utf-8');
  return {
    _agent: 'melanoir-journalist',
    _instructions: `멜라누아가 다음 한 달간 다룰 새 스토리 앵글 ${n}개를 피칭하라. 필요하면 WebSearch로 업계·과학·규제 동향을 탐색(취재까지는 불요 — 계획만). 각 앵글은 pitchSchema 형식. out/pitches.json 에 {"pitches":[...]} 로 Write. JSON 외 텍스트 금지.`,
    brand: { name: DNA.brand.name, slogan: DNA.brand.slogan, sloganFrame: DNA.brand.sloganFrame, maker: DNA.brand.maker, product: DNA.brand.product },
    existingTopics: DNA.topics.map(t => ({ id: t.id, title: t.title, layer: t.layer })),
    facts: DNA.facts,
    locks: DNA.locks,
    writerLocks,
    learnings: readLearnings().slice(0, 3000),
    pitchSchema: {
      title: '앵글 제목(기사 가제)', style: 'essay|feature|column',
      thesis: '한 문장', whyNow: '왜 지금 이 이야기인가 — 시의성·독자 관심 근거(가능하면 연도·사건)',
      researchPlan: '어떤 근거를 어디서 — 구체적 출처 유형(기관·저널·규정명). 실제 도달 가능해야 함.',
      brandFit: '브랜드락 안에서 성립 가능한 이유(효능·안전 단정 없이 쓸 수 있는가)',
    },
    rules: [
      `기존 토픽 ${DNA.topics.length}개의 재포장 금지(0.00·97% 재탕 등).`,
      '브랜드락 충돌 앵글 금지(효능 주장·경쟁 비방·EWG 제품 귀속).',
      '근거를 구할 수 없는 앵글 금지(출처가 "인터넷 자료" 류면 탈락).',
      'style은 essay(브랜드가 말한다)·feature(브랜드에 대해 쓴다)·column(관점) 중.',
    ],
    outputPath: path.join(OUT, 'pitches.json'),
  };
}

// ---- 결정론 채점 (LLM 없음): 중복·브랜드락 위험어·근거 구체성 ----
const VAGUE = ['인터넷', '검색', '자료를 찾', '대략', '어딘가', '아마', '구글'];
const RISK = ['효능', '치료', '개선됩니다', '안전합니다', '무독성', '100% 안전', '경쟁사', '타사보다'];
const SPECIFIC = /ISO\s?\d|REACH|ECHA|EUR-?Lex|식약처|FDA|고시|규정|Regulation|저널|논문|PMC|DOI|Annex|법령|resolution/i;

export function scorePitch(p, existing) {
  // brandFit 은 "락 안에서 성립하는 이유"를 설명하는 메타 필드라 '효능 주장 없이' 같은 부정 문맥이 필연 → 위험어 스캔 제외.
  const riskText = [p.title, p.thesis, p.whyNow].join(' ');
  const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const dupe = existing.some(t => { const a = norm(t.title); const b = norm(p.title + p.thesis); return a && (b.includes(a) || a.includes(norm(p.title))); });
  // 부정 문맥(효능 '주장 없이'/'않') 제외 — 앵글이 락 위반을 언급만 하는 경우.
  const risk = RISK.filter(w => { const i = riskText.indexOf(w); return i >= 0 && !/주장\s*(없|않|하지)|없이|아니/.test(riskText.slice(i, i + 14)); });
  const vague = VAGUE.filter(w => (p.researchPlan || '').includes(w));
  const specific = SPECIFIC.test(p.researchPlan || '');
  const hasWhyNow = /\d{4}|올해|최근|개정|시행|리콜/.test(p.whyNow || '');
  const flags = [];
  if (dupe) flags.push('기존토픽 중복 의심');
  if (risk.length) flags.push('브랜드락 위험어: ' + risk.join(','));
  if (vague.length) flags.push('출처 막연: ' + vague.join(','));
  if (!specific) flags.push('출처 구체성 부족(기관·규정·저널 미명시)');
  if (!hasWhyNow) flags.push('시의성 근거 약함');
  const valid = ['essay', 'feature', 'column'].includes(p.style);
  if (!valid) flags.push('style 부적격');
  const score = 5 - (dupe ? 2 : 0) - (risk.length ? 2 : 0) - (vague.length ? 1 : 0) - (specific ? 0 : 1) - (hasWhyNow ? 0 : 1);
  return { title: p.title, style: p.style, score: Math.max(0, score), pass: flags.length === 0, flags };
}

export function scorePitches(file) {
  const data = typeof file === 'string' ? JSON.parse(fs.readFileSync(file, 'utf-8')) : file;
  const existing = DNA.topics.map(t => ({ title: t.title }));
  const rows = (data.pitches || []).map(p => scorePitch(p, existing));
  return { rows, passCount: rows.filter(r => r.pass).length, total: rows.length };
}

// ---- CLI ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = args.find(a => a.startsWith('--')) || '--brief';
  fs.mkdirSync(OUT, { recursive: true });
  if (flag === '--brief') {
    const ni = args.indexOf('--n');
    const b = buildPitchBrief({ n: ni >= 0 ? Number(args[ni + 1]) : 5 });
    fs.writeFileSync(b.outputPath, ''); // placeholder 방지 안 함 — 에이전트가 덮어씀
    const p = path.join(OUT, 'pbrief.json');
    fs.writeFileSync(p, JSON.stringify(b, null, 2));
    console.log(`pbrief → ${path.relative(ROOT, p)}`);
    console.log(`다음: melanoir-journalist 에이전트가 ${path.relative(ROOT, b.outputPath)} 에 앵글 피칭 → pitch.mjs --score`);
  } else if (flag === '--score') {
    const file = args.find(a => !a.startsWith('--')) || path.join(OUT, 'pitches.json');
    const { rows, passCount, total } = scorePitches(file);
    console.log(`피칭 채점 — ${passCount}/${total} 통과`);
    for (const r of rows) console.log(`  [${r.pass ? 'OK' : '⚠'} ${r.score}/5] (${r.style}) ${r.title}${r.flags.length ? '\n       · ' + r.flags.join(' · ') : ''}`);
  } else { console.error('usage: pitch.mjs --brief [--n 5] | --score <pitches.json>'); process.exit(2); }
}
