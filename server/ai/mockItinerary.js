function createMockItinerary(form) {
  const days = Number(form.days || 3);
  const nights =
    form.nights !== undefined && form.nights !== null
      ? Number(form.nights)
      : Math.max(0, days - 1);

  const people = Number(form.people || 2);
  const budget = form.budget || "입력 예산 기준으로 조정 필요";
  const keyword = form.keyword || "여행";
  const style = form.style || "키워드가 여정에 포함된 여행";
  const departure = form.departure || "출발지";

  const destination =
    !form.destination || form.destination === "AI가 키워드에 맞춰 추천"
      ? recommendDestination(keyword)
      : form.destination;

  return {
    destinationTitle: destination,
    headline: `${destination}, ${nights}박 ${days}일 추천일정입니다.`,
    subTitle: "AI가 알려준 맞춤일정으로 여행을 떠나보세요.",
    keyword,
    nights,
    daysCount: days,
    summary: `${keyword} 장소 정보를 중심으로 ${people}명이 즐기기 좋은 맞춤 여행 일정입니다. 이동 부담을 줄이고, 식사와 휴식이 자연스럽게 이어지도록 구성했습니다.`,
    mapLabel: `${destination} 주요 코스 ${days}일`,
    days: Array.from({ length: days }, (_, index) =>
      makeDay(index + 1, destination, {
        ...form,
        days,
        nights,
        people,
        budget,
        keyword,
        style,
        departure,
      }),
    ),
    tips: [
      "인기 장소는 오전 시간대 방문을 추천합니다.",
      "식사 장소는 현장 대기 시간을 고려해 후보를 1곳 더 준비해 두면 좋습니다.",
      "테마 여행일수록 사진 스팟과 휴식 시간을 함께 배치하는 것이 만족도가 높습니다.",
    ],
    estimatedBudget: budget,
  };
}

function recommendDestination(keyword) {
  const lower = String(keyword || "").toLowerCase();

  if (keyword.includes("에펠")) return "파리";
  if (keyword.includes("자유의 여신상")) return "뉴욕";
  if (keyword.includes("포켓몬")) return "도쿄";
  if (keyword.includes("해변") || keyword.includes("노을")) return "제주";
  if (lower.includes("anime") || keyword.includes("애니")) return "도쿄";

  return "추천 여행지";
}

function makeDay(day, destination, form) {
  const dayThemes = [
    "도착과 첫 만남",
    "테마 깊게 즐기기",
    "여유로운 마무리",
    "근교 확장 코스",
  ];

  const theme = dayThemes[(day - 1) % dayThemes.length];
  const isLastDay = day === form.days;

  return {
    day,
    title: `Day ${day} · ${theme}`,
    theme,
    items: [
      {
        order: 1,
        sectionTitle: day === 1 ? "여행의 시작" : "하루의 시작",
        placeName:
          day === 1 ? `${form.departure} 출발` : `${destination} 로컬 브런치`,
        category: day === 1 ? "이동" : "음식점",
        area: destination,
        reason:
          day === 1
            ? "출발지에서 여행지까지 무리 없이 이동하는 일정입니다."
            : "본격적인 일정 전 가볍게 에너지를 채우기 좋습니다.",
        duration: "1~2시간",
        budgetHint: "상황에 따라 변동",
        imageHint: "여행 출발 풍경",
      },
      {
        order: 2,
        sectionTitle: `${form.keyword} 핵심 코스`,
        placeName: `${destination} ${form.keyword} 스팟`,
        category: "관광명소",
        area: destination,
        reason:
          "분석된 장소 정보를 중심으로 여행 분위기를 자연스럽게 느낄 수 있는 코스입니다.",
        duration: "2시간",
        budgetHint: "입장료 확인 필요",
        imageHint: `${form.keyword} 대표 풍경`,
      },
      {
        order: 3,
        sectionTitle: "식사 장소 추천",
        placeName: `${destination} 로컬 다이닝`,
        category: "음식점",
        area: destination,
        reason: "이동 동선 중간에 있어 쉬어가기 좋은 식사 장소입니다.",
        duration: "1시간",
        budgetHint: form.budget,
        imageHint: "현지 음식",
      },
      {
        order: 4,
        sectionTitle: "테마 체험",
        placeName: `${form.keyword} 감성 산책 코스`,
        category: "체험",
        area: destination,
        reason:
          "분석된 장소 정보를 중심으로 여행 분위기를 자연스럽게 느낄 수 있는 코스입니다.",
        duration: "1~2시간",
        budgetHint: "무료~중간",
        imageHint: "감성 산책길",
      },
      {
        order: 5,
        sectionTitle: isLastDay ? "여행 마무리" : "숙소로 이동",
        placeName: isLastDay
          ? `${destination} 기념품 거리`
          : `${destination} 추천 숙소`,
        category: isLastDay ? "관광명소" : "숙소",
        area: destination,
        reason: isLastDay
          ? "여행의 마지막 추억을 남기기 좋은 장소입니다."
          : "다음 날 이동을 고려해 접근성이 좋은 숙소를 추천합니다.",
        duration: "1시간",
        budgetHint: "예산에 맞춰 선택",
        imageHint: "숙소 또는 기념품 거리",
      },
    ],
  };
}

module.exports = {
  createMockItinerary,
};
