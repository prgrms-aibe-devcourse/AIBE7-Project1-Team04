import { getSupabase } from '../supabase-client.js';

// 인증 콜백 해시 여부를 확인한다 (implicit / magic link)
export function hasAuthRedirectHash() {
  const params = new URLSearchParams(window.location.hash.slice(1));

  return Boolean(params.get('access_token') && params.get('type'));
}

// 인증 콜백 쿼리 여부를 확인한다 (PKCE)
export function hasAuthRedirectQuery() {
  const params = new URLSearchParams(window.location.search);

  return Boolean(params.get('code'));
}

// 인증 콜백을 처리하고 홈으로 보낸다
export async function handleAuthRedirect() {
  const supabase = getSupabase();

  if (!supabase) {
    return false;
  }

  let session = null;

  // PKCE 콜백: ?code 를 명시적으로 세션으로 교환한다
  // (createClient 디폴트의 detectSessionInUrl 자동 교환은 비동기라
  //  바로 이어지는 getSession()이 race로 null을 받을 수 있음)
  if (hasAuthRedirectQuery()) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      window.location.href,
    );

    if (error) {
      console.error('OAuth 코드 교환 실패:', error);
      return false;
    }

    session = data?.session ?? null;
  }
  // implicit / magic link 콜백: #access_token 는 createClient가 즉시 처리하므로
  // getSession() 으로 가져온다
  else if (hasAuthRedirectHash()) {
    const { data } = await supabase.auth.getSession();
    session = data?.session ?? null;
  } else {
    return false;
  }

  if (!session) {
    console.warn('OAuth 콜백에 세션이 없습니다.');
    return false;
  }

  // 기존 이메일 로그인과 같은 키로 세션을 저장한다
  localStorage.setItem('session', JSON.stringify(session));

  window.history.replaceState({}, '', window.location.pathname);
  window.location.replace('/');
  return true;
}
