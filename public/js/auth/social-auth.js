import { initSupabase, requireSupabase } from '../supabase-client.js';
import {
  handleAuthRedirect,
  hasAuthRedirectHash,
  hasAuthRedirectQuery,
} from './auth-redirect.js';

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

  try {
    await signInWithProvider(provider, redirectTo);
  } catch (error) {
    const msg = document.getElementById('message');
    if (msg) {
      msg.textContent = error.message || '소셜 로그인 중 오류가 발생했습니다.';
      msg.className = 'auth-message visible error';
    }
  }
}

// 소셜 로그인을 시작한다
async function initSocialAuth() {
  initSupabase();

  // OAuth 콜백 진입이면 세션을 처리하고 종료한다
  if (hasAuthRedirectHash() || hasAuthRedirectQuery()) {
    await handleAuthRedirect();
    return;
  }

  bindSocialButtons();
}

initSocialAuth();
