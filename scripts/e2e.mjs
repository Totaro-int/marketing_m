#!/usr/bin/env node
// e2e.mjs — 닫힌 루프 전체를 직접 실행 검증:
//   generate → image-assign → caption → guard → render → push(dry) → insight 발행 →
//   피드백 → distill → learnings → 다음 generate 주입.
// 오프라인(키 없음)에서 동작하는 경로만. 라이브(LLM/Supabase/push)는 키 필요.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { skeletonSpec, finalizeSpec, buildBrief } from '../engine/generate.mjs';
import { renderSpecToDir } from '../engine/render.mjs';
import { ROOT } from './_lib.mjs';

const node = process.execPath;
const run = (script, args = []) => spawnSync(node, [path.join(ROOT, 'scripts', script), ...args], { encoding: 'utf-8' });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

console.log('=== E2E 닫힌 루프 (오프라인) ===');

// 1) generate (offline skeleton — 실제 카피는 melanoir-copywriter 에이전트) → assign+caption+guard
const { spec, guard } = finalizeSpec(skeletonSpec('7'));
fs.writeFileSync(path.join(ROOT, 'out', 'e2e_07.json'), JSON.stringify(spec, null, 2));
ok(!guard.blocked, `generate #7 → guard ${guard.blocked ? 'BLOCKED' : 'OK'} (${spec.slides.length} slides)`);
ok(spec.slides.every(s => s.type === 'closing' || s.image), '모든 슬라이드 이미지 배정됨');
ok(!!spec.caption && spec.caption.includes('melanoir.co.kr'), '캡션 생성(링크 포함)');

// 2) render
const { paths } = await renderSpecToDir(spec, path.join(ROOT, 'out', 'e2e'));
ok(paths.length === spec.slides.length && paths.every(p => fs.existsSync(p)), `render ${paths.length}장 PNG`);

// 3) push --dry-run
const p = run('push-supabase.mjs', ['out/e2e_07.json', '--cards', 'out/e2e/carousel_07', '--dry-run']);
ok(p.status === 0 && /DRY-RUN/.test(p.stdout), 'push --dry-run payload 생성');

// 4) insight 발행 (recruitment cards.json 스키마, 임시 타깃 → 스테이징 오염 방지)
const insTarget = path.join(ROOT, 'out', 'e2e-insights');
fs.rmSync(insTarget, { recursive: true, force: true });
const pub = run('publish-insight.mjs', ['out/e2e_07.json', '--date', '2026-06-23', '--target', insTarget]);
const cj = fs.existsSync(path.join(insTarget, 'cards.json')) ? JSON.parse(fs.readFileSync(path.join(insTarget, 'cards.json'), 'utf-8')) : [];
const ie = cj.find(c => c.date === '2026-06-23') || {};
ok(pub.status === 0 && ie.image === '2026-06-23.png' && ['date', 'category', 'handle', 'title', 'subtitle', 'image', 'link'].every(k => k in ie), 'insight 발행 → cards.json(recruitment 스키마) 추가');

// 5) 학습 루프: 샘플 피드백 → distill → learnings 규칙
const inbox = path.join(ROOT, 'learnings', '_inbox-feedback.json');
const RULE = '커버 후킹을 더 강하게(질문형)';
fs.writeFileSync(inbox, JSON.stringify([
  { id: 'fb1', verdict: 'down', channel: 'instagram', note: RULE },
  { id: 'fb2', verdict: 'down', channel: 'instagram', note: RULE },
  { id: 'fb3', verdict: 'up', channel: 'global', note: '데이터 한 줄 명확히' },
], null, 2));
const dis = run('distill.mjs', ['--no-push']);
const distilled = path.join(ROOT, 'learnings', '01-distilled.md');
ok(dis.status === 0 && fs.existsSync(distilled) && fs.readFileSync(distilled, 'utf-8').includes(RULE), 'distill → 01-distilled.md 규칙 생성');

// 6) 주입 확인: 다음 brief(copywriter 에이전트 입력)에 distill 규칙 포함
const learnDir = path.join(ROOT, 'learnings');
const brief = buildBrief('7');
ok((brief.learnings || '').includes(RULE), 'distill 규칙이 다음 brief(에이전트 입력)에 주입됨');

// 7) self-check
const sc = run('self-check.mjs');
ok(sc.status === 0, 'self-check green');

// cleanup — 테스트 산출물 제거(샘플 학습이 실제 생성 오염 안 하도록)
for (const f of [inbox, distilled, path.join(learnDir, '_proposals.json'), inbox + '.bak']) if (fs.existsSync(f)) fs.rmSync(f);
fs.rmSync(path.join(ROOT, 'out', 'e2e-insights'), { recursive: true, force: true }); // insight 임시 타깃 제거

console.log(`\n=== E2E: ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
