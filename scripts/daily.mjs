#!/usr/bin/env node
// daily.mjs — 하루 사이클 오케스트레이터 (BUILD-SPEC §7 step6 morning-routine).
//   pull(피드백)→distill→learnings  →  generate(토픽,학습주입)→image-assign→caption→guard
//   →  render(PNG)  →  [--push] push-supabase(Supabase) + publish-insight(웹사이트 스테이징)
// 품질 가드: 카피가 스켈레톤(LLM 키 없음)이면 --push 거부(--force 로만). 골드 품질만 발행.
// 사용: node scripts/daily.mjs <topicId|"토픽"> [--push] [--no-pull] [--date YYYY-MM-DD] [--force]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { skeletonSpec, finalizeSpec } from '../engine/generate.mjs';
import { skeletonChannels, finalizeChannels } from '../engine/channels.mjs';
import { sbEnv, hasCreds, ui, ROOT } from './_lib.mjs';
import { pickNextTopic } from './topic-queue.mjs';

const argv = process.argv.slice(2);
const positional = argv.find(a => !a.startsWith('--'));
const topicArg = positional ?? String(await pickNextTopic());
const PUSH = argv.includes('--push');
const NO_PULL = argv.includes('--no-pull');
const FORCE = argv.includes('--force');
const date = argv.indexOf('--date') >= 0 ? argv[argv.indexOf('--date') + 1] : new Date().toISOString().slice(0, 10);
const env = sbEnv();
const node = process.execPath;
const run = (s, a) => spawnSync(node, [path.join(ROOT, 'scripts', s), ...a], { stdio: 'inherit' });
// 서버 렌더는 canvas(네이티브 빌드) 필요 — 선택. 없으면 생략(IG 카드는 브라우저 편집기 web/cards.html 가 렌더).
let renderSpecToDir = null;
try { if (!process.env.MELANOIR_NO_CANVAS) ({ renderSpecToDir } = await import('../engine/render.mjs')); }
catch { ui.dim('(canvas 미설치 → 서버 렌더 생략. 브라우저 카드 편집기에서 렌더)'); }

ui.info(`=== daily ${date} · 토픽 "${topicArg}"${positional ? '' : ' (큐 자동선택)'} ${PUSH ? '(push)' : '(preview)'} ===`);

// 1) pull → distill (피드백 학습 반영) — creds 있을 때만
if (!NO_PULL && hasCreds(env)) {
  ui.info('1) pull → distill (학습 갱신)');
  run('pull-supabase.mjs', []);
  if (fs.existsSync(path.join(ROOT, 'learnings', '_inbox-feedback.json'))) run('distill.mjs', []);
} else ui.dim(`1) pull 건너뜀 (${NO_PULL ? '--no-pull' : 'creds 없음'})`);

// 2) generate (오프라인 스켈레톤) → assign → caption → guard
//    ⚠️ 실제 골드 생성은 /melanoir-daily 명령이 melanoir-copywriter 에이전트를 디스패치(구독 LLM).
//    이 스크립트 단독 실행은 결정론 파이프라인 스모크(스켈레톤)다.
ui.info('2) generate (오프라인 스켈레톤 — 실제 카피는 /melanoir-daily 의 copywriter 에이전트)');
const { spec, guard } = finalizeSpec(skeletonSpec(topicArg));
const mode = 'skeleton';
const id2 = String(spec.id).padStart(2, '0');
const specFile = path.join(ROOT, 'out', `daily_${id2}.json`);
fs.writeFileSync(specFile, JSON.stringify(spec, null, 2));
ui.dim(`   mode=${mode} · ${spec.slides.length} slides · guard ${guard.blocked ? 'BLOCKED' : 'OK'}`);
if (guard.blocked) { ui.err('guard 차단 — 발행 중단:'); guard.findings.filter(f => f.sev === 'block').forEach(f => ui.dim('   ' + JSON.stringify(f))); process.exit(1); }

// 3) render
let out = null;
if (renderSpecToDir) {
  ui.info('3) render → PNG');
  ({ out } = await renderSpecToDir(spec, path.join(ROOT, 'out', 'daily')));
  ui.dim(`   → ${path.relative(ROOT, out)}`);
} else ui.dim('3) render 생략 — 브라우저 카드 편집기(web/cards.html)에서 렌더(canvas 불요)');

// 3b) 채널 카피 (오프라인 스켈레톤 — 실제는 melanoir-channel-copywriter 에이전트)
ui.info('3b) channels (LinkedIn·Threads·naver-blog 스켈레톤)');
const chData = skeletonChannels(topicArg);
const chFile = path.join(ROOT, 'out', `channels_${id2}.json`);
fs.writeFileSync(chFile, JSON.stringify(chData, null, 2));
const chRes = finalizeChannels(chData, topicArg);
ui.dim(`   채널 ${Object.keys(chRes.channels).length} (${Object.keys(chRes.channels).join(',')}) · guard ${chRes.blocked ? 'BLOCKED' : 'OK'}`);
if (chRes.blocked) { ui.err('채널 guard 차단 — 발행 중단'); process.exit(1); }

// 4) publish
if (!PUSH) {
  ui.ok(`preview 완료 (push 안 함). 발행하려면 --push.`);
  ui.dim(`   spec: ${path.relative(ROOT, specFile)} · cards: ${path.relative(ROOT, out)}`);
} else if (mode === 'skeleton' && !FORCE) {
  ui.warn('카피가 스켈레톤(LLM 키 없음 → 자리표시자)입니다 — 골드 품질 아님. 라이브 발행 거부.');
  ui.dim('   세션에서 직접 골드 카피를 작성하거나, ANTHROPIC_API_KEY 설정 후 재실행. 그래도 발행하려면 --force.');
  process.exit(2);
} else {
  ui.info('4) push (IG + 채널 + 인사이트)');
  const slug = `daily-${date}-${id2}`;
  const pushArgs = [specFile, '--slug', slug]; if (out) pushArgs.push('--cards', out);
  run('push-supabase.mjs', pushArgs);
  run('push-channels.mjs', [chFile, '--slug', slug]);
  if (renderSpecToDir) {
    run('upload-bg.mjs', [specFile]);
    // MELANOIR_SITE_REPO = 자사몰 레포의 insights 디렉터리 경로면 → 정적 아티클 생성 + git push(자동 배포)
    const insDir = process.env.MELANOIR_SITE_REPO;
    const insArgs = [specFile, '--date', date, '--slug', slug];
    if (insDir) { insArgs.push('--target', insDir, '--push'); ui.dim(`   인사이트 → 자사몰 레포(${insDir}) 자동 발행`); }
    run('publish-insight.mjs', insArgs);
  }
  else ui.dim('   인사이트 카드·기본 배경은 canvas 필요 → 생략(브라우저/Totaro 경로).');
  ui.ok('daily 발행 완료 (5채널' + (renderSpecToDir ? ' + 인사이트 + 배경' : ', 카드는 브라우저 편집기') + ').');
}
