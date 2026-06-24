-- ============================================================================
-- marketing_drafts — Claude가 생성한 채널별 발행 카피 + 카드 이미지
-- 클라이언트 Supabase 프로젝트에서 1번만 실행 (SQL Editor에 통째로 붙여넣기 → Run).
-- CLI 불필요. 이후 로컬 Claude Code가 push-supabase.mjs 로 여기에 전송한다.
-- ============================================================================

-- 1) 본 테이블 ----------------------------------------------------------------
create table if not exists public.marketing_drafts (
  id            uuid primary key default gen_random_uuid(),
  campaign_slug text not null,
  channel       text not null,
  title         text,
  body          text not null default '',
  hashtags      jsonb not null default '[]'::jsonb,
  image_urls    jsonb not null default '[]'::jsonb,   -- Storage public URL 배열
  guardian_ok   boolean,
  guardian_notes text,
  status        text not null default 'preview',       -- preview | edited | approved
  feedback      text,                                  -- 클라가 웹에서 남기는 수정요청
  generated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (campaign_slug, channel)                      -- upsert 키
);

create index if not exists idx_drafts_campaign on public.marketing_drafts (campaign_slug);
create index if not exists idx_drafts_updated  on public.marketing_drafts (updated_at desc);

-- 2) updated_at 자동 갱신 트리거 ----------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_touch_drafts on public.marketing_drafts;
create trigger trg_touch_drafts
  before update on public.marketing_drafts
  for each row execute function public.touch_updated_at();

-- 3) Storage 버킷 (카드 이미지, public read) ----------------------------------
insert into storage.buckets (id, name, public)
  values ('card-images', 'card-images', true)
  on conflict (id) do nothing;

-- 4) RLS — 웹앱(anon)은 읽기 + 본문/피드백/상태만 수정. insert/delete 불가.
--    (push 는 service_role 키 → RLS 우회 → insert/upsert 담당)
alter table public.marketing_drafts enable row level security;

drop policy if exists "anon can read"   on public.marketing_drafts;
drop policy if exists "anon can update" on public.marketing_drafts;
create policy "anon can read"   on public.marketing_drafts for select using (true);
create policy "anon can update" on public.marketing_drafts for update using (true) with check (true);

-- 컬럼 단위 권한: anon 은 본문/태그/상태/피드백만 UPDATE (slug·guardian 등은 잠금)
grant select on public.marketing_drafts to anon;
grant update (title, body, hashtags, status, feedback) on public.marketing_drafts to anon;

-- 5) Storage 정책: public 버킷이라 읽기는 자동. 업로드는 service_role(push)만.
--    (별도 정책 불필요 — public=true 면 익명 GET 허용, 익명 write 는 차단)

-- ============================================================================
-- v2 — 닫힌 학습 루프 3테이블 추가 (feedback · sources · learnings) + Realtime
-- BUILD-SPEC §5. drafts(=marketing_drafts) 위에 additive. 같은 SQL 재실행 안전(idempotent).
-- ============================================================================

-- 6) feedback — 웹에서 남기는 단일 피드백(잘됨/아쉬움 + 노트 + 수정본) -----------
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  draft_id    uuid references public.marketing_drafts(id) on delete cascade,
  campaign_slug text,
  channel     text,
  verdict     text,                 -- 'up' | 'down' (잘됨/아쉬움)
  note        text,                 -- 단일 입력 (잘된점/안된점 안 나눔)
  edited_body text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_feedback_draft on public.feedback (draft_id);
create index if not exists idx_feedback_created on public.feedback (created_at desc);

-- 7) sources — 참고 이미지·지침 (웹 입력 → pull → 생성 주입) --------------------
create table if not exists public.sources (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,         -- 'image' | 'guideline'
  url        text,                  -- kind=image
  text       text,                  -- kind=guideline
  label      text,
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_touch_sources on public.sources;
create trigger trg_touch_sources before update on public.sources
  for each row execute function public.touch_updated_at();

-- 8) learnings — 누적 규칙 (pull/distill 기록 · 생성 주입 · 웹 검토) ------------
create table if not exists public.learnings (
  id                uuid primary key default gen_random_uuid(),
  scope             text not null default 'global',  -- 'global' | channel
  kind              text not null default 'do',      -- 'do' | 'dont'
  rule              text not null,
  weight            int  not null default 1,
  source_feedback_id uuid references public.feedback(id) on delete set null,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists idx_learnings_active on public.learnings (active, scope);

-- 9) RLS — anon: 읽기 + feedback insert + sources/learnings 검토용 update --------
alter table public.feedback  enable row level security;
alter table public.sources   enable row level security;
alter table public.learnings enable row level security;

drop policy if exists "anon read fb"  on public.feedback;
drop policy if exists "anon write fb" on public.feedback;
create policy "anon read fb"  on public.feedback for select using (true);
create policy "anon write fb" on public.feedback for insert with check (true);
grant select, insert on public.feedback to anon;

drop policy if exists "anon read src"   on public.sources;
drop policy if exists "anon update src" on public.sources;
create policy "anon read src"   on public.sources for select using (true);
create policy "anon update src" on public.sources for update using (true) with check (true);
grant select, update (label, active, text) on public.sources to anon;

drop policy if exists "anon read lrn"   on public.learnings;
drop policy if exists "anon update lrn" on public.learnings;
create policy "anon read lrn"   on public.learnings for select using (true);
create policy "anon update lrn" on public.learnings for update using (true) with check (true);
grant select, update (active, weight) on public.learnings to anon;

-- 10) Realtime — 로컬 watch 구독용 publication 등록 (이미 멤버면 무시) ----------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.marketing_drafts'; exception when duplicate_object then null; when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.feedback';         exception when duplicate_object then null; when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.sources';          exception when duplicate_object then null; when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.learnings';        exception when duplicate_object then null; when others then null; end;
end $$;

-- 끝. 확인: select count(*) from public.marketing_drafts;
--   4테이블: marketing_drafts · feedback · sources · learnings
