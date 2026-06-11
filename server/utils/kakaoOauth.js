// Kakao OAuth 2.0 / OIDC 호출 헬퍼.
// REST API 직접 호출. Supabase 내장 provider 우회.
// 환경변수: KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET(선택), KAKAO_REDIRECT_URI

const KAUTH = "https://kauth.kakao.com";
const KAPI = "https://kapi.kakao.com";

function buildAuthorizeUrl({ scope = "openid profile_nickname" } = {}) {
  const url = new URL(`${KAUTH}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.KAKAO_CLIENT_ID);
  url.searchParams.set("redirect_uri", process.env.KAKAO_REDIRECT_URI);
  url.searchParams.set("scope", scope);
  return url.toString();
}

async function exchangeCode(code) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.KAKAO_CLIENT_ID,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    params.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const res = await fetch(`${KAUTH}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Kakao 토큰 교환 실패 (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

async function getUserInfo(accessToken) {
  const res = await fetch(`${KAPI}/v2/user/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Kakao 사용자 조회 실패 (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

module.exports = { buildAuthorizeUrl, exchangeCode, getUserInfo };
