#!/usr/bin/env node
// 채널 최적화 카피 — LinkedIn·Threads·naver-blog (IG 캐러셀은 generate.mjs가 별도).
// BUILD-SPEC §0: 카피=구독 melanoir-channel-copywriter 에이전트. 이 파일은 brief/finalize 결정론 단계만.
//   --brief <topic>     → out/chbrief_NN.json (토픽 thesis + 채널 전략 + 락 + 톤 + IG캡션 참고, LLM 없음)
//   [melanoir-channel-copywriter 에이전트가 brief 읽고 out/channels_NN.json 작성]
//   --finalize <file>   → 채널별 guard (block/warn). --offline <topic> → 스켈레톤(테스트용).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveTopic, readLearnings } from './generate.mjs';
import { guardText } from './guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DNA = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/brand-dna.json'), 'utf-8'));
const CH = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/channels.json'), 'utf-8'));
const OUT = path.join(ROOT, 'out');
const TEXT_CHANNELS = CH.textChannels;

function igCaption(id) {
  const p = path.join(OUT, `final_${String(id).padStart(2, '0')}.json`);
  if (fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')).caption || ''; } catch { } }
  return '';
}

export function buildChannelBrief(topicArg) {
  const topic = resolveTopic(topicArg);
  const facts = (topic.factIds || []).map(id => DNA.facts.find(f => f.id === id)).filter(Boolean);
  return {
    _agent: 'melanoir-channel-copywriter',
    _instructions: 'brief를 읽고 textChannels 각 채널의 카피를 outputPath에 JSON으로 Write. 같은 thesis에서 파생하되 채널 포맷·톤. 브랜드락 전부 준수. JSON 외 텍스트 금지.',
    topic: { id: topic.id, title: topic.title, thesis: topic.thesis, layer: topic.layer },
    facts,
    brand: { name: DNA.brand.name, handle: DNA.brand.handle, productUrl: DNA.brand.productUrl, slogan: DNA.brand.slogan },
    locks: DNA.locks,
    tone: { byLayer: DNA.tone.byLayer, lexicon: DNA.tone.lexicon },
    learnings: readLearnings().slice(0, 3000),
    igCaptionRef: igCaption(topic.id),
    textChannels: TEXT_CHANNELS,
    channelStrategy: Object.fromEntries(TEXT_CHANNELS.map(c => [c, CH.channels[c]])),
    allChannelRules: CH.allChannelRules,
    outputSchema: { id: topic.id, channels: { linkedin: { body: 'string', hashtags: ['#..'] }, threads: { body: 'string', hashtags: ['#..'] }, 'naver-blog': { title: 'string', body: 'string', hashtags: ['#..'] } } },
    outputPath: path.join(OUT, `channels_${String(topic.id).padStart(2, '0')}.json`),
  };
}

export function finalizeChannels(input, topicArg) {
  const data = typeof input === 'string' ? JSON.parse(fs.readFileSync(input, 'utf-8')) : input;
  const topic = resolveTopic(topicArg ?? data.id);
  const out = { id: data.id ?? topic.id, channels: {}, blocked: false };
  for (const c of TEXT_CHANNELS) {
    const ch = data.channels?.[c];
    if (!ch) { out.channels[c] = { missing: true }; out.blocked = true; continue; }
    const text = [ch.title, ch.body].filter(Boolean).join('\n');
    const g = guardText(text, { layer: topic.layer, scope: 'caption' });
    const len = (ch.body || '').length;
    const range = CH.channels[c].lengthChars;
    out.channels[c] = { ...ch, chars: len, lenOk: len >= range[0] * 0.7 && len <= range[1] * 1.2, guard: g, blocked: g.blocked };
    if (g.blocked) out.blocked = true;
  }
  return out;
}

// 오프라인 스켈레톤 (에이전트 없이 테스트용 — 골드 품질 아님)
export function skeletonChannels(topicArg) {
  const topic = resolveTopic(topicArg);
  const url = DNA.brand.productUrl, slogan = DNA.brand.slogan;
  return {
    id: topic.id,
    _generated: 'skeleton-offline',
    channels: {
      linkedin: { body: `${topic.title}.\n\n${topic.thesis}\n\n피부에 오래 남는 색이라면, 느낌이 아니라 무엇으로 만들어졌고 그 안전을 어떻게 확인했는지를 물어야 합니다. 멜라누아는 그 질문에 답하기 위해 설계와 검증을 함께 갑니다.\n\n여러분의 기준은 무엇인가요?`, hashtags: ['#반영구색소', '#PMU', '#멜라누아'] },
      threads: { body: `${topic.title}\n\n${topic.thesis}\n\n더 알아보기 → ${url}`, hashtags: ['#멜라누아', '#반영구색소'] },
      'naver-blog': { title: topic.title, body: `${topic.thesis}\n\n## 무엇을 보아야 하나\n피부에 오래 남는 색이라면 기준이 달라야 합니다.\n\n## 어떻게 확인하나\n멜라누아는 설계와 검증을 함께 갑니다.\n\n## 의미\n알고 고르도록 정보를 엽니다.\n\n시험 기준과 데이터는 멜라누아 홈페이지에서 확인하실 수 있습니다. ${url}`, hashtags: ['#멜라누아', '#반영구색소', '#반영구화장', '#PMU', '#멜라닌색소'] },
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = args.find(a => a.startsWith('--')) || '--brief';
  const val = args.find(a => !a.startsWith('--')) ?? '1';
  fs.mkdirSync(OUT, { recursive: true });
  if (flag === '--brief') {
    const b = buildChannelBrief(val);
    const p = path.join(OUT, `chbrief_${String(b.topic.id).padStart(2, '0')}.json`);
    fs.writeFileSync(p, JSON.stringify(b, null, 2));
    console.log(`channel brief → ${path.relative(ROOT, p)}  (채널: ${b.textChannels.join(', ')})`);
    console.log(`다음: melanoir-channel-copywriter 에이전트가 ${path.relative(ROOT, b.outputPath)} 작성 → channels.mjs --finalize`);
  } else if (flag === '--finalize' || flag === '--offline') {
    const data = flag === '--offline' ? skeletonChannels(val) : val;
    const r = finalizeChannels(data, flag === '--offline' ? val : undefined);
    if (flag === '--offline') fs.writeFileSync(path.join(OUT, `channels_${String(r.id).padStart(2, '0')}.json`), JSON.stringify(data, null, 2));
    console.log(`channels finalize: ${r.blocked ? 'BLOCKED' : 'OK'}`);
    for (const c of TEXT_CHANNELS) { const x = r.channels[c]; console.log(`  ${c.padEnd(11)} ${x.missing ? 'MISSING' : `${x.chars}자 lenOk=${x.lenOk} guard=${x.blocked ? 'BLOCK' : 'ok'}${x.guard.findings.length ? ' (' + x.guard.findings.map(f => f.id).join(',') + ')' : ''}`}`); }
    process.exit(r.blocked ? 1 : 0);
  } else { console.error('usage: channels.mjs --brief <topic> | --finalize <file> | --offline <topic>'); process.exit(2); }
}
