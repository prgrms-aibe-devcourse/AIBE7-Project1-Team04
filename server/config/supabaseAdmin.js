const { createClient } = require("@supabase/supabase-js");

// 서버 전용 관리자 클라이언트 (지연 초기화).
// SUPABASE_SERVICE_ROLE_KEY 미설정 환경에서도 서버는 정상 기동.
// 실제 admin API 호출 시점에만 키 검증.

let client = null;
let warned = false;

function getSupabaseAdmin() {
  if (client) return client;

  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !key) {
    if (!warned) {
      console.warn(
        "[supabaseAdmin] SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정 — Kakao 가입 기능 비활성.",
      );
      warned = true;
    }
    return null;
  }

  client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}

module.exports = { getSupabaseAdmin };
