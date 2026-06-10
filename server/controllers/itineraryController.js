const { buildItineraryPrompt } = require("../ai/prompt");
const { generateItinerary: generateAiItinerary } = require("../ai/aiClient");
const { createMockItinerary } = require("../ai/mockItinerary");

async function generateItinerary(req, res, next) {
  try {
    const payload = req.body;
    const prompt = buildItineraryPrompt(payload);

    const itinerary = await generateAiItinerary({
      provider: payload.provider,
      prompt,
    });

    res.json({
      ok: true,
      itinerary,
    });
  } catch (error) {
    console.error("[일정 생성 실패]", error.message);

    if (process.env.ENABLE_MOCK_FALLBACK === "true") {
      return res.json({
        ok: true,
        itinerary: createMockItinerary(req.body),
        isMock: true,
        message: "AI 호출에 실패하여 예시 일정을 반환했습니다.",
      });
    }

    next(error);
  }
}

module.exports = {
  generateItinerary,
};
