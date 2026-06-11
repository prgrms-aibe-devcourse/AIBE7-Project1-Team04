const express = require("express");
const router = express.Router();
const { signup, login } = require("../controllers/authController");
const kakao = require("../controllers/kakaoAuthController");

router.post("/signup", signup);
router.post("/login", login);

// Kakao OAuth (Custom OIDC + 이메일 직접 수집)
router.get("/kakao/authorize", kakao.authorize);
router.get("/kakao/callback", kakao.callback);
router.post("/kakao/complete", kakao.complete);

module.exports = router;
