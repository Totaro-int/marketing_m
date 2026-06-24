#!/usr/bin/env node
// 캡션 생성 — 골드 캡션 포맷(더보기란): 후킹 → 설명 → (데이터)홈페이지 안내 → 더 알아보기 → URL → 해시태그.
// 슬라이드엔 링크 금지, 캡션에만. 사용: node engine/caption.mjs <specPath>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DNA = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/brand-dna.json'), 'utf-8'));

// 토픽별 해시태그 보강 (데이터형은 시험 태그 추가)
const EXTRA_TAGS = {
  data: ['#ISO10993', '#세포독성', '#자가품질검사', '#유해물질'],
  recruit: ['#베타테스터', '#반영구베타테스터'],
};

export function buildCaption(spec, dna = DNA) {
  const topic = dna.topics.find(t => t.id === spec.id) || {};
  const layer = spec.layer || topic.layer || 'data';
  const ct = dna.captionTemplate;
  const parts = [];

  // 1) 후킹 — cover 메시지/스펙 hook 우선, 없으면 토픽 타이틀
  const hook = spec.hook || coverHook(spec) || (topic.title ? `${topic.title}.` : '');
  if (hook) parts.push(hook);

  // 2) 설명 — spec.summary 우선, 없으면 thesis 풀어쓰기
  const body = spec.summary || topic.thesis || '';
  if (body) parts.push(body);

  // 3) 데이터 레이어 → 홈페이지 안내 (성적서 공개 표현 금지 정신)
  if (layer === 'data') parts.push('시험 기준과 데이터는 멜라누아 홈페이지에서 확인하실 수 있습니다.');

  // 4) 링크 (화살표는 캡션에서만 허용)
  parts.push(`더 알아보기 →\n${dna.brand.productUrl}`);

  // 5) 해시태그
  const tags = [...ct.baseHashtags];
  for (const t of (EXTRA_TAGS[layer] || [])) if (!tags.includes(t)) tags.push(t);
  parts.push(tags.join(' '));

  return parts.filter(Boolean).join('\n\n');
}

function coverHook(spec) {
  const c = spec.slides?.find(s => s.type === 'cover_stmt' || s.type === 'cover_data');
  if (!c) return '';
  if (c.hook) return c.hook;
  if (c.lines) return c.lines.join(' ');
  if (c.number && c.label) return `${c.label} ${c.number}.`;
  return '';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
  console.log(buildCaption(spec));
}
