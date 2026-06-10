// Supabase 프로젝트 URL을 입력한다
export const SUPABASE_URL = 'https://hzmbanesmvwhlgnmjvmg.supabase.co';

// Supabase Publishable(anon) key를 입력한다
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6bWJhbmVzbXZ3aGxnbm1qdm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4ODcxNjksImV4cCI6MjA5NjQ2MzE2OX0.l9sptDr_zjEjTqH_9p-E-PCfxbK5jcl35Im7pITXWxU';

// 연결 가능 여부를 확인한다
export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
