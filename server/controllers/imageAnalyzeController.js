const express = require("express");
const router = express.Router();
const exifr = require("exifr");
const dotenv = require("dotenv");
const { z } = require("zod");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { StructuredOutputParser } = require("@langchain/core/output_parsers");

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
        country: z.string().optional().default(""),
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
사진을 보고 위치와 좌표를 추정해 주세요.

힌트:
{hint}

반드시 JSON만 반환하고 schema를 지켜 주세요.

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
    const response = await gemma.invoke([
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
          country: "",
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
        name: region,
        country: "",
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

    const imageBuffer = base64ToBuffer(image);
    const gps = await exifr.gps(imageBuffer);

    if (
      gps &&
      Number.isFinite(gps.latitude) &&
      Number.isFinite(gps.longitude) &&
      !Number.isNaN(gps.latitude) &&
      !Number.isNaN(gps.longitude)
    ) {
      const recommendation = await recommendTravelPlace(`
위도: ${gps.latitude}
경도: ${gps.longitude}

이 위치를 기준으로 한국 여행지 3곳을 추천해 주세요.

반드시 JSON만 반환

{
  "spots": [
    {
      "name": "",
      "country": "",
      "reason": ""
    }
  ]
}
`);

      return res.json({
        source: "EXIF",
        latitude: gps.latitude,
        longitude: gps.longitude,
        recommendation,
      });
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

      if (parsed && parsed.confidence >= 80) {
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

위도:
${safeLocation.latitude}

경도:
${safeLocation.longitude}

이 지역과 어울리는 한국 여행지 3곳을 추천해 주세요.

반드시 JSON만 반환

{ "spots": [ { "name": "", "reason": "" } ] }
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

반드시 JSON만 반환

{
  "spots": [
    {
      "name": "",
      "country": "",
      "reason": ""
    }
  ]
}
`);

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
