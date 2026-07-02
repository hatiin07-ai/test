-- ============================================
-- 📅 냔냐 스케줄 테이블 설정
-- ============================================

create table if not exists schedule_events (
  id            bigserial primary key,
  date          date not null,
  time          time,
  title         text not null,
  description   text,
  tags          text[] default '{}',
  is_special    boolean default false,
  is_hidden     boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 인덱스
create index if not exists idx_schedule_date on schedule_events(date);
create index if not exists idx_schedule_hidden on schedule_events(is_hidden);

-- RLS
alter table schedule_events enable row level security;

-- 공개 읽기 (숨김 아닌 것)
create policy "Public read visible events"
  on schedule_events for select
  using (is_hidden = false);

-- 인증된 사용자 전체 읽기
create policy "Authenticated read all"
  on schedule_events for select
  to authenticated
  using (true);

-- 인증된 사용자 쓰기
create policy "Authenticated insert"
  on schedule_events for insert
  to authenticated
  with check (true);

create policy "Authenticated update"
  on schedule_events for update
  to authenticated
  using (true);

create policy "Authenticated delete"
  on schedule_events for delete
  to authenticated
  using (true);

-- updated_at 자동 갱신
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger schedule_events_updated_at
  before update on schedule_events
  for each row execute function update_updated_at();
