// server/routes/travelRoutes.js
const express = require("express");
const router = express.Router();
// 위에서 만든 컨트롤러를 가져옵니다.
const {
  findLocation,
  findMood,
} = require("../controllers/imageAnalyzeController"); //

// 주소와 컨트롤러 함수를 매핑(연결)만 해줍니다.
router.post("/find-location", findLocation);
router.post("/find-mood", findMood);

module.exports = router;
