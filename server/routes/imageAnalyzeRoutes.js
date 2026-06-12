const express = require("express");
const router = express.Router();
const {
  findLocation,
  findMood,
  confirmLocation,
} = require("../controllers/imageAnalyzeController"); //

router.post("/find-location", findLocation);
router.post("/confirm-location", confirmLocation); // 추가
router.post("/find-mood", findMood);

module.exports = router;
