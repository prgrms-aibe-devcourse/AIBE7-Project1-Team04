const dotenv = require("dotenv");
const { z } = require("zod");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { StructuredOutputParser } = require("@langchain/core/output_parsers");
const { ChatGroq } = require("@langchain/groq");

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



이 지역과 어울리는 한국 여행지 3곳을 추천해 주세요.

⚠️ 중요 규칙:
- 반드시 "관광지 / 명소 / 핫플레이스" 단위로만 추천
- 절대 "경상남도, 통영시, 남해군, 서울시 같은 행정구역 자체를 추천하지 말 것"
- 반드시 실제 방문 가능한 장소 이름만 사용
- name에는 관광지 이름만 작성
- region에는 해당 관광지가 위치한 시/군/구 또는 대표 지역명을 작성
- region은 좌표 검색에 사용할 수 있도록 최대한 구체적으로 작성
- 예시:
  - name: "동피랑 벽화마을"
  - region: "경상남도 통영시"
  - name: "미륵산 케이블카"
  - region: "경상남도 통영시"

반드시 JSON만 반환

{
  "spots": [
    {
      "name": "",
      "region": "",
      "reason": ""
    }
  ]
}
`);

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

이 분위기와 조건에 맞는 한국 여행지 3곳을 추천해 주세요.

⚠️ 중요 규칙:
- 반드시 "관광지 / 명소 / 핫플레이스" 단위로만 추천
- 절대 "경상남도, 통영시, 남해군, 서울시 같은 행정구역 자체를 추천하지 말 것"
- 반드시 실제 방문 가능한 장소 이름만 사용
- name에는 관광지 이름만 작성
- region에는 해당 관광지가 위치한 시/군/구 또는 대표 지역명을 작성
- region은 좌표 검색에 사용할 수 있도록 최대한 구체적으로 작성
- 예시:
  - name: "동피랑 벽화마을"
  - region: "경상남도 통영시"
  - name: "미륵산 케이블카"
  - region: "경상남도 통영시"

반드시 JSON만 반환

{
  "spots": [
    {
      "name": "",
      "region": "",
      "reason": ""
    }
  ]
}
`);
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
