const { searchKakaoPlaces } = require("./kakaoLocalClient");
const { searchGooglePlaces } = require("./googlePlacesClient");

const CATEGORY_CODE_MAP = {
  FOOD: "FD6",
  CAFE: "CE7",
  STAY: "AD5",
  ATTRACTION: "AT4",
};

const STRICT_CATEGORY_TYPES = ["FOOD", "CAFE", "STAY"];
const FOOD_CAFE_CATEGORY_TYPES = ["FOOD", "CAFE"];

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
      payload.destination ||
      nextItinerary.destinationTitle ||
      payload.keyword ||
      "",
    regionTokens: inferTrustedTripRegionTokens(nextItinerary, payload),
    cache: new Map(),
    usedFoodCafePlaceKeys: new Set(),
  };

  const targets = collectVerifyTargets(nextItinerary);

  const results = await mapWithConcurrency(targets, 1, async (target) => {
    const verifiedItem = await verifyPlaceItem(target.item, context, target);

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
        targets.push({ dayIndex, itemIndex, item, day, items });
        return;
      }

      // 관광명소는 좌표가 없는 경우만 보조 검증한다.
      if (categoryType === "ATTRACTION" && !hasValidCoords(item)) {
        targets.push({ dayIndex, itemIndex, item, day, items });
      }
    });
  });

  return targets;
}

async function verifyPlaceItem(item, context, target = {}) {
  const categoryType = getCategoryType(item.category);

  // 음식점/카페는 AI가 만든 장소명을 강하게 신뢰하지 않고 별도 검증한다.
  if (FOOD_CAFE_CATEGORY_TYPES.includes(categoryType)) {
    return verifyFoodCafeItem(item, context, categoryType, target);
  }

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

  // 3차: 숙소는 같은 지역의 실제 Kakao 장소로 대체
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

  return markPlaceAsNotFound(item);
}

async function verifyFoodCafeItem(item, context, categoryType, target = {}) {
  const exactPlace = await findKakaoFoodCafeExactPlace(
    item,
    context,
    categoryType,
    target,
  );

  if (exactPlace) {
    reserveFoodCafePlace(exactPlace, context);
    return mergeKakaoPlace(item, exactPlace, "verified");
  }

  const replacement = await findKakaoFoodCafeReplacement(
    item,
    context,
    categoryType,
    target,
  );

  if (replacement) {
    reserveFoodCafePlace(replacement, context);

    return mergeKakaoPlace(
      {
        ...item,
        originalPlaceName: item.placeName,
        reason: buildFoodCafeReplacementReason(item, context, categoryType),
        internalVerifyMessage:
          "AI가 제안한 식당/카페명을 확인하지 못해 같은 권역의 실제 카카오 장소로 보정했습니다.",
      },
      replacement,
      "replaced",
    );
  }

  return makeFoodCafePlaceholder(item, context, categoryType);
}

async function findKakaoFoodCafeExactPlace(
  item,
  context,
  categoryType,
  target = {},
) {
  const categoryCode = getCategoryCode(categoryType);

  const placeName = String(item.placeName || "").trim();
  const area = String(item.area || "").trim();
  const destination = String(context.destination || "").trim();

  if (!placeName || isGenericPlaceName(placeName)) {
    return null;
  }

  const queries = [
    [destination, area, placeName].filter(Boolean).join(" "),
    [destination, placeName].filter(Boolean).join(" "),
    [area, placeName].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .filter((query, index, array) => array.indexOf(query) === index);

  for (const query of queries) {
    const candidates = await cachedKakaoSearch(context.cache, {
      query,
      categoryGroupCode: categoryCode,
      size: 10,
    });

    const matched = pickStrictFoodCafeCandidate(
      item,
      candidates,
      categoryCode,
      context,
    );

    if (matched) return matched;
  }

  return null;
}

function pickStrictFoodCafeCandidate(
  item,
  candidates,
  categoryCode,
  context,
  target = {},
  categoryType = "",
) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const targetName = normalizeText(item.placeName);
  const routeContext = getFoodCafeRouteContext(target);
  const policy = getFoodCafeDistancePolicy(categoryType);

  const scored = candidates
    .filter((candidate) => isSameKakaoCategory(candidate, categoryCode))
    .filter((candidate) => foodCafeCandidateInTripRegion(candidate, context))
    .filter((candidate) => hasUsableKakaoPlace(candidate))
    .filter((candidate) => !isSuspiciousClosedCandidate(candidate))
    .filter((candidate) => !isUsedFoodCafePlace(candidate, context))
    .map((candidate) => {
      const candidateName = normalizeText(candidate.place_name);
      const metrics = getFoodCafeRouteMetrics(candidate, routeContext);

      if (
        routeContext.anchors.length > 0 &&
        !isFoodCafeRouteAcceptable(metrics, routeContext, policy)
      ) {
        return null;
      }

      let score = 0;

      if (candidateName === targetName) score += 100;
      else if (candidateName.includes(targetName)) score += 70;
      else if (
        targetName.includes(candidateName) &&
        candidateName.length >= 3
      ) {
        score += 50;
      }

      if (Number.isFinite(metrics.minDistance)) {
        score += Math.max(0, 40 - metrics.minDistance / 100);
      }

      if (Number.isFinite(metrics.detourDistance)) {
        score -= Math.max(0, metrics.detourDistance / 100);
      }

      return {
        candidate,
        score,
        minDistance: metrics.minDistance,
        detourDistance: metrics.detourDistance,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.detourDistance !== b.detourDistance) {
        return a.detourDistance - b.detourDistance;
      }
      return a.minDistance - b.minDistance;
    });

  const best = scored[0];

  if (!best || best.score < 70) {
    return null;
  }

  return best.candidate;
}

function foodCafeCandidateInTripRegion(candidate, context) {
  const candidateAddress = normalizeText(getKakaoAddress(candidate));

  const tokens = Array.isArray(context.regionTokens)
    ? context.regionTokens.map(normalizeText).filter(Boolean)
    : [];

  if (tokens.length === 0) {
    return false;
  }

  return tokens.some((token) => candidateAddress.includes(token));
}

function getFoodCafePlaceKey(candidate) {
  if (!candidate) return "";

  if (candidate.id) {
    return `kakao:${candidate.id}`;
  }

  return normalizeText(
    `${candidate.place_name || ""}-${getKakaoAddress(candidate)}`,
  );
}

function isUsedFoodCafePlace(candidate, context) {
  const key = getFoodCafePlaceKey(candidate);

  if (!key) return false;

  return context.usedFoodCafePlaceKeys?.has(key);
}

function reserveFoodCafePlace(candidate, context) {
  const key = getFoodCafePlaceKey(candidate);

  if (!key) return;

  if (!context.usedFoodCafePlaceKeys) {
    context.usedFoodCafePlaceKeys = new Set();
  }

  context.usedFoodCafePlaceKeys.add(key);
}

function getFoodCafeRouteContext(target = {}) {
  const items = Array.isArray(target.items) ? target.items : [];
  const itemIndex = Number(target.itemIndex);

  if (!items.length || !Number.isFinite(itemIndex)) {
    return {
      previous: null,
      next: null,
      anchors: [],
    };
  }

  const previous = findNearestRouteAnchor(items, itemIndex, -1);
  const next = findNearestRouteAnchor(items, itemIndex, 1);

  return {
    previous,
    next,
    anchors: [previous, next].filter(Boolean),
  };
}

function findNearestRouteAnchor(items, startIndex, direction) {
  let index = startIndex + direction;

  while (index >= 0 && index < items.length) {
    const neighbor = items[index];

    if (neighbor && !isMoveItem(neighbor)) {
      const categoryType = getCategoryType(neighbor.category);

      // 식당/카페는 기준점으로 삼지 않는다.
      if (!FOOD_CAFE_CATEGORY_TYPES.includes(categoryType)) {
        const coords = getItemCoords(neighbor);

        if (coords) {
          return {
            ...coords,
            placeName: neighbor.placeName || "",
            area: neighbor.area || "",
            order: neighbor.order || index + 1,
          };
        }
      }
    }

    index += direction;
  }

  return null;
}

function getItemCoords(item) {
  const lat = Number(item?.lat ?? item?.latitude);
  const lng = Number(item?.lng ?? item?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function getCandidateCoords(candidate) {
  const lat = Number(candidate?.y);
  const lng = Number(candidate?.x);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function getDistanceMeters(a, b) {
  if (!a || !b) return Infinity;

  const earthRadius = 6371000;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);

  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getFoodCafeDistancePolicy(categoryType) {
  if (categoryType === "CAFE") {
    return {
      searchRadius: 1800,
      maxSingleDistance: 1800,
      maxSegmentDistance: 2500,
      maxDetourDistance: 1500,
    };
  }

  if (categoryType === "FOOD") {
    return {
      searchRadius: 2500,
      maxSingleDistance: 2500,
      maxSegmentDistance: 3500,
      maxDetourDistance: 2500,
    };
  }

  return {
    searchRadius: 2500,
    maxSingleDistance: 2500,
    maxSegmentDistance: 3500,
    maxDetourDistance: 2500,
  };
}

function getFoodCafeRouteMetrics(candidate, routeContext) {
  const candidateCoords = getCandidateCoords(candidate);

  if (!candidateCoords) {
    return {
      isValid: false,
      minDistance: Infinity,
      detourDistance: Infinity,
      previousDistance: Infinity,
      nextDistance: Infinity,
    };
  }

  const previous = routeContext.previous;
  const next = routeContext.next;

  const previousDistance = previous
    ? getDistanceMeters(previous, candidateCoords)
    : Infinity;

  const nextDistance = next
    ? getDistanceMeters(candidateCoords, next)
    : Infinity;

  const minDistance = Math.min(previousDistance, nextDistance);

  if (previous && next) {
    const directDistance = getDistanceMeters(previous, next);
    const routeDistance = previousDistance + nextDistance;
    const detourDistance = routeDistance - directDistance;

    return {
      isValid: true,
      minDistance,
      previousDistance,
      nextDistance,
      directDistance,
      routeDistance,
      detourDistance,
    };
  }

  return {
    isValid: true,
    minDistance,
    previousDistance,
    nextDistance,
    directDistance: 0,
    routeDistance: minDistance,
    detourDistance: 0,
  };
}

function isFoodCafeRouteAcceptable(metrics, routeContext, policy) {
  if (!metrics.isValid) return false;

  const hasPrevious = Boolean(routeContext.previous);
  const hasNext = Boolean(routeContext.next);

  if (hasPrevious && hasNext) {
    if (metrics.previousDistance > policy.maxSegmentDistance) {
      return false;
    }

    if (metrics.nextDistance > policy.maxSegmentDistance) {
      return false;
    }

    if (metrics.detourDistance > policy.maxDetourDistance) {
      return false;
    }

    return true;
  }

  return metrics.minDistance <= policy.maxSingleDistance;
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function getMinDistanceFromAnchors(candidate, anchors) {
  const candidateCoords = getCandidateCoords(candidate);

  if (!candidateCoords || !Array.isArray(anchors) || anchors.length === 0) {
    return Infinity;
  }

  return Math.min(
    ...anchors.map((anchor) => getDistanceMeters(candidateCoords, anchor)),
  );
}

function getFoodCafeMaxDistanceMeters(categoryType) {
  if (categoryType === "CAFE") return 2500;
  if (categoryType === "FOOD") return 3500;
  return 3500;
}

async function findKakaoFoodCafeReplacement(
  item,
  context,
  categoryType,
  target = {},
) {
  const categoryCode = getCategoryCode(categoryType);
  const keyword = categoryType === "FOOD" ? "음식점" : "카페";

  const destination = String(context.destination || "").trim();
  const regionQuery = buildFoodCafeRegionQuery(item, context);
  const routeContext = getFoodCafeRouteContext(target);
  const policy = getFoodCafeDistancePolicy(categoryType);

  const allCandidates = [];

  // 1순위: 바로 앞/뒤 일정 좌표 주변에서만 검색
  for (const anchor of routeContext.anchors) {
    const candidates = await cachedKakaoSearch(context.cache, {
      query: keyword,
      categoryGroupCode: categoryCode,
      size: 15,
      x: anchor.lng,
      y: anchor.lat,
      radius: policy.searchRadius,
    });

    allCandidates.push(...candidates);
  }

  // 2순위: 앞뒤 좌표가 전혀 없을 때만 권역 검색
  if (allCandidates.length === 0 && routeContext.anchors.length === 0) {
    const queries = [
      [regionQuery, keyword].filter(Boolean).join(" "),
      [destination, keyword].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .filter((query, index, array) => array.indexOf(query) === index);

    for (const query of queries) {
      const candidates = await cachedKakaoSearch(context.cache, {
        query,
        categoryGroupCode: categoryCode,
        size: 15,
      });

      allCandidates.push(...candidates);
    }
  }

  return pickRouteAwareFoodCafeReplacementCandidate(
    item,
    uniqueKakaoCandidates(allCandidates),
    categoryCode,
    context,
    target,
    categoryType,
  );
}

function pickRouteAwareFoodCafeReplacementCandidate(
  item,
  candidates,
  categoryCode,
  context,
  target = {},
  categoryType = "",
) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const routeContext = getFoodCafeRouteContext(target);
  const policy = getFoodCafeDistancePolicy(categoryType);

  const scored = candidates
    .filter((candidate) => isSameKakaoCategory(candidate, categoryCode))
    .filter((candidate) => foodCafeCandidateInTripRegion(candidate, context))
    .filter((candidate) => hasUsableKakaoPlace(candidate))
    .filter((candidate) => !isSuspiciousClosedCandidate(candidate))
    .filter((candidate) => !isUsedFoodCafePlace(candidate, context))
    .map((candidate) => {
      const metrics = getFoodCafeRouteMetrics(candidate, routeContext);

      if (
        routeContext.anchors.length > 0 &&
        !isFoodCafeRouteAcceptable(metrics, routeContext, policy)
      ) {
        return null;
      }

      let score = 100;

      if (Number.isFinite(metrics.minDistance)) {
        score += Math.max(0, 60 - metrics.minDistance / 100);
      }

      if (Number.isFinite(metrics.detourDistance)) {
        score -= Math.max(0, metrics.detourDistance / 80);
      }

      if (candidate.road_address_name) score += 10;
      if (candidate.place_url) score += 5;

      return {
        candidate,
        score,
        minDistance: metrics.minDistance,
        detourDistance: metrics.detourDistance,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.detourDistance !== b.detourDistance) {
        return a.detourDistance - b.detourDistance;
      }
      return a.minDistance - b.minDistance;
    });

  return scored[0]?.candidate || null;
}

function buildFoodCafeRegionQuery(item, context) {
  const tokens = Array.isArray(context.regionTokens)
    ? context.regionTokens.filter(Boolean)
    : [];

  if (tokens.length > 0) {
    return tokens.join(" ");
  }

  return String(context.destination || item.area || "").trim();
}

function makeFoodCafePlaceholder(item, context, categoryType) {
  const areaLabel =
    getReadableRegionLabel(context) ||
    item.area ||
    context.destination ||
    "여행 지역";

  const isCafe = categoryType === "CAFE";
  const sectionTitle = isCafe ? "카페" : item.sectionTitle || "식사";
  const placeName = isCafe
    ? `${areaLabel} 카페 휴식`
    : `${areaLabel} 식사 권역`;

  return {
    ...item,
    placeName,
    sectionTitle,
    area: areaLabel,
    lat: null,
    lng: null,
    latitude: null,
    longitude: null,
    address: "",
    isVerified: false,
    coordSource: "",
    verifyStatus: "regional_placeholder",
    reason: isCafe
      ? `${areaLabel} 권역 안에서 이동 동선에 맞는 실제 카페를 선택해 쉬어가는 일정입니다.`
      : `${areaLabel} 권역 안에서 이동 동선을 크게 벗어나지 않는 식당을 선택해 식사하는 일정입니다.`,
    internalVerifyMessage:
      "검증 가능한 실제 식당/카페를 찾지 못해 가짜 장소명 대신 권역 기반 일정으로 표시했습니다.",
  };
}

function buildFoodCafeReplacementReason(item, context, categoryType) {
  const areaLabel =
    getReadableRegionLabel(context) ||
    item.area ||
    context.destination ||
    "해당 지역";

  if (categoryType === "CAFE") {
    return `${areaLabel} 권역 안에서 동선을 크게 벗어나지 않고 쉬어가기 좋은 실제 카페로 보정했습니다.`;
  }

  const sectionTitle = String(item.sectionTitle || "");

  if (sectionTitle.includes("저녁")) {
    return `${areaLabel} 권역 안에서 하루 일정을 마무리하기 좋은 실제 식사 장소로 보정했습니다.`;
  }

  return `${areaLabel} 권역 안에서 오전 일정 후 점심을 먹기 좋은 실제 식사 장소로 보정했습니다.`;
}

function getReadableRegionLabel(context) {
  const tokens = Array.isArray(context.regionTokens)
    ? context.regionTokens.filter(Boolean)
    : [];

  if (tokens.length === 0) return "";

  return tokens[0];
}

async function findKakaoPlace(item, context) {
  const categoryType = getCategoryType(item.category);
  const categoryCode = getCategoryCode(categoryType);

  const placeName = String(item.placeName || "").trim();
  const area = String(item.area || "").trim();
  const destination = String(context.destination || "").trim();

  const queries = [
    [destination, area, placeName].filter(Boolean).join(" "),
    [destination, placeName].filter(Boolean).join(" "),
    [area, placeName].filter(Boolean).join(" "),
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
    .filter((candidate) =>
      googleCandidateInTripRegion(candidate, item, context),
    )
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

  const trustedRegionText = Array.isArray(context.regionTokens)
    ? context.regionTokens.join(" ")
    : "";

  const queries = [
    [destination, trustedRegionText, keyword].filter(Boolean).join(" "),
    [trustedRegionText, keyword].filter(Boolean).join(" "),
    [destination, keyword].filter(Boolean).join(" "),
    [destination, area, keyword].filter(Boolean).join(" "),
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
    area: extractArea(kakaoPlace) || item.area,

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
    area: extractAreaFromAddress(googlePlace.formattedAddress) || item.area,

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

function extractAreaFromAddress(address = "") {
  return String(address || "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
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

  const trustedTokens = Array.isArray(context.regionTokens)
    ? context.regionTokens.map(normalizeText).filter(Boolean)
    : [];

  const itemArea = normalizeText(item.area || "");

  // 1순위: 신뢰 가능한 여행 권역이 있으면 반드시 그 권역에 포함되어야 한다.
  if (trustedTokens.length > 0) {
    return trustedTokens.some((token) => candidateText.includes(token));
  }

  // 2순위: 신뢰 가능한 권역을 못 찾은 경우에만 item.area를 보조로 사용한다.
  if (itemArea) {
    return candidateText.includes(itemArea);
  }

  // 권역 정보가 전혀 없으면 검증 통과시키지 않는다.
  return false;
}

function googleCandidateInTripRegion(candidate, item, context) {
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

  const trustedTokens = Array.isArray(context.regionTokens)
    ? context.regionTokens.map(normalizeText).filter(Boolean)
    : [];

  const itemArea = normalizeText(item.area || "");

  if (trustedTokens.length > 0) {
    return trustedTokens.some((token) => candidateText.includes(token));
  }

  if (itemArea) {
    return candidateText.includes(itemArea);
  }

  return false;
}

function inferTrustedTripRegionTokens(itinerary, payload = {}) {
  const trustedText = normalizeText(
    [
      payload.destination,
      payload.keyword,
      itinerary.destinationTitle,
      itinerary.mapLabel,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const tokens = new Set();

  const regionRules = [
    {
      keys: ["수암봉", "안산", "상록수", "상록구"],
      tokens: ["안산", "경기"],
    },
    {
      keys: [
        "제주",
        "우도",
        "성산",
        "섭지",
        "서귀포",
        "애월",
        "한림",
        "구좌",
        "표선",
      ],
      tokens: ["제주"],
    },
    {
      keys: ["서울", "강남", "홍대", "성수", "종로", "명동", "잠실"],
      tokens: ["서울"],
    },
    {
      keys: ["부산", "해운대", "광안리", "서면", "기장"],
      tokens: ["부산"],
    },
    {
      keys: ["강릉", "주문진", "안목"],
      tokens: ["강릉", "강원"],
    },
    {
      keys: ["속초", "설악"],
      tokens: ["속초", "강원"],
    },
    {
      keys: ["경주", "황리단길", "보문"],
      tokens: ["경주", "경북"],
    },
    {
      keys: ["여수", "돌산", "오동도"],
      tokens: ["여수", "전남"],
    },
    {
      keys: ["전주", "한옥마을"],
      tokens: ["전주", "전북"],
    },
    {
      keys: ["대구", "동성로", "수성못"],
      tokens: ["대구"],
    },
    {
      keys: ["울산", "태화강", "간절곶"],
      tokens: ["울산"],
    },
    {
      keys: ["인천", "송도", "월미도", "차이나타운"],
      tokens: ["인천"],
    },
    {
      keys: ["대전", "유성", "성심당"],
      tokens: ["대전"],
    },
    {
      keys: ["광주", "충장로", "무등산"],
      tokens: ["광주"],
    },
  ];

  regionRules.forEach((rule) => {
    const matched = rule.keys.some((key) =>
      trustedText.includes(normalizeText(key)),
    );

    if (matched) {
      rule.tokens.forEach((token) => tokens.add(normalizeText(token)));
    }
  });

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
