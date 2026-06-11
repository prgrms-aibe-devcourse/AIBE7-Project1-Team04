const { getSupabaseAdmin } = require("../config/supabaseAdmin");
const mainSupabase = require("../config/supabaseClient");
const oauthState = require("../utils/oauthStateCache");
const {
  buildAuthorizeUrl,
  exchangeCode,
  getUserInfo,
} = require("../utils/kakaoOauth");

// 1) /api/auth/kakao/authorize
//    Kakao OAuth 인증 페이지로 리다이렉트.
function authorize(_req, res) {
  if (!process.env.KAKAO_CLIENT_ID || !process.env.KAKAO_REDIRECT_URI) {
    return res
      .status(500)
      .send("Kakao OAuth 환경변수가 설정되지 않았습니다.");
  }
  res.redirect(buildAuthorizeUrl());
}

// 2) /api/auth/kakao/callback
//    Kakao가 ?code= 를 붙여 호출. 토큰 교환 + 사용자 조회.
//    기존 사용자면 세션 즉시 발급, 신규면 이메일 입력 페이지로 이동.
async function callback(req, res) {
  try {
    const { code, error: kakaoError, error_description } = req.query;

    if (kakaoError) {
      return redirectWithError(
        res,
        "/pages/login.html",
        kakaoError,
        error_description,
      );
    }
    if (!code) {
      return redirectWithError(
        res,
        "/pages/login.html",
        "missing_code",
        "인증 코드가 없습니다.",
      );
    }

    const tokens = await exchangeCode(code);
    const userInfo = await getUserInfo(tokens.access_token);

    const kakaoSub = String(userInfo.id);
    const nickname =
      userInfo.kakao_account?.profile?.nickname ||
      userInfo.properties?.nickname ||
      "";

    // 기존 사용자 검색: user_metadata.kakao_sub 매칭
    const existingUser = await findUserByKakaoSub(kakaoSub);

    if (existingUser) {
      const session = await issueSessionFor(existingUser.email);
      if (!session) {
        return redirectWithError(
          res,
          "/pages/login.html",
          "session_issue_failed",
          "세션 발급에 실패했습니다.",
        );
      }
      return sendSessionHtml(res, session);
    }

    // 신규: identity를 state에 저장 후 이메일 입력 페이지로
    const stateId = oauthState.put({ kakaoSub, nickname });
    const url = new URL(
      "/pages/kakao-complete.html",
      `${req.protocol}://${req.get("host")}`,
    );
    url.searchParams.set("state", stateId);
    if (nickname) url.searchParams.set("nickname", nickname);
    return res.redirect(url.pathname + url.search);
  } catch (err) {
    console.error("[kakao/callback]", err);
    return redirectWithError(
      res,
      "/pages/login.html",
      "kakao_callback_error",
      err.message || "처리 중 오류가 발생했습니다.",
    );
  }
}

// 3) POST /api/auth/kakao/complete
//    클라이언트가 이메일/비밀번호와 state를 보냄. 사용자 생성 + 세션 발급.
async function complete(req, res, next) {
  try {
    const {
      state,
      email,
      password,
      nickname: clientNickname,
    } = req.body || {};

    if (!state || !email || !password) {
      return res
        .status(400)
        .json({ message: "이메일, 비밀번호, state 가 필요합니다." });
    }

    const stateData = oauthState.take(state);
    if (!stateData) {
      return res
        .status(400)
        .json({
          message:
            "인증 정보가 만료되었습니다. 처음부터 다시 시도해 주세요.",
        });
    }

    const { kakaoSub, nickname: kakaoNickname } = stateData;
    const finalNickname = (clientNickname || kakaoNickname || "").trim();

    // 중복 가입 방지: 같은 kakao_sub 매칭 user 가 이미 있는지 확인
    const dupKakao = await findUserByKakaoSub(kakaoSub);
    if (dupKakao) {
      return res
        .status(409)
        .json({
          message: "이미 카카오로 가입된 계정이 있습니다. 다시 로그인해 주세요.",
        });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res
        .status(500)
        .json({
          message:
            "Kakao 가입 기능이 비활성 상태입니다. SUPABASE_SERVICE_ROLE_KEY 설정을 확인해 주세요.",
        });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        provider: "kakao",
        kakao_sub: kakaoSub,
        nickname: finalNickname,
      },
    });

    if (error) {
      const message =
        error.message?.includes("already") ||
        error.message?.includes("registered")
          ? "이미 가입된 이메일입니다. 다른 이메일을 사용해 주세요."
          : error.message || "가입에 실패했습니다.";
      return res.status(400).json({ message });
    }

    const session = await issueSessionFor(email, password);
    if (!session) {
      return res
        .status(500)
        .json({
          message:
            "계정은 생성되었으나 세션 발급에 실패했습니다. 일반 로그인으로 다시 시도해 주세요.",
        });
    }

    return res.json({ session, user: data.user });
  } catch (err) {
    next(err);
  }
}

// 사용자 검색 (user_metadata.kakao_sub 매칭).
// 주의: admin.listUsers 는 페이지네이션 필요. 현재 1페이지 1000명 기준.
// 사용자가 늘면 별도 매핑 테이블로 이전 필요 (TODO).
async function findUserByKakaoSub(kakaoSub) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const target = String(kakaoSub);
  const perPage = 1000;
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      console.error("[listUsers]", error);
      return null;
    }
    const hit = data.users.find(
      (u) => String(u.user_metadata?.kakao_sub) === target,
    );
    if (hit) return hit;
    if (data.users.length < perPage) return null;
  }
  return null;
}

// 세션 발급:
// (a) password 가 주어지면 그걸로 signInWithPassword 호출 (신규 가입 직후)
// (b) password 가 없으면 magic link 를 admin.generateLink 로 생성 후
//     hashed_token 으로 verifyOtp 호출하여 세션 발급 (재로그인)
async function issueSessionFor(email, password) {
  if (password) {
    const { data, error } = await mainSupabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error("[signInWithPassword]", error);
      return null;
    }
    return data.session;
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("[generateLink]", linkErr);
    return null;
  }

  const { data: verifyData, error: verifyErr } =
    await mainSupabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });
  if (verifyErr || !verifyData?.session) {
    console.error("[verifyOtp]", verifyErr);
    return null;
  }
  return verifyData.session;
}

// 세션을 base64 로 인코딩해 HTML 스크립트로 localStorage에 저장 후 홈으로.
// HttpOnly 쿠키 대안도 가능하지만 현재 클라이언트가 localStorage 기반이라 동일 키 유지.
function sendSessionHtml(res, session) {
  const b64 = Buffer.from(JSON.stringify(session)).toString("base64");
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="ko"><head><meta charset="UTF-8"><title>로그인 처리 중...</title></head>
<body style="font-family:system-ui;padding:32px;color:#374151;">로그인 처리 중입니다...
<script>
try {
  localStorage.setItem('session', atob('${b64}'));
} catch (e) { console.error(e); }
window.location.replace('/');
</script>
</body></html>`);
}

function redirectWithError(res, base, code, description) {
  const url = new URL(base, "http://placeholder");
  url.searchParams.set("error", code);
  if (description)
    url.searchParams.set("error_description", String(description));
  res.redirect(url.pathname + url.search);
}

module.exports = { authorize, callback, complete };
