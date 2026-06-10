const GOOGLE_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

async function searchGooglePlaces({
  query,
  includedType,
  languageCode = "ko",
  regionCode = "KR",
  pageSize = 5,
  timeoutMs = 3000,
}) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY가 .env에 없습니다.");
  }

  const body = {
    textQuery: query,
    languageCode,
    regionCode,
    pageSize,
  };

  if (includedType) {
    body.includedType = includedType;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GOOGLE_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.businessStatus",
          "places.primaryType",
          "places.types",
          "places.googleMapsUri",
        ].join(","),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error?.message || "Google Places 장소 검색에 실패했습니다.",
      );
    }

    return Array.isArray(data.places) ? data.places : [];
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  searchGooglePlaces,
};
