-- ============================================
-- 💖 업보 숙제장 - Supabase 테이블 설정
-- ============================================

-- 1. 설정 테이블 (갱신일 수동 관리)
CREATE TABLE upbo_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO upbo_settings (key, value) VALUES ('last_updated', '2026.04.20');

-- 2. 숙제 종류 마스터 (확장성 핵심!)
CREATE TABLE upbo_task_types (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'regular' CHECK (category IN ('regular', 'event')),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기본 숙제 항목 14개 삽입
INSERT INTO upbo_task_types (name, category, sort_order) VALUES
  ('랜덤 방셀', 'regular', 1),
  ('사탕 1개', 'regular', 2),
  ('방송국 뻘글', 'regular', 3),
  ('움짤 방셀', 'regular', 4),
  ('움짤 프사', 'regular', 5),
  ('사이드 배너', 'regular', 6),
  ('방송국 편지', 'regular', 7),
  ('스토리 방셀 (3장 내외)', 'regular', 8),
  ('하단 배너', 'regular', 9),
  ('사탕 10개', 'regular', 10),
  ('인생네컷', 'regular', 11),
  ('상단 배너', 'regular', 12),
  ('배너 3종 세트', 'regular', 13),
  ('손편지 (사진)', 'regular', 14);

-- 3. 시청자
CREATE TABLE upbo_members (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nickname TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 시청자별 숙제
CREATE TABLE upbo_tasks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  member_id BIGINT NOT NULL REFERENCES upbo_members(id) ON DELETE CASCADE,
  task_type_id BIGINT NOT NULL REFERENCES upbo_task_types(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  memo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, task_type_id)
);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE upbo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE upbo_task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE upbo_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE upbo_tasks ENABLE ROW LEVEL SECURITY;

-- 공개 읽기
CREATE POLICY "Public read settings" ON upbo_settings FOR SELECT USING (true);
CREATE POLICY "Public read task_types" ON upbo_task_types FOR SELECT USING (true);
CREATE POLICY "Public read members" ON upbo_members FOR SELECT USING (true);
CREATE POLICY "Public read tasks" ON upbo_tasks FOR SELECT USING (true);

-- 인증된 사용자만 쓰기
CREATE POLICY "Auth manage settings" ON upbo_settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth insert task_types" ON upbo_task_types FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update task_types" ON upbo_task_types FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete task_types" ON upbo_task_types FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert members" ON upbo_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update members" ON upbo_members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete members" ON upbo_members FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert tasks" ON upbo_tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update tasks" ON upbo_tasks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete tasks" ON upbo_tasks FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX idx_upbo_tasks_member ON upbo_tasks(member_id);
CREATE INDEX idx_upbo_tasks_type ON upbo_tasks(task_type_id);
CREATE INDEX idx_upbo_task_types_active ON upbo_task_types(is_active);

-- ============================================
-- updated_at 자동 갱신 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_upbo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER upbo_tasks_updated_at
  BEFORE UPDATE ON upbo_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_upbo_updated_at();

-- ============================================
-- 💡 Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================

-- ============================================
-- 6. 시청자 숨기기 기능 (컴럼 추가)
-- ============================================
ALTER TABLE upbo_members ADD COLUMN is_hidden BOOLEAN DEFAULT false;

-- ============================================
-- 7. 문의 테이블
-- ============================================
CREATE TABLE upbo_inquiries (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  is_checked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE upbo_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert inquiries" ON upbo_inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth read inquiries" ON upbo_inquiries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth update inquiries" ON upbo_inquiries FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete inquiries" ON upbo_inquiries FOR DELETE USING (auth.role() = 'authenticated');
