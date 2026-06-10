import { getSupabase } from '../supabase-client.js';

// 인증 콜백 해시 여부를 확인한다
export function hasAuthRedirectHash() {
  const params = new URLSearchParams(window.location.hash.slice(1));

  return Boolean(params.get('access_token') && params.get('type'));
}

// 인증 콜백 쿼리 여부를 확인한다
export function hasAuthRedirectQuery() {
  const params = new URLSearchParams(window.location.search);

  return Boolean(params.get('code'));
}

// 인증 콜백을 처리하고 홈으로 보낸다
export async function handleAuthRedirect() {
  const supabase = getSupabase();

  if (!supabase || (!hasAuthRedirectHash() && !hasAuthRedirectQuery())) {
    return false;
  }

  // Supabase가 콜백 세션을 저장하도록 기다린다
  const { data } = await supabase.auth.getSession();

  // 기존 이메일 로그인과 같은 키로 세션을 저장한다
  if (data.session) {
    localStorage.setItem('session', JSON.stringify(data.session));
  }

  window.history.replaceState({}, '', window.location.pathname);
  window.location.replace('/');
  return true;
}
