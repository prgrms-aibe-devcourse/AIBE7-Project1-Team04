const API_BASE_URL = "";

export async function requestApi(url, options = {}) {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("서버 응답을 처리할 수 없습니다.");
  }

  if (!response.ok) {
    throw new Error(data.message || "요청 처리 중 오류가 발생했습니다.");
  }

  return data;
}

export async function requestItinerary(payload) {
  const data = await requestApi("/api/itineraries/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!data.ok) {
    throw new Error(data.message || "일정 생성 요청에 실패했습니다.");
  }

  return data.itinerary;
}

export async function requestItineraryWithProgress(payload, onProgress) {
  const response = await fetch(
    `${API_BASE_URL}/api/itineraries/generate-stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok || !response.body) {
    throw new Error("일정 생성 요청에 실패했습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";
  let finalItinerary = null;

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      const data = JSON.parse(line);

      if (data.type === "progress") {
        onProgress?.(data);
      }

      if (data.type === "result") {
        finalItinerary = data.itinerary;
      }

      if (data.type === "error") {
        throw new Error(data.message || "일정 생성 중 오류가 발생했습니다.");
      }
    }
  }

  if (buffer.trim()) {
    const data = JSON.parse(buffer);

    if (data.type === "progress") {
      onProgress?.(data);
    }

    if (data.type === "result") {
      finalItinerary = data.itinerary;
    }

    if (data.type === "error") {
      throw new Error(data.message || "일정 생성 중 오류가 발생했습니다.");
    }
  }

  if (!finalItinerary) {
    throw new Error("생성된 일정 결과가 없습니다.");
  }

  return finalItinerary;
}
