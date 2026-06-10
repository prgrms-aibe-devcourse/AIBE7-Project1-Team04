const PROVIDERS = {
  gemini: generateWithGemini,
  groq: generateWithOpenAICompatible,
  nim: generateWithOpenAICompatible,
};

async function generateItinerary({ provider, prompt }) {
  const normalizedProvider = String(
    provider || process.env.DEFAULT_PROVIDER || "gemini",
  ).toLowerCase();

  const runner = PROVIDERS[normalizedProvider];

  if (!runner) {
    throw new Error(`지원하지 않는 AI Provider입니다: ${provider}`);
  }

  if (!prompt) {
    throw new Error("AI에게 전달할 프롬프트가 비어 있습니다.");
  }

  const text = await runner(normalizedProvider, prompt);
  return parseJsonFromModel(text);
}

async function generateWithGemini(_provider, prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 .env에 없습니다.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.75,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini API 호출에 실패했습니다.");
  }

  return (
    data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ||
    ""
  );
}

async function generateWithOpenAICompatible(provider, prompt) {
  const config = getOpenAICompatibleConfig(provider);

  if (!config.apiKey) {
    throw new Error(`${config.keyName}가 .env에 없습니다.`);
  }

  const requestBody = {
    model: config.model,
    temperature: 0.75,
    messages: [
      {
        role: "system",
        content:
          "너는 한국어 여행 일정 생성기입니다. 반드시 JSON 객체만 반환하세요.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  if (config.supportsJsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `${provider.toUpperCase()} API 호출에 실패했습니다.`,
    );
  }

  return data?.choices?.[0]?.message?.content || "";
}

function getOpenAICompatibleConfig(provider) {
  if (provider === "groq") {
    return {
      apiKey: process.env.GROQ_API_KEY,
      keyName: "GROQ_API_KEY",
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      supportsJsonMode: true,
    };
  }

  if (provider === "nim") {
    return {
      apiKey: process.env.NIM_API_KEY,
      keyName: "NIM_API_KEY",
      baseUrl: (
        process.env.NIM_BASE_URL || "https://integrate.api.nvidia.com/v1"
      ).replace(/\/$/, ""),
      model: process.env.NIM_MODEL || "meta/llama-3.1-70b-instruct",
      supportsJsonMode: false,
    };
  }

  throw new Error(`지원하지 않는 OpenAI 호환 Provider입니다: ${provider}`);
}

function parseJsonFromModel(text) {
  if (!text) {
    throw new Error("AI 응답이 비어 있습니다.");
  }

  const cleaned = String(text)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("AI 응답을 JSON으로 변환하지 못했습니다.");
  }
}

module.exports = {
  generateItinerary,
};
