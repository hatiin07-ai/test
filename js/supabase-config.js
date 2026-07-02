// ============================================
// 🔌 Supabase Configuration
// ============================================
// ⚠️ 아래 값을 본인의 Supabase 프로젝트 정보로 교체하세요!
const SUPABASE_URL = 'https://uootyovhokziobarpeed.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvb3R5b3Zob2t6aW9iYXJwZWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTU2MDIsImV4cCI6MjA5ODQzMTYwMn0.lQm3PLyoj5ELktvcuUuVbidh4xmv8W2Oo4uUddQrJk4';

// Supabase CDN
const { createClient } = supabase;

// 전역 Supabase 클라이언트
let supabaseClient = null;

function initSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

// Toast 알림
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
