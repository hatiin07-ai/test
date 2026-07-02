# 업보

스트리머 "업보"의 시청자별 숙제 관리 웹앱

## 기술 스택
- HTML + Tailwind CSS (CDN)
- Vanilla JavaScript
- Supabase (PostgreSQL + Auth + RLS)

## 파일 구조
```
├── upbo.html            ← 공개 페이지 (숙제 목록)
├── admin/index.html     ← 관리자 페이지 (/admin)
├── css/style.css        ← 커스텀 스타일
├── js/
│   ├── supabase-config.js  ← Supabase 연결 설정
│   ├── upbo.js             ← 공개 페이지 로직
│   └── upbo-admin.js       ← 관리자 페이지 로직
└── supabase-upbo-setup.sql ← DB 스키마
```

> 이벤트성 항목(그림 사이드 배너 등)은 어드민에서 추가/비활성화 가능
