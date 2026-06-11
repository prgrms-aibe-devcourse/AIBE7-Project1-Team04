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

async function verifyPlaceWithKakao(spot) {
  try {
    // 1. 안전장치: spot 객체가 없거나 name이 없으면 무조건 허위 장소로 판단
    if (!spot || !spot.name) {
      console.warn(
        "검증 실패: spot 데이터가 올바르지 않거나 name이 없습니다.",
        spot,
      );
      return false;
    }

    const { name, region } = spot;

    // 2. 문자열 변환 및 공백 제거 안전하게 처리
    const normalizedTargetName = String(name).replace(/\s+/g, "").toLowerCase();

    // 3. region(주소)이 있을 때만 구/시 단위 파싱 (없으면 공백 처리)
    let localDistrict = "";
    if (region) {
      const regionTokens = String(region).split(" ");
      localDistrict = regionTokens[regionTokens.length - 1] || "";
    }

    // 카카오 API 호출
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(name)}`,
      {
        headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
      },
    );
    const data = await response.json();

    if (!data.documents || data.documents.length === 0) return false;

    return data.documents.some((doc) => {
      if (!doc.place_name) return false;

      const kakaoPlaceName = doc.place_name.replace(/\s+/g, "").toLowerCase();
      const kakaoAddress = doc.address_name || "";

      // 이름 연관성 체크 (서로를 포함하는지)
      const nameMatches =
        kakaoPlaceName.includes(normalizedTargetName) ||
        normalizedTargetName.includes(kakaoPlaceName);

      // 지역 검증 (localDistrict가 존재할 때만 주소 비교, 없으면 이름만 맞으면 통과)
      const regionMatches = localDistrict
        ? kakaoAddress.includes(localDistrict)
        : true;

      return nameMatches && regionMatches;
    });
  } catch (e) {
    console.error("지도 API 조회 실패:", e);
    return false;
  }
}

module.exports = {
  searchKakaoPlaces,
  verifyPlaceWithKakao,
};
