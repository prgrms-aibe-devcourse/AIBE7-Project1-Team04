const supabase = require('../config/supabaseClient');

async function signup(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.status(201).json({ message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.', user: data.user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    res.json({ message: '로그인 성공', session: data.session, user: data.user });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login };
