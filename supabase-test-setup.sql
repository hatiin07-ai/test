-- ============================================================
-- 테스트 Supabase 셋업 (nyanya66 실 DB 구조 충실 재현)
-- 프로젝트: uootyovhokziobarpeed
-- 근거: 원본 setup SQL + upbo-admin.js/upbo.js 로직 + Table Editor 스크린샷 컬럼
-- 주의: 100% 동일성은 실 DB pg_dump가 정답. 이건 관측된 구조 기반 재구성.
-- ============================================================

-- 확장 (UUID 생성용)
create extension if not exists pgcrypto;

-- ============================================================
-- 1. upbo_seasons  (시즌)
-- ============================================================
create table if not exists upbo_seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- 2. upbo_task_types  (숙제 종류 = 칩)
-- ============================================================
create table if not exists upbo_task_types (
  id         bigint primary key generated always as identity,
  name       text not null unique,
  category   text not null default 'regular' check (category in ('regular','event')),
  sort_order int default 0,
  is_active  boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. upbo_members  (시청자)
-- ============================================================
create table if not exists upbo_members (
  id         bigint primary key generated always as identity,
  nickname   text not null,
  user_id    text not null,
  is_hidden  boolean default false,
  memo       text default '',
  created_at timestamptz default now()
);
-- 참고: user_id UNIQUE 없음 (실 DB와 동일 — 의도적 중복 허용, 고유성 정리는 차후)

-- ============================================================
-- 4. upbo_tasks  (부여된 숙제) — season별 별도 행, quantity 스택
-- ============================================================
create table if not exists upbo_tasks (
  id           bigint primary key generated always as identity,
  member_id    bigint not null references upbo_members(id) on delete cascade,
  task_type_id bigint not null references upbo_task_types(id) on delete cascade,
  quantity     int not null default 1 check (quantity >= 0),
  memo         text default '',
  is_prepared  boolean default false,
  season_id    uuid references upbo_seasons(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (member_id, task_type_id)   -- 실 DB와 동일 (시즌 미포함). 운영상 위반 안 생김
);

-- ============================================================
-- 5. upbo_settings  (kv) — 갱신일 + [신규] weflab 연동 config/커서
-- ============================================================
create table if not exists upbo_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

-- 갱신일 (기존)
insert into upbo_settings(key, value) values ('last_updated', '2026-01-01')
  on conflict (key) do nothing;

-- [신규] weflab 임포트 커서 (마지막으로 처리한 alertlist idx)
insert into upbo_settings(key, value) values ('weflab_last_idx', '0')
  on conflict (key) do nothing;

-- [신규] weflab 연동 config (JSON 문자열)
--   map     : { "룰렛항목명": task_type_id, ... }
--   skip    : ["냥","윙크",...]          (필러 — 기록 안 함)
--   double  : "묻고 더블"                 (2배 트리거명)
--   event   : []                          (참고용; 실제 event 여부는 task_type.category)
--   double_window_min : 60                (2배 이관 유효 시간, 분)
--   start_idx : 0                         (임포트 시작 경계)
insert into upbo_settings(key, value) values (
  'weflab_config',
  '{"map":{},"skip":["냥","윙크","뽀뽀","볼빵빵","메롱","꽝"],"double":"묻고 더블","event":[],"double_window_min":60,"start_idx":0}'
) on conflict (key) do nothing;

-- ============================================================
-- 6. upbo_inquiries  (문의)
-- ============================================================
create table if not exists upbo_inquiries (
  id         bigint primary key generated always as identity,
  nickname   text not null,
  content    text not null,
  is_checked boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS — 공개 읽기 / 쓰기는 authenticated (실 DB 정책과 동일)
--   → Worker는 service_role로 RLS 우회하여 기입
-- ============================================================
alter table upbo_seasons     enable row level security;
alter table upbo_task_types  enable row level security;
alter table upbo_members     enable row level security;
alter table upbo_tasks       enable row level security;
alter table upbo_settings    enable row level security;
alter table upbo_inquiries   enable row level security;

-- 공개 읽기
create policy "pub read seasons"    on upbo_seasons    for select using (true);
create policy "pub read task_types" on upbo_task_types for select using (true);
create policy "pub read members"    on upbo_members    for select using (true);
create policy "pub read tasks"      on upbo_tasks      for select using (true);
create policy "pub read settings"   on upbo_settings   for select using (true);

-- authenticated 쓰기 (admin 로그인 세션)
create policy "auth write seasons"    on upbo_seasons    for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
create policy "auth write task_types" on upbo_task_types for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
create policy "auth write members"    on upbo_members    for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
create policy "auth write tasks"      on upbo_tasks      for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
create policy "auth write settings"   on upbo_settings   for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

-- 문의: 누구나 작성, 읽기는 authenticated만
create policy "pub insert inquiries"  on upbo_inquiries for insert with check (true);
create policy "auth read inquiries"   on upbo_inquiries for select using (auth.role()='authenticated');
create policy "auth update inquiries" on upbo_inquiries for update using (auth.role()='authenticated');

-- ============================================================
-- 완료. 다음: 실 DB의 task_types + members 데이터를 복사 (별도 스크립트)
-- 임포트 RPC(import_roulette)는 매핑 확정 후 추가.
-- ============================================================
