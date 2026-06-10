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
