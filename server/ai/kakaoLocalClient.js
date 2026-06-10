const KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

async function searchKakaoPlaces({
  query,
  categoryGroupCode,
  size = 10,
  timeoutMs = 2500,
}) {
  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (!apiKey) {
    throw new Error("KAKAO_REST_API_KEY가 .env에 없습니다.");
  }

  const params = new URLSearchParams();
  params.set("query", query);
  params.set("size", String(size));
  params.set("sort", "accuracy");

  if (categoryGroupCode) {
    params.set("category_group_code", categoryGroupCode);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${KAKAO_KEYWORD_URL}?${params.toString()}`, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || "카카오 장소 검색에 실패했습니다.");
    }

    return Array.isArray(data.documents) ? data.documents : [];
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  searchKakaoPlaces,
};
