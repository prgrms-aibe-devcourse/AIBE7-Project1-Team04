import { initSupabase, requireSupabase } from '../supabase-client.js';
import {
  handleAuthRedirect,
  hasAuthRedirectHash,
  hasAuthRedirectQuery,
} from './auth-redirect.js';

// OAuth 콜백 오류 쿼리(?error=...&error_description=...) 여부를 확인한다
function hasAuthRedirectError() {
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get('error') || params.get('error_description'));
}

// OAuth 콜백 오류를 화면에 표시한다 (Supabase / 외부 IdP 응답을 노출)
function showAuthRedirectError() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('error') || '';
  const description = params.get('error_description') || '';

  const msg = document.getElementById('message');
  if (msg) {
    const detail = decodeURIComponent(description || code || '알 수 없는 오류');
    msg.textContent = `소셜 로그인 실패: ${detail}`;
    msg.className = 'auth-message visible error';
  }

  console.error('OAuth 콜백 오류', { code, description });

  // URL을 깔끔하게 정리 (오류 파라미터 제거)
  window.history.replaceState({}, '', window.location.pathname);
}

// OAuth provider로 로그인한다
async function signInWithProvider(provider, redirectTo) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });

  // 소셜 로그인 오류를 전달한다
  if (error) {
    throw error;
  }

  return data;
}

// 소셜 로그인 버튼을 연결한다
export function bindSocialButtons() {
  document.querySelectorAll('[data-provider]').forEach((button) => {
    button.addEventListener('click', handleSocialClick);
  });
}

// 소셜 로그인 클릭을 처리한다
async function handleSocialClick(event) {
  const { provider } = event.currentTarget.dataset;

  // OAuth 콜백을 현재 로그인 페이지로 받는다
  const redirectTo = new URL('/pages/login.html', window.location.href).href;

  // 콜백 페이지에서 세션 자동 처리를 허용할 플래그 (잔존 세션 자동 로그인 방지)
  localStorage.setItem('pendingOAuth', '1');

  try {
    await signInWithProvider(provider, redirectTo);
  } catch (error) {
    localStorage.removeItem('pendingOAuth');
    const msg = document.getElementById('message');
    if (msg) {
      msg.textContent = error.message || '소셜 로그인 중 오류가 발생했습니다.';
      msg.className = 'auth-message visible error';
    }
  }
}

// Supabase 세션을 우리 키로 저장하고 홈으로 이동한다
function persistSessionAndGoHome(session) {
  localStorage.setItem('session', JSON.stringify(session));
  localStorage.removeItem('pendingOAuth');
  window.history.replaceState({}, '', window.location.pathname);
  window.location.replace('/');
}

// 직전에 사용자가 소셜 로그인 버튼을 눌렀는지 (콜백 처리 허용 게이트)
function isOAuthCallbackPending() {
  return localStorage.getItem('pendingOAuth') === '1';
}

// 소셜 로그인을 시작한다
async function initSocialAuth() {
  const supabase = initSupabase();

  // OAuth 콜백 오류 진입: 메시지 노출 후 버튼만 다시 바인딩
  if (hasAuthRedirectError()) {
    localStorage.removeItem('pendingOAuth');
    showAuthRedirectError();
    bindSocialButtons();
    return;
  }

  // PKCE 콜백(?code=): 명시적으로 교환
  if (hasAuthRedirectQuery()) {
    await handleAuthRedirect();
    return;
  }

  if (!supabase) {
    bindSocialButtons();
    return;
  }

  // 직전 클릭에서 시작된 콜백 진입에만 자동 세션 픽업 수행
  // (잔존 supabase 세션으로 인한 의도치 않은 자동 로그인 방지)
  if (isOAuthCallbackPending()) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        persistSessionAndGoHome(session);
      }
    });

    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      persistSessionAndGoHome(data.session);
      return;
    }

    // 일정 시간 내에 처리되지 않으면 플래그 정리 (영구 잠금 방지)
    setTimeout(() => localStorage.removeItem('pendingOAuth'), 5000);
  }

  bindSocialButtons();
}

initSocialAuth();
