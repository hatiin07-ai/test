-- ============================================
-- 5. 문의 테이블
-- ============================================
CREATE TABLE upbo_inquiries (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  is_checked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE upbo_inquiries ENABLE ROW LEVEL SECURITY;

-- 누구나 문의 작성 가능
CREATE POLICY "Public insert inquiries" ON upbo_inquiries FOR INSERT WITH CHECK (true);
-- 읽기/수정/삭제는 인증된 사용자만 (어드민)
CREATE POLICY "Auth read inquiries" ON upbo_inquiries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth update inquiries" ON upbo_inquiries FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete inquiries" ON upbo_inquiries FOR DELETE USING (auth.role() = 'authenticated');

-- 💡 기존 테이블 설정 후 이 SQL을 추가로 실행하세요
