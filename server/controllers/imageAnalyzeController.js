const dotenv = require("dotenv");
const { z } = require("zod");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { StructuredOutputParser } = require("@langchain/core/output_parsers");
const { ChatGroq } = require("@langchain/groq");

const { verifyPlaceWithKakao } = require("../ai/kakaoLocalClient");

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const gemini = new ChatGoogleGenerativeAI({
  apiKey,
  model: "gemini-3.1-flash-lite",
  temperature: 0,
});

const gemma = new ChatGoogleGenerativeAI({
  apiKey,
  model: "gemma-4-31b-it",
  temperature: 0,
});

const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0,
  topP: 0.1,
});

dotenv.config();

const locationParser = StructuredOutputParser.fromZodSchema(
  z.object({
    region: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    confidence: z.number(),
  }),
);

const moodParser = StructuredOutputParser.fromZodSchema(
  z.object({
    terrain: z.string(),
    weather: z.string(),
    color: z.string(),
    mood: z.string(),
  }),
);

const recommendationParser = StructuredOutputParser.fromZodSchema(
  z.object({
    spots: z.array(
      z.object({
        name: z.string(),
        region: z.string(),
        reason: z.string(),
      }),
    ),
  }),
);

function readModelText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("");
  }
  return String(content || "");
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  return text.trim();
}

function normalizeBase64Input(input) {
  if (typeof input !== "string") return "";

  const commaIndex = input.indexOf(",");
  if (input.startsWith("data:") && commaIndex >= 0) {
    return input.slice(commaIndex + 1);
  }

  return input;
}

function base64ToBuffer(input) {
  return Buffer.from(normalizeBase64Input(input), "base64");
}

async function analyzeLocationWithGemini(base64Image, hint = "") {
  const prompt = new PromptTemplate({
    template: `
당신은 이미지 분석 전문가입니다.

주어진 사진을 보고 해당 사진이 촬영된 **여행지(관광지/명소/핫플레이스)**를 추정하세요.

힌트:
{hint}

반드시 지켜야 할 규칙:
- 결과는 반드시 한국어로 작성합니다.
- 반드시 "실제 존재하는 여행지 이름"을 반환합니다.
- 행정구역(시/도 + 시/군/구)을 반드시 포함합니다.
  예: "서울특별시 종로구 경복궁", "제주특별자치도 제주시 성산일출봉"
- 너무 큰 행정구역(예: 서울, 부산)만 단독으로 반환하지 마세요.
- 가장 가능성 높은 장소 1개만 선택합니다.
- 설명 없이 결과만 반환합니다.
- 반드시 JSON 형식만 반환합니다.
- schema를 반드시 따릅니다.

{format_instructions}
`,
    inputVariables: ["hint"],
    partialVariables: {
      format_instructions: locationParser.getFormatInstructions(),
    },
  });

  const formattedPrompt = await prompt.format({
    hint: hint || "(없음)",
  });

  const response = await gemini.invoke([
    {
      role: "user",
      content: [
        { type: "text", text: formattedPrompt },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${normalizeBase64Input(base64Image)}`,
          },
        },
      ],
    },
  ]);

  const raw = readModelText(response.content);
  return locationParser.parse(extractJson(raw));
}

async function analyzeMoodWithGemini(base64Image, extra = "") {
  const prompt = new PromptTemplate({
    template: `
사진의 분위기, 색감, 계절감, 장면의 인상을 분석해 주세요.

추가사항:
{extra}

반드시 JSON만 반환하고 schema를 지켜 주세요.

{format_instructions}
`,
    inputVariables: ["extra"],
    partialVariables: {
      format_instructions: moodParser.getFormatInstructions(),
    },
  });

  const formattedPrompt = await prompt.format({
    extra: extra || "(없음)",
  });

  const response = await gemini.invoke([
    {
      role: "user",
      content: [
        { type: "text", text: formattedPrompt },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${normalizeBase64Input(base64Image)}`,
          },
        },
      ],
    },
  ]);

  const raw = readModelText(response.content);
  return moodParser.parse(extractJson(raw));
}

async function recommendTravelPlace(prompt) {
  try {
    const response = await groq.invoke([
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ]);

    const raw = readModelText(response.content);
    return recommendationParser.parse(extractJson(raw));
  } catch (error) {
    console.error("recommendTravelPlace failed:", error);
    return {
      spots: [
        {
          name: "추천 여행지",
          region: "대한민국",
          reason: "추천 결과를 생성하지 못해 기본 응답을 반환했습니다.",
        },
      ],
    };
  }
}

function fallbackRecommendation(region = "알 수 없음") {
  return {
    spots: [
      {
        name: "추천 여행지",
        region,
        reason: "기본 추천 정보를 반환했습니다.",
      },
    ],
  };
}

async function findLocation(req, res, next) {
  try {
    const { image, hint } = req.body || {};

    if (!image) {
      return res.status(400).json({ error: "image is required" });
    }

    let historyHint = "";
    let parsed = null;

    for (let i = 0; i < 3; i += 1) {
      try {
        parsed = await analyzeLocationWithGemini(
          image,
          `${hint || ""}\n${historyHint}`,
        );
      } catch (error) {
        console.error("analyzeLocationWithGemini failed:", error);
        parsed = null;
      }

      if (parsed && parsed.confidence >= 90) {
        break;
      }

      historyHint += `
이전 결과가 확실하지 않았습니다.
지형, 건축물, 식생, 기후 단서를 더 보수적으로 판단해 주세요.
`;
    }

    const safeLocation = parsed || {
      region: hint ? `단서 기반 추정: ${hint}` : "알 수 없는 지역",
      latitude: 0,
      longitude: 0,
      confidence: 0,
    };

    const recommendation = await recommendTravelPlace(`
추정 위치:
${safeLocation.region}

당신은 대한민국 최고의 국내 여행 가이드입니다.
제시된 조건을 바탕으로, 카카오맵/네이버 지도에서 '실제 검색 및 위치 조회가 가능한' 한국의 구체적인 여행지 3곳을 추천해 주세요.

이 지역과 어울리는 한국의 구체적인 여행지 5~6곳을 추천해 주세요.

⚠️ [필수 준수 규칙 - 위반 시 에러]
1. 존엄성 및 실존 주의:
   - 절대로 가상의 장소, 미사여구로 꾸며낸 장소를 지어내지 마십시오. (X: "낭만적인 부산 밤바다 거리", "조용한 제주 돌담길")
   - 반드시 지도 앱에 등록되어 있는 실제 상호명, 공공 관광지명, 명소 고유 명사만 사용하십시오. (O: "광안리해수욕장", "감천문화마을", "신창풍차해안도로")

2. 추천 단위 제한:
   - "부산 영도구", "제주 서귀포시" 같은 행정구역 자체를 name에 넣지 마십시오. 반드시 구체적인 명소여야 합니다.

3. 데이터 매핑 규칙:
   - "name": 지도 앱에 검색할 '최종 목적지 고유 명칭'만 명확히 작성 (예: "해운대 블루라인파크")
   - "region": 해당 명소가 위치한 '시/도 + 시/군/구'까지 정확한 행정구역 작성 (예: "부산광역시 해운대구")
   - "reason": 왜 이 장소를 추천하는지 이유를 친절하게 설명

4. 명소 명칭의 무단 축약 및 변형 금지 (매우 중요):
   - 인터넷 검색 및 지도 앱에 등록된 '정식 풀네임(Official Full Name)'을 그대로 적으십시오.
   - 접미사(호수, 저수지, 해수욕장, 평야, 생태공원 등)를 절대로 마음대로 생략하거나 축약하지 마십시오.
   - 예시 오류 교정:
     * (X) 반월호 -> (O) 반월호수
     * (X) 백운호 -> (O) 백운호수
     * (X) 광안리 -> (O) 광안리해수욕장
     * (X) 일산공원 -> (O) 일산호수공원
   - 지형이나 상호명의 끝 글자 하나가 달라지면 지도 API가 장소를 찾지 못하므로, 반드시 정확한 풀네임인지 검증 후 출력하세요.

5. 국가 및 행정 기관 건물 추천 배제 (매우 중요):
   - 순수한 관광 목적이 아닌 공공 행정 기관, 국가 건물, 지방 자치 단체 청사는 **절대로** 추천하지 마십시오.
   - 예시 오류 교정: (X) 서울시청, 부산시청, 제주도청, 종로구청, 울릉군청 등 모든 형태의 시청/도청/구청/군청/주민센터/정부청사 및 법원 등 공공 업무 시설은 제외합니다. 다만, 역사적 가치가 있어 관광지화된 장소(예: '구 서울역사', '덕수궁 석조전')는 허용됩니다.

6. 사진 속 추정 위치 제외 (★ 추가된 규칙):
   - 위에 제시된 '추정 위치(${safeLocation.region})'와 완전히 동일하거나, 해당 추정 위치 내부에 포함된 구체적인 장소는 추천 결과('spots')에 절대로 포함하지 마십시오.
   - 예컨대 추정 위치가 '제주특별자치도 제주시 성산일출봉'이라면, 추천 리스트에는 성산일출봉을 제외한 다른 매력적인 연관 여행지들로만 구성해야 합니다.

  출력 전 반드시 자가검증:
  - [ ] 이 장소를 카카오맵에 검색하면 나오는가?
  - [ ] 공식 명칭 전체를 사용했는가?
  - [ ] 미사여구나 수식어가 name 필드에 없는가?
  검증 실패 시 다른 장소로 교체할 것.
반드시 아래 JSON 포맷 표준을 준수하여 JSON 데이터만 반환하세요. 다른 텍스트는 절대 포함하지 마십시오.

{
  "spots": [
    {
      "name": "명소 고유 명칭",
      "region": "행정구역명",
      "reason": "추천 사유 설명"
    }
  ]
}
`);

    const validSpots = [];

    // AI가 반환한 결과 중, 이름이 추정 위치 명칭을 포함하고 있다면 원천 배제
    const filteredSpots = recommendation.spots.filter((spot) => {
      return (
        !safeLocation.region.includes(spot.name) &&
        !spot.name.includes(safeLocation.region)
      );
    });

    for (const spot of filteredSpots) {
      // 기존 recommendation.spots 대신 필터링된 배열 사용
      if (validSpots.length >= 3) break;

      if (await verifyPlaceWithKakao(spot)) {
        validSpots.push(spot);
      }
    }

    recommendation.spots = validSpots;

    return res.json({
      source: "Gemini",
      location: safeLocation,
      recommendation:
        recommendation || fallbackRecommendation(safeLocation.region),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message,
      recommendation: fallbackRecommendation("알 수 없음"),
    });
  }
}

async function findMood(req, res, next) {
  try {
    const { image, extra } = req.body || {};

    if (!image) {
      return res.status(400).json({ error: "image is required" });
    }

    let moodTags = null;
    try {
      moodTags = await analyzeMoodWithGemini(image, extra || "");
    } catch (error) {
      console.error("analyzeMoodWithGemini failed:", error);
      moodTags = {
        terrain: "알 수 없음",
        weather: "알 수 없음",
        color: "알 수 없음",
        mood: "알 수 없음",
      };
    }

    const recommendation = await recommendTravelPlace(`
사진 분위기 정보:
${JSON.stringify(moodTags, null, 2)}

추가사항:
${extra || "(없음)"}

당신은 대한민국 최고의 국내 여행 가이드입니다.
제시된 조건을 바탕으로, 카카오맵/네이버 지도에서 '실제 검색 및 위치 조회가 가능한' 한국의 구체적인 여행지 3곳을 추천해 주세요.

이 분위기와 조건에 맞는 한국의 구체적인 여행지 5~6곳을 추천해 주세요.

⚠️ [필수 준수 규칙 - 위반 시 에러]
1. 존엄성 및 실존 주의:
   - 절대로 가상의 장소, 미사여구로 꾸며낸 장소를 지어내지 마십시오. (X: "낭만적인 부산 밤바다 거리", "조용한 제주 돌담길")
   - 반드시 지도 앱에 등록되어 있는 실제 상호명, 공공 관광지명, 명소 고유 명사만 사용하십시오. (O: "광안리해수욕장", "감천문화마을", "신창풍차해안도로")

2. 추천 단위 제한:
   - "부산 영도구", "제주 서귀포시" 같은 행정구역 자체를 name에 넣지 마십시오. 반드시 구체적인 명소여야 합니다.

3. 데이터 매핑 규칙:
   - "name": 지도 앱에 검색할 '최종 목적지 고유 명칭'만 명확히 작성 (예: "해운대 블루라인파크")
   - "region": 해당 명소가 위치한 '시/도 + 시/군/구'까지 정확한 행정구역 작성 (예: "부산광역시 해운대구")
   - "reason": 왜 이 장소를 추천하는지 이유를 친절하게 설명

4. 명소 명칭의 무단 축약 및 변형 금지 (매우 중요):
- 인터넷 검색 및 지도 앱에 등록된 '정식 풀네임(Official Full Name)'을 그대로 적으십시오.
- 접미사(호수, 저수지, 해수욕장, 평야, 생태공원 등)를 절대로 마음대로 생략하거나 축약하지 마십시오.
- 예시 오류 교정:
  * (X) 반월호 -> (O) 반월호수
  * (X) 백운호 -> (O) 백운호수
  * (X) 광안리 -> (O) 광안리해수욕장
  * (X) 일산공원 -> (O) 일산호수공원
- 지형이나 상호명의 끝 글자 하나가 달라지면 지도 API가 장소를 찾지 못하므로, 반드시 정확한 풀네임인지 검증 후 출력하세요.

5. 국가 및 행정 기관 건물 추천 배제 (매우 중요):
   - 순수한 관광 목적이 아닌 공공 행정 기관, 국가 건물, 지방 자치 단체 청사는 **절대로** 추천하지 마십시오.
   - 예시 오류 교정: (X) 서울시청, 부산시청, 제주도청, 종로구청, 울릉군청 등 모든 형태의 시청/도청/구청/군청/주민센터/정부청사 및 법원 등 공공 업무 시설은 제외합니다. 다만, 역사적 가치가 있어 관광지화된 장소(예: '구 서울역사', '덕수궁 석조전')는 허용됩니다.


출력 전 반드시 자가검증:
- [ ] 이 장소를 카카오맵에 검색하면 나오는가?
- [ ] 공식 명칭 전체를 사용했는가?
- [ ] 미사여구나 수식어가 name 필드에 없는가?
검증 실패 시 다른 장소로 교체할 것.

반드시 아래 JSON 포맷 표준을 준수하여 JSON 데이터만 반환하세요. 다른 텍스트는 절대 포함하지 마십시오.

{
  "spots": [
    {
      "name": "명소 고유 명칭",
      "region": "행정구역명",
      "reason": "추천 사유 설명"
    }
  ]
}
`);

    const validSpots = [];

    for (const spot of recommendation.spots) {
      if (validSpots.length >= 3) break; // 3개 채워지면 즉시 종료

      if (await verifyPlaceWithKakao(spot)) {
        validSpots.push(spot);
      }
    }

    recommendation.spots = validSpots;
    console.log(recommendation);
    return res.json({
      moodTags,
      recommendation,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message,
      recommendation: fallbackRecommendation("알 수 없음"),
    });
  }
}

module.exports = {
  findLocation,
  findMood,
};
