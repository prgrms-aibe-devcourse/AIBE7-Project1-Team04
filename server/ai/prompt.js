function buildItineraryPrompt(form) {
  const days = Number(form.days || 3);
  const nights =
    form.nights !== undefined && form.nights !== null
      ? Number(form.nights)
      : Math.max(0, days - 1);

  const destination = form.destination || "AI가 추천";
  const departure = form.departure || "미정";
  const budget = form.budget || "미정";
  const people = Number(form.people || 2);

  const previous = form.previousItinerary
    ? `\n[이전 일정]\n${JSON.stringify(form.previousItinerary).slice(0, 6000)}\n`
    : "";

  const refine = form.refineText
    ? `\n[사용자 추가 요청]\n${form.refineText}\n`
    : "";

  return `
너는 한국어로 여행 일정을 설계하는 전문 AI 여행 플래너다.
사용자가 입력한 키워드와 조건을 바탕으로 실제 사용자가 보기 좋은 맞춤 여행 일정을 만들어라.

[사용자 조건]
- 키워드: ${form.keyword}
- 출발지: ${form.departure}
- 추천 목적지: ${form.destination}
- 여행 기간: ${form.nights}박 ${form.days}일
- 예산: ${form.budget}
- 인원: ${form.people}명
- 추가 메모: ${form.notes || "없음"}
${previous}
${refine}

[작성 규칙]
1. 사용자가 제공한 장소 또는 이미지 분석 장소를 중심으로 이동 동선이 자연스러운 일정을 작성한다.
2. 좌표 정보가 있다면 해당 위치 주변의 관광지, 음식점, 카페, 숙소 이동을 자연스럽게 구성한다.
3. 장소 정보가 부족하면 목적지와 키워드를 바탕으로 현실적인 여행지를 보완 추천한다.
4. 각 일차는 4~6개 코스로 구성한다.
5. 각 코스에는 추천 이유를 한 문장으로 작성한다.
6. 숙소 이동, 식사 장소 추천, 여행의 시작 같은 섹션 제목을 자연스럽게 포함한다.
7. 결과는 반드시 JSON 객체만 반환한다. 마크다운, 설명, 코드블록을 붙이지 않는다.
8. 장소 좌표를 알고 있는 경우 lat, lng를 숫자로 포함한다. 정확하지 않은 좌표를 억지로 만들지 않는다.
9. 정확한 좌표를 알 수 없는 경우 lat, lng는 null로 둔다.

[반환 JSON 스키마]
{
  "destinationTitle": "도시 또는 여행 주제명",
  "headline": "예: 도쿄, 2박 3일 추천일정입니다.",
  "subTitle": "짧은 안내 문구",
  "keyword": "사용자 키워드",
  "nights": 2,
  "daysCount": 3,
  "summary": "전체 일정 요약 2~3문장",
  "mapLabel": "지도 영역에 표시할 장소 요약",
  "days": [
    {
      "day": 1,
      "title": "Day 1 제목",
      "theme": "이 날의 테마",
      "items": [
        {
          "order": 1,
          "sectionTitle": "여행의 시작",
          "placeName": "장소명",
          "category": "관광명소 | 음식점 | 카페 | 숙소 | 이동 | 체험",
          "area": "지역명",
          "lat": 33.458056,
          "lng": 126.9425,
          "reason": "추천 이유 한 문장",
          "duration": "예상 소요 시간",
          "budgetHint": "예상 비용",
          "imageHint": "장소 이미지에 어울리는 짧은 힌트"
        }
      ]
    }
  ],
  "tips": ["여행 팁 1", "여행 팁 2"],
  "estimatedBudget": "총 예상 예산"
}
`;
}

module.exports = { buildItineraryPrompt };
