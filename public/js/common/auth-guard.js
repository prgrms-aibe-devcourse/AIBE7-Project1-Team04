(function (global) {
  function getSession() {
    try {
      return JSON.parse(localStorage.getItem("session") || "null");
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return Boolean(getSession() && getSession().access_token);
  }

  function requireLogin(opts) {
    opts = opts || {};
    var msg = opts.message || "로그인이 필요한 기능입니다.";
    var session = getSession();
    if (session && session.access_token) return session;
    try { alert(msg); } catch (e) {}
    window.location.replace("/pages/login.html");
    return null;
  }

  global.PicTripGuard = { getSession: getSession, isLoggedIn: isLoggedIn, requireLogin: requireLogin };
})(window);
