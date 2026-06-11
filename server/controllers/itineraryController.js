const { buildItineraryPrompt } = require("../ai/prompt");
const { generateItinerary: generateAiItinerary } = require("../ai/aiClient");
const { createMockItinerary } = require("../ai/mockItinerary");
const { verifyItineraryPlaces } = require("../ai/placeVerifier");

async function generateItinerary(req, res, next) {
  try {
    const payload = req.body;
    const prompt = buildItineraryPrompt(payload);

    const rawItinerary = await generateAiItinerary({
      provider: payload.provider,
      prompt,
    });

    const itinerary = await verifyItineraryPlaces(rawItinerary, payload);

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

function sendStreamData(res, data) {
  res.write(`${JSON.stringify(data)}\n`);
}

function sendProgress(res, stage, message) {
  sendStreamData(res, {
    type: "progress",
    stage,
    message,
  });
}

async function generateItineraryStream(req, res, next) {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  try {
    const payload = req.body;

    sendProgress(
      res,
      "analyze",
      "입력한 키워드와 여행 조건을 분석하고 있어요.",
    );

    const prompt = buildItineraryPrompt(payload);

    sendProgress(
      res,
      "route",
      "AI가 Day별 코스와 여행 동선을 구성하고 있어요.",
    );

    const rawItinerary = await generateAiItinerary({
      provider: payload.provider,
      prompt,
    });

    sendProgress(res, "verify", "장소 정보와 좌표를 검증하고 있어요.");

    const itinerary = await verifyItineraryPlaces(rawItinerary, payload);

    sendProgress(
      res,
      "finalize",
      "결과 페이지에 표시할 일정을 정리하고 있어요.",
    );

    sendStreamData(res, {
      type: "result",
      ok: true,
      itinerary,
    });

    res.end();
  } catch (error) {
    console.error("[스트리밍 일정 생성 실패]", error.message);

    if (process.env.ENABLE_MOCK_FALLBACK === "true") {
      sendProgress(
        res,
        "finalize",
        "예시 일정을 불러와 결과 페이지를 준비하고 있어요.",
      );

      sendStreamData(res, {
        type: "result",
        ok: true,
        itinerary: createMockItinerary(req.body),
        isMock: true,
        message: "AI 호출에 실패하여 예시 일정을 반환했습니다.",
      });

      res.end();
      return;
    }

    sendStreamData(res, {
      type: "error",
      ok: false,
      message: error.message || "일정 생성 중 오류가 발생했습니다.",
    });

    res.end();
  }
}

module.exports = {
  generateItinerary,
  generateItineraryStream,
};
