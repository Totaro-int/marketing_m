-- ============================================================================
-- content_requests — 콘솔 요청 큐 (① 새 캠페인 생성  ② 완성 채널→다른 채널 파생)
-- 정적 콘솔(anon)은 gold 생성을 직접 못 하므로 요청을 이 큐에 INSERT 하고,
-- Claude 처리 커맨드 /melanoir-queue (스케줄 routine 권장)가 감지해 copywriter 에이전트로
-- gold 생성/파생 → push. 사용자 액션은 '버튼 클릭' 하나로 최소화.
-- Supabase SQL Editor에 통째로 붙여넣기 → Run. 재실행 안전(idempotent).
-- ============================================================================

create table if not exists public.content_requests (
  id           uuid primary key default gen_random_uuid(),
  type         text not null default 'generate',       -- generate(새 캠페인) | derive(파생)
  topic        text,                                    -- generate: 토픽(비우면 큐 자동선택)
  source_slug  text,                                    -- derive: 원본 캠페인(gold IG) campaign_slug
  channels     jsonb not null default '[]'::jsonb,      -- derive: 대상 채널 배열 ["linkedin","threads",...]
  note         text,                                    -- 강조점·톤 요청(프롬프트 참고)
  source       text not null default 'console',
  status       text not null default 'queued',          -- queued | running | done | error
  error        text,
  result_slug  text,                                    -- 생성/파생 완료 후 처리 커맨드가 기록
  requested_at timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
create index if not exists idx_reqs_status on public.content_requests (status, requested_at);

-- RLS — anon: 읽기 + insert(요청)만. status/result 갱신은 service_role(처리 커맨드)만.
alter table public.content_requests enable row level security;
drop policy if exists "anon read reqs"  on public.content_requests;
drop policy if exists "anon write reqs" on public.content_requests;
create policy "anon read reqs"  on public.content_requests for select using (true);
create policy "anon write reqs" on public.content_requests for insert with check (true);
grant select on public.content_requests to anon;
-- anon 은 요청 필드만(위조 방지: status/result 등은 service_role 전용)
grant insert (type, topic, source_slug, channels, note, source) on public.content_requests to anon;

-- Realtime(선택) — 처리 커맨드/워처가 폴링 대신 구독하고 싶을 때
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.content_requests';
  exception when duplicate_object then null; when others then null; end;
end $$;

-- 끝. 확인: select id,type,status,topic,source_slug,channels,requested_at
--            from public.content_requests order by requested_at desc;
