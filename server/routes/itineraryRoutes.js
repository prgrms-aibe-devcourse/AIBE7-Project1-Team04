const express = require("express");
const {
  generateItinerary,
  generateItineraryStream,
} = require("../controllers/itineraryController");

const router = express.Router();

router.post("/generate", generateItinerary);
router.post("/generate-stream", generateItineraryStream);

module.exports = router;
