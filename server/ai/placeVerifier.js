const { searchKakaoPlaces } = require("./kakaoLocalClient");
const { searchGooglePlaces } = require("./googlePlacesClient");

const CATEGORY_CODE_MAP = {
  FOOD: "FD6",
  CAFE: "CE7",
  STAY: "AD5",
  ATTRACTION: "AT4",
};

const STRICT_CATEGORY_TYPES = ["FOOD", "CAFE", "STAY"];

async function verifyItineraryPlaces(itinerary, payload = {}) {
  if (process.env.ENABLE_PLACE_VERIFY !== "true") {
    return itinerary;
  }

  if (!itinerary || !Array.isArray(itinerary.days)) {
    return itinerary;
  }

  const nextItinerary = JSON.parse(JSON.stringify(itinerary));

  const context = {
    destination:
      nextItinerary.destinationTitle ||
      payload.destination ||
      payload.keyword ||
      "",
    regionTokens: inferTripRegionTokens(nextItinerary, payload),
    cache: new Map(),
  };

  const targets = collectVerifyTargets(nextItinerary);

  const results = await mapWithConcurrency(targets, 3, async (target) => {
    const verifiedItem = await verifyPlaceItem(target.item, context);

    return {
      ...target,
      verifiedItem,
    };
  });

  let verifiedCount = 0;
  let googleVerifiedCount = 0;
  let kakaoVerifiedCount = 0;
  let replacedCount = 0;
  let failedCount = 0;

  results.forEach((result) => {
    if (!result || result.status !== "fulfilled") {
      failedCount += 1;
      return;
    }

    const { dayIndex, itemIndex, verifiedItem } = result.value;

    nextItinerary.days[dayIndex].items[itemIndex] = verifiedItem;

    if (verifiedItem.isVerified) verifiedCount += 1;
    if (verifiedItem.coordSource === "google_places") googleVerifiedCount += 1;
    if (verifiedItem.coordSource === "kakao_keyword") kakaoVerifiedCount += 1;
    if (verifiedItem.verifyStatus === "replaced") replacedCount += 1;
    if (!verifiedItem.isVerified) failedCount += 1;
  });

  return {
    ...nextItinerary,
    verificationSummary: {
      enabled: true,
      method: "kakao_then_google_places",
      checkedCount: targets.length,
      verifiedCount,
      kakaoVerifiedCount,
      googleVerifiedCount,
      replacedCount,
      failedCount,
    },
  };
}

function collectVerifyTargets(itinerary) {
  const targets = [];

  itinerary.days.forEach((day, dayIndex) => {
    const items = Array.isArray(day.items) ? day.items : [];

    items.forEach((item, itemIndex) => {
      if (!item?.placeName) return;
      if (isMoveItem(item)) return;

      const categoryType = getCategoryType(item.category);

      // 음식점/카페/숙소는 반드시 검증한다.
      if (STRICT_CATEGORY_TYPES.includes(categoryType)) {
        targets.push({ dayIndex, itemIndex, item });
        return;
      }

      // 관광명소는 좌표가 없는 경우만 보조 검증한다.
      if (categoryType === "ATTRACTION" && !hasValidCoords(item)) {
        targets.push({ dayIndex, itemIndex, item });
      }
    });
  });

  return targets;
}

async function verifyPlaceItem(item, context) {
  const categoryType = getCategoryType(item.category);
  const strict = STRICT_CATEGORY_TYPES.includes(categoryType);

  // 1차: Kakao 검색
  const kakaoPlace = await findKakaoPlace(item, context);

  if (kakaoPlace) {
    return mergeKakaoPlace(item, kakaoPlace, "verified");
  }

  // 2차: Google Places 검색
  const googlePlace = await findGooglePlace(item, context, categoryType);

  if (googlePlace) {
    return mergeGooglePlace(item, googlePlace, "verified_google");
  }

  // 3차: 음식점/카페/숙소는 같은 지역의 실제 Kakao 장소로 대체
  if (strict) {
    const replacement = await findKakaoReplacement(item, context, categoryType);

    if (replacement) {
      return mergeKakaoPlace(
        {
          ...item,
          originalPlaceName: item.placeName,
          reason: item.reason,
          internalVerifyMessage:
            "기존 장소를 확인하지 못해 같은 지역의 실제 검색 가능한 장소로 보정했습니다.",
        },
        replacement,
        "replaced",
      );
    }
  }

  return {
    ...item,
    lat: null,
    lng: null,
    latitude: null,
    longitude: null,
    address: "",
    isVerified: false,
    coordSource: "",
    verifyStatus: "not_found",
  };
}

async function findKakaoPlace(item, context) {
  const categoryType = getCategoryType(item.category);
  const categoryCode = getCategoryCode(categoryType);

  const placeName = String(item.placeName || "").trim();
  const area = String(item.area || "").trim();
  const destination = String(context.destination || "").trim();

  const queries = [
    [destination, area, placeName].filter(Boolean).join(" "),
    [area, placeName].filter(Boolean).join(" "),
    [destination, placeName].filter(Boolean).join(" "),
    placeName,
  ]
    .filter(Boolean)
    .filter((query, index, array) => array.indexOf(query) === index);

  const allCandidates = [];

  for (const query of queries) {
    const candidates = await cachedKakaoSearch(context.cache, {
      query,
      categoryGroupCode: categoryCode,
      size: 10,
    });

    allCandidates.push(...candidates);

    const matched = pickBestKakaoCandidate(
      item,
      uniqueKakaoCandidates(allCandidates),
      categoryCode,
      context,
    );

    if (matched) return matched;
  }

  return null;
}

function pickBestKakaoCandidate(item, candidates, categoryCode, context) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  if (isGenericPlaceName(item.placeName)) return null;

  const targetName = normalizeText(item.placeName);
  const itemArea = normalizeText(item.area || "");

  const scored = candidates
    .filter((candidate) => isSameKakaoCategory(candidate, categoryCode))
    .filter((candidate) => candidateInTripRegion(candidate, item, context))
    .filter((candidate) => hasUsableKakaoPlace(candidate))
    .filter((candidate) => !isSuspiciousClosedCandidate(candidate))
    .map((candidate) => {
      const candidateName = normalizeText(candidate.place_name);
      const candidateAddress = normalizeText(getKakaoAddress(candidate));

      let score = 0;

      if (candidateName === targetName) score += 100;
      if (candidateName.includes(targetName)) score += 75;
      if (targetName.includes(candidateName)) score += 55;

      if (itemArea && candidateAddress.includes(itemArea)) score += 30;
      if (candidate.road_address_name) score += 10;
      if (candidate.place_url) score += 5;

      return {
        candidate,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (!best || best.score < 55) {
    return null;
  }

  return best.candidate;
}

async function findGooglePlace(item, context, categoryType) {
  const includedType = getGoogleIncludedType(categoryType);

  const placeName = String(item.placeName || "").trim();
  const area = String(item.area || "").trim();
  const destination = String(context.destination || "").trim();

  const queries = [
    [placeName, area, destination].filter(Boolean).join(" "),
    [placeName, destination].filter(Boolean).join(" "),
    [placeName, area].filter(Boolean).join(" "),
    placeName,
  ]
    .filter(Boolean)
    .filter((query, index, array) => array.indexOf(query) === index);

  const allCandidates = [];

  for (const query of queries) {
    const candidates = await cachedGoogleSearch(context.cache, {
      query,
      includedType,
    });

    allCandidates.push(...candidates);

    const matched = pickBestGoogleCandidate(
      item,
      uniqueGoogleCandidates(allCandidates),
      context,
    );

    if (matched) return matched;
  }

  return null;
}

function pickBestGoogleCandidate(item, candidates, context) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const targetName = normalizeText(item.placeName);
  const itemArea = normalizeText(item.area || "");

  const scored = candidates
    .filter((candidate) => candidate.businessStatus === "OPERATIONAL")
    .filter((candidate) => googleCandidateInTripRegion(candidate, context))
    .filter((candidate) => hasUsableGooglePlace(candidate))
    .map((candidate) => {
      const candidateName = normalizeText(candidate.displayName?.text || "");
      const candidateAddress = normalizeText(candidate.formattedAddress || "");

      let score = 0;

      if (candidateName === targetName) score += 100;
      if (candidateName.includes(targetName)) score += 75;
      if (targetName.includes(candidateName)) score += 55;

      if (itemArea && candidateAddress.includes(itemArea)) score += 30;
      if (candidate.formattedAddress) score += 10;
      if (candidate.location?.latitude && candidate.location?.longitude) {
        score += 10;
      }

      return {
        candidate,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (!best || best.score < 55) {
    return null;
  }

  return best.candidate;
}

async function findKakaoReplacement(item, context, categoryType) {
  const categoryCode = getCategoryCode(categoryType);
  const keyword = getReplacementKeyword(categoryType);

  const area = String(item.area || "").trim();
  const destination = String(context.destination || "").trim();

  const queries = [
    [destination, area, keyword].filter(Boolean).join(" "),
    [area, keyword].filter(Boolean).join(" "),
    [destination, keyword].filter(Boolean).join(" "),
    [...context.regionTokens, area, keyword].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .filter((query, index, array) => array.indexOf(query) === index);

  for (const query of queries) {
    const candidates = await cachedKakaoSearch(context.cache, {
      query,
      categoryGroupCode: categoryCode,
      size: 10,
    });

    const matched = candidates.find((candidate) => {
      return (
        isSameKakaoCategory(candidate, categoryCode) &&
        candidateInTripRegion(candidate, item, context) &&
        hasUsableKakaoPlace(candidate) &&
        !isSuspiciousClosedCandidate(candidate)
      );
    });

    if (matched) return matched;
  }

  return null;
}

function mergeKakaoPlace(item, kakaoPlace, verifyStatus) {
  const lat = Number(kakaoPlace.y);
  const lng = Number(kakaoPlace.x);

  return {
    ...item,
    placeName: kakaoPlace.place_name,
    address: getKakaoAddress(kakaoPlace),
    area: item.area || extractArea(kakaoPlace),

    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,

    kakaoPlaceId: kakaoPlace.id,
    placeUrl: kakaoPlace.place_url,
    kakaoCategoryName: kakaoPlace.category_name,
    kakaoCategoryGroupCode: kakaoPlace.category_group_code,

    isVerified: Number.isFinite(lat) && Number.isFinite(lng),
    isGeocoded: false,
    coordSource: "kakao_keyword",
    verifyStatus,
  };
}

function mergeGooglePlace(item, googlePlace, verifyStatus) {
  const lat = Number(googlePlace.location?.latitude);
  const lng = Number(googlePlace.location?.longitude);

  return {
    ...item,
    placeName: googlePlace.displayName?.text || item.placeName,
    address: googlePlace.formattedAddress || "",

    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,

    googlePlaceId: googlePlace.id,
    googleMapsUri: googlePlace.googleMapsUri,
    googleBusinessStatus: googlePlace.businessStatus,

    isVerified: Number.isFinite(lat) && Number.isFinite(lng),
    isGeocoded: false,
    coordSource: "google_places",
    verifyStatus,
  };
}

async function cachedKakaoSearch(cache, options) {
  const key = `kakao:${JSON.stringify(options)}`;

  if (cache.has(key)) return cache.get(key);

  try {
    const result = await searchKakaoPlaces(options);
    cache.set(key, result);
    return result;
  } catch (error) {
    console.error("[Kakao 장소 검색 실패]", options.query, error.message);
    cache.set(key, []);
    return [];
  }
}

async function cachedGoogleSearch(cache, options) {
  const key = `google:${JSON.stringify(options)}`;

  if (cache.has(key)) return cache.get(key);

  try {
    const result = await searchGooglePlaces({
      ...options,
      pageSize: 5,
    });

    cache.set(key, result);
    return result;
  } catch (error) {
    console.error("[Google Places 검색 실패]", options.query, error.message);
    cache.set(key, []);
    return [];
  }
}

function getCategoryType(category = "") {
  const value = String(category);

  if (value.includes("음식") || value.includes("식당")) return "FOOD";
  if (value.includes("카페")) return "CAFE";
  if (
    value.includes("숙소") ||
    value.includes("숙박") ||
    value.includes("호텔")
  ) {
    return "STAY";
  }
  if (value.includes("관광") || value.includes("명소")) return "ATTRACTION";

  return "";
}

function getCategoryCode(categoryType) {
  if (categoryType === "FOOD") return CATEGORY_CODE_MAP.FOOD;
  if (categoryType === "CAFE") return CATEGORY_CODE_MAP.CAFE;
  if (categoryType === "STAY") return CATEGORY_CODE_MAP.STAY;
  if (categoryType === "ATTRACTION") return CATEGORY_CODE_MAP.ATTRACTION;
  return "";
}

function getGoogleIncludedType(categoryType) {
  if (categoryType === "FOOD") return "restaurant";
  if (categoryType === "CAFE") return "cafe";
  if (categoryType === "STAY") return "lodging";
  return "";
}

function getReplacementKeyword(categoryType) {
  if (categoryType === "FOOD") return "음식점";
  if (categoryType === "CAFE") return "카페";
  if (categoryType === "STAY") return "숙소";
  return "";
}

function getKakaoAddress(candidate) {
  return String(
    candidate.road_address_name || candidate.address_name || "",
  ).trim();
}

function hasValidCoords(item) {
  const lat = Number(item.lat ?? item.latitude);
  const lng = Number(item.lng ?? item.longitude);

  return Number.isFinite(lat) && Number.isFinite(lng);
}

function hasUsableKakaoPlace(candidate) {
  const lat = Number(candidate.y);
  const lng = Number(candidate.x);
  const address = getKakaoAddress(candidate);

  return (
    Number.isFinite(lat) && Number.isFinite(lng) && isDetailedAddress(address)
  );
}

function hasUsableGooglePlace(candidate) {
  const lat = Number(candidate.location?.latitude);
  const lng = Number(candidate.location?.longitude);
  const address = String(candidate.formattedAddress || "");

  return (
    Number.isFinite(lat) && Number.isFinite(lng) && isDetailedAddress(address)
  );
}

function isDetailedAddress(address = "") {
  const value = String(address).trim();
  if (!value) return false;

  const compact = normalizeText(value);

  const broadAddresses = [
    "제주시",
    "서귀포시",
    "제주특별자치도",
    "서울",
    "서울특별시",
    "부산",
    "부산광역시",
  ];

  if (broadAddresses.includes(compact)) {
    return false;
  }

  const hasNumber = /\d/.test(value);
  const hasAddressUnit = /(로|길|읍|면|동|리|가)/.test(value);

  return hasNumber && hasAddressUnit;
}

function isSameKakaoCategory(candidate, categoryCode) {
  if (!categoryCode) return true;

  if (candidate.category_group_code === categoryCode) return true;

  const categoryName = String(candidate.category_name || "");

  if (categoryCode === "FD6") return categoryName.includes("음식");
  if (categoryCode === "CE7") return categoryName.includes("카페");
  if (categoryCode === "AD5") {
    return (
      categoryName.includes("숙박") ||
      categoryName.includes("호텔") ||
      categoryName.includes("펜션") ||
      categoryName.includes("리조트") ||
      categoryName.includes("모텔")
    );
  }
  if (categoryCode === "AT4") {
    return categoryName.includes("여행") || categoryName.includes("관광");
  }

  return false;
}

function candidateInTripRegion(candidate, item, context) {
  const candidateText = normalizeText(
    [
      candidate.place_name,
      candidate.road_address_name,
      candidate.address_name,
      candidate.category_name,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const itemArea = normalizeText(item.area || "");

  const tokens = [
    itemArea,
    ...(Array.isArray(context.regionTokens) ? context.regionTokens : []),
  ].filter(Boolean);

  if (tokens.length === 0) return true;

  return tokens.some((token) => candidateText.includes(token));
}

function googleCandidateInTripRegion(candidate, context) {
  const candidateText = normalizeText(
    [
      candidate.displayName?.text,
      candidate.formattedAddress,
      candidate.primaryType,
      ...(Array.isArray(candidate.types) ? candidate.types : []),
    ]
      .filter(Boolean)
      .join(" "),
  );

  const tokens = Array.isArray(context.regionTokens)
    ? context.regionTokens.map(normalizeText).filter(Boolean)
    : [];

  if (tokens.length === 0) return true;

  return tokens.some((token) => candidateText.includes(token));
}

function inferTripRegionTokens(itinerary, payload = {}) {
  const textParts = [
    payload.keyword,
    payload.destination,
    itinerary.destinationTitle,
    itinerary.mapLabel,
  ];

  if (Array.isArray(itinerary.days)) {
    itinerary.days.forEach((day) => {
      textParts.push(day.title, day.theme);

      if (Array.isArray(day.items)) {
        day.items.forEach((item) => {
          textParts.push(item.area, item.placeName, item.address);
        });
      }
    });
  }

  const text = normalizeText(textParts.filter(Boolean).join(" "));
  const tokens = new Set();

  if (
    text.includes("제주") ||
    text.includes("우도") ||
    text.includes("성산") ||
    text.includes("섭지") ||
    text.includes("서귀포") ||
    text.includes("애월") ||
    text.includes("한림") ||
    text.includes("구좌")
  ) {
    tokens.add("제주");
  }

  if (text.includes("서울")) tokens.add("서울");
  if (text.includes("부산")) tokens.add("부산");
  if (text.includes("강릉")) tokens.add("강릉");
  if (text.includes("경주")) tokens.add("경주");
  if (text.includes("여수")) tokens.add("여수");
  if (text.includes("전주")) tokens.add("전주");
  if (text.includes("속초")) tokens.add("속초");

  return [...tokens];
}

function uniqueKakaoCandidates(candidates) {
  const map = new Map();

  candidates.forEach((candidate) => {
    if (!candidate) return;

    const key =
      candidate.id ||
      `${candidate.place_name}-${candidate.road_address_name || candidate.address_name}`;

    if (!map.has(key)) {
      map.set(key, candidate);
    }
  });

  return [...map.values()];
}

function uniqueGoogleCandidates(candidates) {
  const map = new Map();

  candidates.forEach((candidate) => {
    if (!candidate) return;

    const key =
      candidate.id ||
      `${candidate.displayName?.text || ""}-${candidate.formattedAddress || ""}`;

    if (!map.has(key)) {
      map.set(key, candidate);
    }
  });

  return [...map.values()];
}

function isSuspiciousClosedCandidate(candidate) {
  const text = normalizeText(
    [
      candidate.place_name,
      candidate.category_name,
      candidate.road_address_name,
      candidate.address_name,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const suspiciousWords = ["폐업", "영업종료", "휴업", "임시휴업", "이전"];

  return suspiciousWords.some((word) => text.includes(word));
}

function isGenericPlaceName(placeName = "") {
  const value = normalizeText(placeName);

  const genericWords = [
    "추천숙소",
    "숙소출발",
    "숙소복귀",
    "숙소체크인",
    "로컬다이닝",
    "현지맛집",
    "지역맛집",
    "감성카페",
    "지역카페",
    "추천카페",
    "호텔",
    "숙소",
    "맛집",
    "카페",
  ];

  return genericWords.some((word) => value.includes(word));
}

function isMoveItem(item) {
  return String(item.category || "").includes("이동");
}

function extractArea(kakaoPlace) {
  const address = getKakaoAddress(kakaoPlace);
  return address.split(" ").slice(0, 2).join(" ");
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\w가-힣]/g, "");
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        const value = await mapper(items[currentIndex], currentIndex);
        results[currentIndex] = {
          status: "fulfilled",
          value,
        };
      } catch (error) {
        results[currentIndex] = {
          status: "rejected",
          reason: error,
        };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );

  await Promise.all(workers);

  return results;
}

module.exports = {
  verifyItineraryPlaces,
};
