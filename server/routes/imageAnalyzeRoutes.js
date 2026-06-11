const express = require("express");
const router = express.Router();
const {
  findLocation,
  findMood,
} = require("../controllers/imageAnalyzeController"); //

router.post("/find-location", findLocation);
router.post("/find-mood", findMood);

module.exports = router;
