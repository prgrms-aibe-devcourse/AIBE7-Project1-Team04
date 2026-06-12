import {
  loadItinerary,
  loadPayload,
  saveItinerary,
  savePayload,
} from "./itinerary-state.js";

const CREATE_PAGE_URL = "./itinerary-create.html";
const LOADING_PAGE_URL = "./itinerary-loading.html";

const DOT_COLORS = ["#8e5cff", "#ff5c68", "#22c7b8", "#2f86ff"];

const resultContainer = document.querySelector("#resultContainer");
const retryButton = document.querySelector("#retryButton");
const saveButton = document.querySelector("#saveButton");

const payload = loadPayload();
const loadedItinerary = loadItinerary();

const resultState = {
  originalItinerary: loadedItinerary ? cloneItinerary(loadedItinerary) : null,
  editableItinerary: loadedItinerary
    ? normalizeItineraryForEditing(cloneItinerary(loadedItinerary))
    : null,
  selectedDay: loadedItinerary ? getFirstDayNumber(loadedItinerary) : 1,
  screen: null,
};

let activeEditModalEscapeHandler = null;

initResultPage();

function initResultPage() {
  if (!resultContainer) {
    console.error("#resultContainer 요소를 찾을 수 없습니다.");
    return;
  }

  if (!payload?.keyword) {
    renderEmptyState(
      "저장된 여행 조건이 없어요.",
      "조건 입력 페이지에서 키워드와 조건을 먼저 입력해 주세요.",
      CREATE_PAGE_URL,
      "조건 입력하기",
    );
    bindCommonEvents();
    return;
  }

  if (!resultState.editableItinerary) {
    renderEmptyState(
      "생성된 여행 일정이 없어요.",
      "AI 생성 페이지로 이동해 일정을 먼저 만들어 주세요.",
      LOADING_PAGE_URL,
      "일정 생성하기",
    );
    bindCommonEvents();
    return;
  }

  renderItinerary({
    container: resultContainer,
    itinerary: resultState.editableItinerary,
    onRegenerate: (refineText, previousItinerary) => {
      const nextPayload = {
        ...payload,
        refineText,
        previousItinerary,
      };

      savePayload(nextPayload);
      window.location.href = LOADING_PAGE_URL;
    },
  });

  bindCommonEvents();
}

function bindCommonEvents() {
  retryButton?.addEventListener("click", (event) => {
    if (!payload?.keyword) {
      event.preventDefault();
      showToast("먼저 여행 조건을 입력해 주세요.");
    }

    sessionStorage.setItem("itineraryEntryMode", "clearNotesOnly");
  });

  saveButton?.addEventListener("click", handleSaveToAccount);
}

async function handleSaveToAccount() {
  const session = JSON.parse(localStorage.getItem("session") || "null");
  if (!session?.access_token) {
    showToast("로그인이 필요합니다. 로그인 페이지로 이동합니다.");
    setTimeout(() => {
      window.location.href = "/pages/login.html";
    }, 1500);
    return;
  }

  const currentItinerary = resultState.editableItinerary;

  if (!currentItinerary) {
    showToast("저장할 일정이 없습니다.");
    return;
  }

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "저장 중...";
  }

  try {
    const response = await fetch("/api/trips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        title:
          currentItinerary.headline || `${payload?.keyword || "여행"} 일정`,
        payload: payload || {},
        itinerary: currentItinerary,
      }),
    });

    if (response.ok) {
      showToast("일정이 저장되었습니다! 내 여행 목록에서 확인하세요.");
      if (saveButton) {
        saveButton.textContent = "저장됨 ✓";
      }
    } else {
      const data = await response.json().catch(() => ({}));
      showToast(data.message || "저장에 실패했습니다.");
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "내 계정에 저장";
      }
    }
  } catch (_err) {
    showToast("저장 중 오류가 발생했습니다.");
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "내 계정에 저장";
    }
  }
}

function renderItinerary({ container, itinerary, onRegenerate }) {
  container.innerHTML = "";

  resultState.editableItinerary = normalizeItineraryForEditing(itinerary);
  resultState.selectedDay = ensureValidSelectedDay(
    resultState.editableItinerary,
    resultState.selectedDay,
  );

  const screen = document.createElement("article");
  screen.className = "result-screen result-screen--split";

  screen.append(
    createResultHero(resultState.editableItinerary),
    createResultSplitLayout(resultState.editableItinerary),
  );

  container.append(screen);
  resultState.screen = screen;

  bindDayTabs(screen);
  refreshSelectedDayView({
    updateMap: false,
    scrollTimeline: false,
  });

  try {
    initKakaoMap(resultState.editableItinerary, screen);
  } catch (error) {
    console.error("[지도 초기화 실패]", error);
    showToast("지도 연결 중 문제가 발생했지만 일정은 정상 표시됩니다.");
  }
}

function createResultHero(itinerary) {
  const hero = document.createElement("div");
  hero.className = "result-hero";

  const headline =
    itinerary.headline ||
    `${itinerary.destinationTitle || "여행지"}, 추천일정입니다.`;

  const highlighted = formatResultHeadline(headline);

  hero.innerHTML = `
  <h2>${highlighted}</h2>
  <p>${escapeHtml(
    itinerary.subTitle || "AI가 알려준 맞춤일정으로 여행을 떠나보세요.",
  )}</p>
`;

  if (itinerary.notice) {
    const notice = document.createElement("div");
    notice.className = "notice-box";
    notice.textContent = itinerary.notice;
    hero.append(notice);
  }

  if (itinerary.summary) {
    const summary = document.createElement("p");
    summary.textContent = itinerary.summary;
    hero.append(summary);
  }

  return hero;
}

function createResultSplitLayout(itinerary) {
  const layout = document.createElement("div");
  layout.className = "result-split-layout";

  const leftPanel = document.createElement("aside");
  leftPanel.className = "result-left-panel";

  leftPanel.append(
    createPanelLabel("Map"),
    createKakaoMapSection(itinerary),
    createDayTabs(itinerary),
    createDaySummary(itinerary),
    createTipsBox(itinerary),
  );

  const timelinePanel = document.createElement("section");
  timelinePanel.className = "result-timeline-panel";
  timelinePanel.setAttribute("aria-label", "Day별 상세 여행 일정");

  // 타임라인은 selectedDay 기준으로 refreshSelectedDayView()에서 렌더링합니다.

  layout.append(leftPanel, timelinePanel);

  return layout;
}

function createPanelLabel(text) {
  const label = document.createElement("p");
  label.className = "result-panel-label";
  label.textContent = text;
  return label;
}

function createDaySummary(itinerary) {
  const wrapper = document.createElement("div");
  wrapper.className = "day-summary";

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];

  days.forEach((day, index) => {
    const dayNumber = day.day || index + 1;

    const panel = document.createElement("section");
    panel.className = "day-summary-panel";
    panel.dataset.daySummary = String(dayNumber);
    panel.hidden = index !== 0;

    panel.innerHTML = `
      <h3>${escapeHtml(day.title || `Day ${dayNumber}`)}</h3>
      <p>${escapeHtml(day.theme || "")}</p>
    `;

    wrapper.append(panel);
  });

  return wrapper;
}

function createMapStrip(itinerary) {
  const map = document.createElement("div");
  map.className = "map-strip";
  map.setAttribute("aria-label", "추천 코스 지도 요약");

  const firstDayItems = itinerary.days?.[0]?.items || [];
  const markerCount = Math.min(4, firstDayItems.length || 4);

  for (let i = 0; i < markerCount; i += 1) {
    const marker = document.createElement("span");
    marker.className = "map-marker";
    marker.textContent = String(i + 1);
    marker.style.background = DOT_COLORS[i % DOT_COLORS.length];
    map.append(marker);
  }

  const label = document.createElement("span");
  label.className = "map-label";
  label.textContent =
    itinerary.mapLabel || `${itinerary.destinationTitle || "여행지"} 주요 코스`;

  map.append(label);

  return map;
}

const kakaoMapState = {
  map: null,
  itinerary: null,
  screen: null,
  overlays: [],
  polyline: null,
};

function createKakaoMapSection(itinerary) {
  const section = document.createElement("section");
  section.className = "kakao-map-section";

  section.innerHTML = `
    <div class="kakao-map-header">
      <div>
        <h3>추천 동선 지도</h3>
        <p>일정 카드와 지도 마커를 함께 확인해보세요.</p>
      </div>
      <span class="kakao-map-label">
        ${escapeHtml(itinerary.mapLabel || "추천 코스")}
      </span>
    </div>
    <div id="itineraryKakaoMap" class="itinerary-kakao-map" aria-label="추천 일정 지도"></div>
  `;

  return section;
}

function initKakaoMap(itinerary, screen) {
  const mapContainer = screen.querySelector("#itineraryKakaoMap");
  if (!mapContainer) return;

  if (!window.kakao?.maps) {
    mapContainer.innerHTML = `
      <div class="map-error">
        카카오맵 SDK를 불러오지 못했습니다. API 키와 script 경로를 확인해 주세요.
      </div>
    `;
    return;
  }

  window.kakao.maps.load(() => {
    renderKakaoMap(itinerary, mapContainer, screen);
  });
}

function renderKakaoMap(itinerary, mapContainer, screen) {
  const firstDay = ensureValidSelectedDay(itinerary, resultState.selectedDay);
  resultState.selectedDay = firstDay;

  const firstDayPoints = getMapPointsByDay(itinerary, firstDay);
  const centerPoint = firstDayPoints[0] || getFallbackCenter(itinerary);

  const center = new kakao.maps.LatLng(centerPoint.lat, centerPoint.lng);

  const map = new kakao.maps.Map(mapContainer, {
    center,
    level: firstDayPoints.length > 1 ? 7 : 5,
  });

  kakaoMapState.map = map;
  kakaoMapState.itinerary = itinerary;
  kakaoMapState.screen = screen;

  updateKakaoMapByDay(firstDay);
}

function createNumberMarkerElement(point) {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "map-number-marker";
  marker.dataset.day = String(point.day);
  marker.dataset.order = String(point.order);
  marker.title = `${point.order}. ${point.placeName}`;

  marker.innerHTML = `
    <span class="map-number-marker__pin">
      <span class="map-number-marker__number">${escapeHtml(point.order)}</span>
    </span>
  `;

  return marker;
}

function createMapInfoElement(point) {
  const info = document.createElement("div");
  info.className = "map-info-card";

  const meta = [point.category, point.area].filter(Boolean).join(" · ");
  const addressHtml = point.address
    ? `<p class="map-info-card__address">${escapeHtml(point.address)}</p>`
    : "";

  info.innerHTML = `
    <button class="map-info-card__close" type="button" aria-label="지도 정보 닫기">
      ×
    </button>
    <strong class="map-info-card__title">
      ${escapeHtml(point.placeName)}
    </strong>
    <p class="map-info-card__meta">
      ${escapeHtml(meta || "추천 장소")}
    </p>
    ${addressHtml}
    <p class="map-info-card__reason">
      ${escapeHtml(point.reason || "일정에 포함된 추천 장소입니다.")}
    </p>
  `;

  return info;
}

function updateKakaoMapByDay(dayNumber) {
  if (!kakaoMapState.map || !kakaoMapState.itinerary) return;

  clearKakaoMap();

  const map = kakaoMapState.map;
  const screen = kakaoMapState.screen;
  const points = getMapPointsByDay(kakaoMapState.itinerary, dayNumber);

  if (points.length === 0) {
    return;
  }

  const bounds = new kakao.maps.LatLngBounds();
  const path = [];

  points.forEach((point) => {
    const position = new kakao.maps.LatLng(point.lat, point.lng);

    bounds.extend(position);
    path.push(position);

    const markerElement = createNumberMarkerElement(point);
    const infoElement = createMapInfoElement(point);

    const markerOverlay = new kakao.maps.CustomOverlay({
      position,
      content: markerElement,
      xAnchor: 0.5,
      yAnchor: 1,
      zIndex: 5,
    });

    const infoOverlay = new kakao.maps.CustomOverlay({
      position,
      content: infoElement,
      xAnchor: 0.5,
      yAnchor: 1.65,
      zIndex: 20,
    });

    markerOverlay.setMap(map);

    markerElement.addEventListener("click", () => {
      closeAllMapInfoCards();

      map.panTo(position);
      infoOverlay.setMap(map);
      setActiveMapMarker(markerElement);
      focusTimelineItem(screen, point);
    });

    infoElement
      .querySelector(".map-info-card__close")
      ?.addEventListener("click", (event) => {
        event.stopPropagation();
        infoOverlay.setMap(null);
        markerElement.classList.remove("is-active");
      });

    kakaoMapState.overlays.push({
      overlay: markerOverlay,
      infoOverlay,
      point,
      element: markerElement,
      position,
    });
  });

  if (path.length >= 2) {
    kakaoMapState.polyline = new kakao.maps.Polyline({
      map,
      path,
      strokeWeight: 4,
      strokeColor: "#2f86ff",
      strokeOpacity: 0.85,
      strokeStyle: "solid",
    });
  }

  if (points.length >= 2) {
    map.setBounds(bounds);
  } else {
    map.setCenter(path[0]);
    map.setLevel(5);
  }
}

function closeAllMapInfoCards() {
  kakaoMapState.overlays.forEach(({ infoOverlay, element }) => {
    infoOverlay?.setMap(null);
    element?.classList.remove("is-active");
  });
}

function clearKakaoMap() {
  kakaoMapState.overlays.forEach(({ overlay, infoOverlay }) => {
    overlay?.setMap(null);
    infoOverlay?.setMap(null);
  });

  kakaoMapState.overlays = [];

  if (kakaoMapState.polyline) {
    kakaoMapState.polyline.setMap(null);
    kakaoMapState.polyline = null;
  }
}

function getMapPointsByDay(itinerary, dayNumber) {
  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  const selectedDay = days.find((day) => Number(day.day) === Number(dayNumber));

  if (!selectedDay) return [];

  const items = Array.isArray(selectedDay.items) ? selectedDay.items : [];

  return items
    .map((item, index) => {
      const lat = Number(item.lat ?? item.latitude);
      const lng = Number(item.lng ?? item.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      return {
        day: Number(selectedDay.day),
        order: Number(item.order || index + 1),
        placeName: item.placeName || "추천 장소",
        category: item.category || "",
        area: item.area || "",
        address: item.address || "",
        reason: item.reason || "",
        lat,
        lng,
      };
    })
    .filter(Boolean);
}

function getFallbackCenter(itinerary) {
  const lat = Number(
    itinerary.lat ??
      itinerary.latitude ??
      itinerary.centerLat ??
      itinerary.mapCenter?.lat,
  );

  const lng = Number(
    itinerary.lng ??
      itinerary.longitude ??
      itinerary.centerLng ??
      itinerary.mapCenter?.lng,
  );

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  // 기본값: 제주 시청 근처
  return {
    lat: 33.4996213,
    lng: 126.5311884,
  };
}

function bindTimelineMapLinks(screen) {
  const items = screen.querySelectorAll(".timeline-item");

  items.forEach((item) => {
    item.addEventListener("click", (event) => {
      const editButton = event.target.closest(".edit-itinerary-item-button");
      const addButton = event.target.closest(".add-itinerary-item-button");
      const deleteButton = event.target.closest(
        ".delete-itinerary-item-button",
      );

      if (editButton) {
        event.stopPropagation();
        handleOpenEditItineraryItem(item);
        return;
      }

      if (addButton) {
        event.stopPropagation();
        handleOpenAddItineraryItem(item);
        return;
      }

      if (deleteButton) {
        event.stopPropagation();
        handleDeleteItineraryItem(item);
        return;
      }

      const isCard = event.target.closest(".place-card");

      if (!isCard) return;

      focusMapPointByTimelineItem(item);
    });
  });
}

function focusMapPointByTimelineItem(item) {
  const day = Number(item.dataset.day);
  const order = Number(item.dataset.order);

  const matched = kakaoMapState.overlays.find(
    (entry) => entry.point.day === day && entry.point.order === order,
  );

  if (!matched || !kakaoMapState.map) {
    showToast("이 장소의 지도 좌표가 없습니다.");
    return;
  }

  closeAllMapInfoCards();

  kakaoMapState.map.panTo(matched.position);
  matched.infoOverlay?.setMap(kakaoMapState.map);
  setActiveMapMarker(matched.element);
  focusTimelineItem(resultState.screen, matched.point);
}

function handleDeleteItineraryItem(timelineItem) {
  if (!timelineItem || !resultState.editableItinerary) return;

  const dayNumber = Number(timelineItem.dataset.day);
  const itemId = timelineItem.dataset.itemId;

  const target =
    findItineraryItemById(itemId) ||
    findItineraryItemByDayAndOrder(
      dayNumber,
      Number(timelineItem.dataset.order),
    );

  if (!target?.item) {
    showToast("삭제할 일정을 찾지 못했습니다.");
    return;
  }

  const placeName = target.item.placeName || "선택한 일정";
  const confirmed = window.confirm(`"${placeName}" 일정을 삭제할까요?`);

  if (!confirmed) return;

  updateEditableItinerary(
    (itinerary) => {
      const day = findDayByNumber(itinerary, dayNumber);
      if (!day || !Array.isArray(day.items)) return;

      day.items = day.items.filter(
        (item) => String(item.id) !== String(target.item.id),
      );
    },
    {
      updateMap: true,
      scrollTimeline: false,
    },
  );

  showToast("일정이 삭제되었습니다.");
}

function handleOpenEditItineraryItem(timelineItem) {
  const itemId = timelineItem.dataset.itemId;
  const dayNumber = Number(timelineItem.dataset.day);
  const order = Number(timelineItem.dataset.order);

  const target =
    findItineraryItemById(itemId) ||
    findItineraryItemByDayAndOrder(dayNumber, order);

  if (!target?.item) {
    showToast("수정할 일정을 찾지 못했습니다.");
    return;
  }

  openEditItineraryModal(target);
}

function handleOpenAddItineraryItem(timelineItem) {
  const itemId = timelineItem.dataset.itemId;
  const dayNumber = Number(timelineItem.dataset.day);
  const order = Number(timelineItem.dataset.order);

  const target =
    findItineraryItemById(itemId) ||
    findItineraryItemByDayAndOrder(dayNumber, order);

  if (!target?.item) {
    showToast("새 일정을 추가할 기준 일정을 찾지 못했습니다.");
    return;
  }

  openAddItineraryModal(target);
}

function findItineraryItemById(itemId) {
  if (!itemId || !resultState.editableItinerary) return null;

  const days = Array.isArray(resultState.editableItinerary.days)
    ? resultState.editableItinerary.days
    : [];

  for (const day of days) {
    const items = Array.isArray(day.items) ? day.items : [];
    const itemIndex = items.findIndex(
      (item) => String(item.id) === String(itemId),
    );

    if (itemIndex !== -1) {
      return {
        day,
        item: items[itemIndex],
        itemIndex,
      };
    }
  }

  return null;
}

function findItineraryItemByDayAndOrder(dayNumber, order) {
  if (!resultState.editableItinerary) return null;

  const days = Array.isArray(resultState.editableItinerary.days)
    ? resultState.editableItinerary.days
    : [];

  const day = days.find((dayItem) => Number(dayItem.day) === Number(dayNumber));

  if (!day) return null;

  const items = Array.isArray(day.items) ? day.items : [];
  const itemIndex = items.findIndex(
    (item, index) => Number(item.order || index + 1) === Number(order),
  );

  if (itemIndex === -1) return null;

  return {
    day,
    item: items[itemIndex],
    itemIndex,
  };
}

function findItineraryItemInItinerary(itinerary, itemId, dayNumber, order) {
  const days = getItineraryDays(itinerary);

  if (itemId) {
    for (const day of days) {
      const items = Array.isArray(day.items) ? day.items : [];
      const itemIndex = items.findIndex(
        (item) => String(item.id) === String(itemId),
      );

      if (itemIndex !== -1) {
        return {
          day,
          item: items[itemIndex],
          itemIndex,
        };
      }
    }
  }

  const day = findDayByNumber(itinerary, dayNumber);

  if (!day || !Array.isArray(day.items)) return null;

  const itemIndex = day.items.findIndex(
    (item, index) => Number(item.order || index + 1) === Number(order),
  );

  if (itemIndex === -1) return null;

  return {
    day,
    item: day.items[itemIndex],
    itemIndex,
  };
}

function getTrimmedFormValue(formData, name) {
  return String(formData.get(name) || "").trim();
}

function parseOptionalNumber(value) {
  const text = String(value ?? "").trim();

  if (!text) return null;

  const number = Number(text);

  return Number.isFinite(number) ? number : null;
}

function createUserAddedItineraryItem({
  dayNumber,
  insertAfterIndex,
  placeName,
  address,
  category,
  reason,
  lat,
  lng,
}) {
  const now = new Date().toISOString();

  return {
    id: createItineraryItemId(dayNumber, insertAfterIndex + 1),
    order: insertAfterIndex + 2,
    sectionTitle: "추가 일정",
    placeName,
    address,
    category,
    area: "",
    reason: reason || "사용자가 직접 추가한 일정입니다.",
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    isUserAdded: true,
    addedAt: now,
  };
}

function resetSaveButtonState() {
  if (!saveButton) return;

  saveButton.disabled = false;
  saveButton.textContent = "내 계정에 저장";
}

function createDayTabs(itinerary) {
  const tabs = document.createElement("div");
  tabs.className = "day-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "일차 선택");

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];

  days.forEach((day, index) => {
    const button = document.createElement("button");
    button.className = `day-tab${index === 0 ? " is-active" : ""}`;
    button.type = "button";
    button.role = "tab";
    button.dataset.day = String(day.day || index + 1);
    button.setAttribute("aria-selected", index === 0 ? "true" : "false");
    button.textContent = `Day ${day.day || index + 1}`;
    tabs.append(button);
  });

  return tabs;
}

function createTimeline(
  itinerary,
  selectedDayNumber = resultState.selectedDay,
) {
  const wrapper = document.createElement("div");
  wrapper.className = "timeline";

  const days = getItineraryDays(itinerary);

  if (days.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-description";
    empty.textContent = "표시할 일정이 없습니다.";
    wrapper.append(empty);
    return wrapper;
  }

  const selectedDay = findDayByNumber(itinerary, selectedDayNumber) || days[0];
  const dayNumber = Number(selectedDay.day) || getFirstDayNumber(itinerary);

  const panel = document.createElement("section");
  panel.className = "day-panel";
  panel.dataset.dayPanel = String(dayNumber);

  const title = document.createElement("div");
  title.className = "day-title";
  title.innerHTML = `
    <h3>${escapeHtml(selectedDay.title || `Day ${dayNumber}`)}</h3>
    <p>${escapeHtml(selectedDay.theme || "")}</p>
  `;

  const list = document.createElement("ol");
  list.className = "timeline-list";

  const items = Array.isArray(selectedDay.items) ? selectedDay.items : [];

  items.forEach((item, itemIndex) => {
    list.append(createTimelineItem(item, itemIndex, dayNumber));
  });

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-description";
    empty.textContent = "이 Day에 표시할 일정이 없습니다.";
    panel.append(title, empty);
  } else {
    panel.append(title, list);
  }

  wrapper.append(panel);

  return wrapper;
}

function createTimelineItem(item, index, dayNumber) {
  const li = document.createElement("li");
  li.className = "timeline-item";

  const order = item.order || index + 1;

  const itemId =
    item.id ||
    `${dayNumber}-${order}-${sanitizeFileName(item.placeName || "place")}`;

  li.dataset.day = String(dayNumber);
  li.dataset.order = String(order);
  li.dataset.itemId = String(itemId);

  const meta = [item.category, item.area].filter(Boolean).join(" · ");
  const chips = [item.duration, item.budgetHint].filter(Boolean);

  li.innerHTML = `
    <span class="timeline-dot">${escapeHtml(order)}</span>
    <p class="timeline-heading">${escapeHtml(item.sectionTitle || "추천 코스")}</p>
    <div class="place-card">
      <div class="card-thumb card-thumb--placeholder" aria-hidden="true">
        ${getIconByCategory(item.category)}
      </div>
      <div>
        <div class="place-card__header">
          <h4>${escapeHtml(item.placeName || "추천 장소")}</h4>
          <div class="place-card__actions">
            <button class="add-itinerary-item-button" type="button">뒤에 추가</button>
            <button class="edit-itinerary-item-button" type="button">수정</button>
            <button class="delete-itinerary-item-button" type="button">삭제</button>
          </div>
        </div>
        <p class="place-meta">${escapeHtml(meta)}</p>
        <p class="place-reason">
          <strong>메모</strong>
          ${escapeHtml(item.reason || "조건에 맞춰 추천된 장소입니다.")}
        </p>
        <div class="place-extra">
          ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
        </div>
      </div>
    </div>
  `;

  return li;
}

function createTipsBox(itinerary) {
  const box = document.createElement("section");
  box.className = "tips-box";

  const tips =
    Array.isArray(itinerary.tips) && itinerary.tips.length > 0
      ? itinerary.tips
      : ["편한 신발과 보조 배터리를 준비하면 좋습니다."];

  box.innerHTML = `
    <h3>여행 전 확인하면 좋은 팁</h3>
    <ul>
      ${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}
    </ul>
  `;

  if (itinerary.estimatedBudget) {
    const budget = document.createElement("p");
    budget.className = "estimated-budget";
    budget.textContent = `예상 예산: ${itinerary.estimatedBudget}`;
    box.append(budget);
  }

  return box;
}

function createFeedbackBox(itinerary, onRegenerate) {
  const box = document.createElement("section");
  box.className = "feedback-box";

  box.innerHTML = `
    <span class="heart" aria-hidden="true">💖</span>
    <h3>추천일정이 마음에 드세요?</h3>
    <p>
      만족하면 텍스트 파일로 저장하고, 아쉬운 점이 있으면 추가 요청을 입력해 다시 생성할 수 있어요.
    </p>
    <div class="feedback-actions">
      <button class="secondary-button" type="button" data-action="save">
        내 텍스트 파일로 저장
      </button>
      <button class="ghost-button" type="button" data-action="open-refine">
        아쉬운 점 입력하기
      </button>
    </div>
    <div class="refine-panel" hidden>
      <label for="refineText">추가 설명</label>
      <textarea
        id="refineText"
        placeholder="예: 걷는 거리를 줄이고, 저녁에는 야경 코스를 넣어줘"
      ></textarea>
      <button class="primary-button" type="button" data-action="regenerate">
        재생성 요청
      </button>
    </div>
  `;

  box.querySelector('[data-action="save"]')?.addEventListener("click", () => {
    downloadItineraryAsText(itinerary);
    showToast("텍스트 파일 저장을 시작했어요.");
  });

  box
    .querySelector('[data-action="open-refine"]')
    ?.addEventListener("click", () => {
      const panel = box.querySelector(".refine-panel");
      panel.hidden = !panel.hidden;

      if (!panel.hidden) {
        panel.querySelector("textarea")?.focus();
      }
    });

  box
    .querySelector('[data-action="regenerate"]')
    ?.addEventListener("click", () => {
      const refineText = box.querySelector("#refineText")?.value.trim();

      if (!refineText) {
        showToast("재생성 요청 내용을 입력해 주세요.");
        return;
      }

      onRegenerate(refineText, itinerary);
    });

  return box;
}
function bindDayTabs(screen) {
  const tabs = screen.querySelectorAll(".day-tab");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const selectedDay = Number(tab.dataset.day);

      if (!Number.isFinite(selectedDay)) return;

      resultState.selectedDay = selectedDay;

      refreshSelectedDayView({
        updateMap: true,
        scrollTimeline: true,
      });
    });
  });
}

function refreshSelectedDayView({
  updateMap = true,
  scrollTimeline = false,
} = {}) {
  const screen = resultState.screen;
  const itinerary = resultState.editableItinerary;

  if (!screen || !itinerary) return;

  resultState.selectedDay = ensureValidSelectedDay(
    itinerary,
    resultState.selectedDay,
  );

  syncActiveDayTabs(screen, resultState.selectedDay);
  syncDaySummaryPanels(screen, resultState.selectedDay);
  renderSelectedDayTimeline(screen, itinerary, resultState.selectedDay);

  if (scrollTimeline) {
    scrollTimelinePanelToTop(screen);
  }

  if (updateMap) {
    updateKakaoMapByDay(resultState.selectedDay);
  }
}

function renderSelectedDayTimeline(screen, itinerary, selectedDay) {
  const timelinePanel = screen.querySelector(".result-timeline-panel");

  if (!timelinePanel) return;

  timelinePanel.innerHTML = "";
  timelinePanel.append(createTimeline(itinerary, selectedDay));

  bindTimelineMapLinks(screen);
}

function syncActiveDayTabs(screen, selectedDay) {
  const tabs = screen.querySelectorAll(".day-tab");

  tabs.forEach((tab) => {
    const isActive = Number(tab.dataset.day) === Number(selectedDay);

    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function syncDaySummaryPanels(screen, selectedDay) {
  const summaryPanels = screen.querySelectorAll(".day-summary-panel");

  summaryPanels.forEach((panel) => {
    panel.hidden = Number(panel.dataset.daySummary) !== Number(selectedDay);
  });
}

function scrollTimelinePanelToTop(screen) {
  const timelineScroller = screen.querySelector(".result-timeline-panel");

  timelineScroller?.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function updateEditableItinerary(mutator, options = {}) {
  if (typeof mutator !== "function" || !resultState.editableItinerary) return;

  mutator(resultState.editableItinerary);

  resultState.editableItinerary = normalizeItineraryForEditing(
    resultState.editableItinerary,
  );

  kakaoMapState.itinerary = resultState.editableItinerary;

  saveItinerary(resultState.editableItinerary);

  resetSaveButtonState();

  refreshSelectedDayView(options);
}

function cloneItinerary(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeItineraryForEditing(itinerary) {
  if (!itinerary || typeof itinerary !== "object") return itinerary;

  const days = getItineraryDays(itinerary);

  days.forEach((day, dayIndex) => {
    const dayNumber = Number(day.day) || dayIndex + 1;
    day.day = dayNumber;

    const items = Array.isArray(day.items) ? day.items : [];
    day.items = items.map((item, itemIndex) => ({
      ...item,
      id: item.id || item.itemId || createItineraryItemId(dayNumber, itemIndex),
      order: itemIndex + 1,
    }));
  });

  return itinerary;
}

function createItineraryItemId(dayNumber, itemIndex) {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `day-${dayNumber}-item-${itemIndex + 1}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function getItineraryDays(itinerary) {
  return Array.isArray(itinerary?.days) ? itinerary.days : [];
}

function findDayByNumber(itinerary, dayNumber) {
  return getItineraryDays(itinerary).find(
    (day) => Number(day.day) === Number(dayNumber),
  );
}

function getFirstDayNumber(itinerary) {
  const firstDay = getItineraryDays(itinerary)[0];

  return Number(firstDay?.day) || 1;
}

function ensureValidSelectedDay(itinerary, dayNumber) {
  const matchedDay = findDayByNumber(itinerary, dayNumber);

  if (matchedDay) {
    return Number(matchedDay.day);
  }

  return getFirstDayNumber(itinerary);
}

function renderEmptyState(
  title,
  description,
  href = CREATE_PAGE_URL,
  label = "조건 입력하기",
) {
  resultContainer.innerHTML = `
    <article class="empty-state">
      <div class="result-avatar" aria-hidden="true"></div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <a class="primary-button empty-state__button" href="${escapeHtml(href)}">
        ${escapeHtml(label)}
      </a>
    </article>
  `;
}

function downloadItineraryAsText(itinerary) {
  const text = createItineraryText(itinerary);
  const blob = new Blob([text], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  const fileName = `${
    itinerary.destinationTitle || itinerary.keyword || "ai-travel-plan"
  }.txt`;

  anchor.href = url;
  anchor.download = sanitizeFileName(fileName);
  anchor.click();

  URL.revokeObjectURL(url);
}

function createItineraryText(itinerary) {
  const lines = [];

  lines.push(itinerary.headline || "AI 맞춤 여행 일정");
  lines.push("");
  lines.push(itinerary.subTitle || "");
  lines.push(itinerary.summary || "");
  lines.push("");

  if (itinerary.estimatedBudget) {
    lines.push(`[예상 예산] ${itinerary.estimatedBudget}`);
    lines.push("");
  }

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];

  days.forEach((day, index) => {
    lines.push(`Day ${day.day || index + 1}. ${day.title || ""}`);
    if (day.theme) {
      lines.push(`테마: ${day.theme}`);
    }

    const items = Array.isArray(day.items) ? day.items : [];

    items.forEach((item, itemIndex) => {
      lines.push("");
      lines.push(
        `${item.order || itemIndex + 1}. ${item.placeName || "추천 장소"}`,
      );

      if (item.sectionTitle) {
        lines.push(`- 섹션: ${item.sectionTitle}`);
      }

      if (item.category || item.area) {
        lines.push(
          `- 분류: ${[item.category, item.area].filter(Boolean).join(" · ")}`,
        );
      }

      if (item.reason) {
        lines.push(`- 메모: ${item.reason}`);
      }

      if (item.duration) {
        lines.push(`- 예상 소요 시간: ${item.duration}`);
      }

      if (item.budgetHint) {
        lines.push(`- 예상 비용: ${item.budgetHint}`);
      }
    });

    lines.push("");
  });

  if (Array.isArray(itinerary.tips) && itinerary.tips.length > 0) {
    lines.push("[여행 팁]");
    itinerary.tips.forEach((tip) => {
      lines.push(`- ${tip}`);
    });
  }

  return lines.filter((line) => line !== undefined && line !== null).join("\n");
}

function focusTimelineItem(screen, point) {
  const target = screen.querySelector(
    `.timeline-item[data-day="${point.day}"][data-order="${point.order}"]`,
  );

  if (!target) return;

  screen.querySelectorAll(".timeline-item.is-focused").forEach((item) => {
    item.classList.remove("is-focused");
  });

  target.classList.add("is-focused");

  window.setTimeout(() => {
    target.classList.remove("is-focused");
  }, 1800);
}

function setActiveMapMarker(markerElement) {
  document
    .querySelectorAll(".map-number-marker.is-active")
    .forEach((marker) => {
      marker.classList.remove("is-active");
    });

  markerElement.classList.add("is-active");
}

function sanitizeFileName(fileName) {
  return String(fileName)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
}

function formatResultHeadline(text) {
  const headline = String(text || "").trim();

  const matched = headline.match(
    /^(.+?)(을|를)\s+중심으로\s+한\s+(\d+박\s*\d+일)(.*)$/,
  );

  if (matched) {
    const [, placeName, josa, duration, rest] = matched;

    return `
      <strong>${escapeHtml(placeName)}</strong>${escapeHtml(josa)} 중심으로 한
      <br />
      <strong>${escapeHtml(duration)}</strong>${escapeHtml(rest)}
    `;
  }

  return escapeHtml(headline);
}

function getIconByCategory(category = "") {
  const value = String(category || "");

  if (
    value.includes("음식") ||
    value.includes("식사") ||
    value.includes("식당")
  ) {
    return "🍽️";
  }

  if (value.includes("카페")) {
    return "☕";
  }

  if (
    value.includes("숙소") ||
    value.includes("숙박") ||
    value.includes("호텔")
  ) {
    return "🏨";
  }

  if (value.includes("이동")) {
    return "✈️";
  }

  if (value.includes("체험")) {
    return "🎟️";
  }

  return "🗺️";
}

function bindKakaoPlaceSearchInEditModal(modal) {
  const form = modal.querySelector(".itinerary-edit-form");
  const keywordInput = modal.querySelector("input[name='placeName']");
  const searchButton = modal.querySelector("[data-place-search]");
  const resultsBox = modal.querySelector("[data-place-search-results]");

  if (!form || !keywordInput || !searchButton || !resultsBox) return;

  searchButton.addEventListener("click", async () => {
    const keyword = keywordInput.value.trim();

    if (!keyword) {
      showToast("검색할 장소명을 입력해 주세요.");
      keywordInput.focus();
      return;
    }

    searchButton.disabled = true;
    searchButton.textContent = "검색 중...";
    resultsBox.hidden = false;
    resultsBox.innerHTML = `
      <p class="itinerary-place-search-results__empty">
        장소를 검색하고 있습니다.
      </p>
    `;

    try {
      const places = await searchKakaoPlaces(keyword);
      renderKakaoPlaceSearchResults(resultsBox, places, form);
    } catch (error) {
      console.error("[장소 검색 실패]", error);
      resultsBox.hidden = false;
      resultsBox.innerHTML = `
        <p class="itinerary-place-search-results__empty">
          장소 검색 중 문제가 발생했습니다. 카카오맵 services 라이브러리를 확인해 주세요.
        </p>
      `;
    } finally {
      searchButton.disabled = false;
      searchButton.textContent = "장소 검색";
    }
  });
}

function searchKakaoPlaces(keyword) {
  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.services?.Places) {
      reject(new Error("Kakao places service is not available."));
      return;
    }

    const places = kakaoMapState.map
      ? new kakao.maps.services.Places(kakaoMapState.map)
      : new kakao.maps.services.Places();

    places.keywordSearch(
      keyword,
      (data, status) => {
        if (status === kakao.maps.services.Status.OK) {
          resolve(Array.isArray(data) ? data.slice(0, 5) : []);
          return;
        }

        if (status === kakao.maps.services.Status.ZERO_RESULT) {
          resolve([]);
          return;
        }

        reject(new Error(`Kakao place search failed: ${status}`));
      },
      {
        size: 5,
      },
    );
  });
}

function renderKakaoPlaceSearchResults(resultsBox, places, form) {
  if (!Array.isArray(places) || places.length === 0) {
    resultsBox.hidden = false;
    resultsBox.innerHTML = `
      <p class="itinerary-place-search-results__empty">
        검색 결과가 없습니다. 장소명을 조금 더 구체적으로 입력해 주세요.
      </p>
    `;
    return;
  }

  resultsBox.hidden = false;
  resultsBox.innerHTML = places
    .map((place, index) => {
      const address = place.road_address_name || place.address_name || "";
      const category = getKakaoPlaceCategory(place);

      return `
        <button
          class="itinerary-place-search-result"
          type="button"
          data-place-index="${index}"
        >
          <strong>${escapeHtml(place.place_name || "이름 없는 장소")}</strong>
          <span>${escapeHtml(address || "주소 정보 없음")}</span>
          ${category ? `<small>${escapeHtml(category)}</small>` : ""}
        </button>
      `;
    })
    .join("");

  resultsBox.querySelectorAll("[data-place-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.placeIndex);
      const selectedPlace = places[index];

      if (!selectedPlace) return;

      fillEditFormWithKakaoPlace(form, selectedPlace);
      resultsBox.hidden = true;
      resultsBox.innerHTML = "";
      showToast("선택한 장소 정보가 입력되었습니다.");
    });
  });
}

function fillEditFormWithKakaoPlace(form, place) {
  const placeName = place.place_name || "";
  const address = place.road_address_name || place.address_name || "";
  const category = getKakaoPlaceCategory(place);

  const lat = Number(place.y);
  const lng = Number(place.x);

  setFormFieldValue(form, "placeName", placeName);
  setFormFieldValue(form, "address", address);

  if (category) {
    setFormFieldValue(form, "category", category);
  }

  if (Number.isFinite(lat)) {
    setFormFieldValue(form, "lat", lat);
  }

  if (Number.isFinite(lng)) {
    setFormFieldValue(form, "lng", lng);
  }
}

function setFormFieldValue(form, name, value) {
  const field = form.querySelector(`[name="${name}"]`);

  if (!field) return;

  field.value = value ?? "";
}

function getKakaoPlaceCategory(place) {
  if (place.category_group_name) {
    return place.category_group_name;
  }

  const categoryName = String(place.category_name || "");
  const parts = categoryName
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.at(-1) || "";
}

function openAddItineraryModal({ day, item, itemIndex }) {
  closeEditItineraryModal();
  removeEditModalEscapeHandler();

  const dayNumber = day?.day || resultState.selectedDay;
  const insertAfterOrder = item?.order || itemIndex + 1;

  const modal = document.createElement("div");
  modal.className = "itinerary-edit-modal-backdrop";
  modal.setAttribute("role", "presentation");

  modal.innerHTML = `
    <div
      class="itinerary-edit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="addItineraryModalTitle"
    >
      <div class="itinerary-edit-modal__header">
        <div>
          <p class="itinerary-edit-modal__eyebrow">Day ${escapeHtml(dayNumber)} · ${escapeHtml(insertAfterOrder)}번째 일정 뒤에 추가</p>
          <h3 id="addItineraryModalTitle">새 일정 추가</h3>
        </div>
        <button
          class="itinerary-edit-modal__close"
          type="button"
          aria-label="추가 창 닫기"
          data-edit-close
        >
          ×
        </button>
      </div>

      <form class="itinerary-edit-form">
        <label>
          <span>장소명</span>
          <div class="itinerary-place-search-row">
            <input
              type="text"
              name="placeName"
              value=""
              placeholder="예: 광치기해변"
              required
            />
            <button
              class="itinerary-place-search-button"
              type="button"
              data-place-search
            >
              장소 검색
            </button>
          </div>
        </label>

        <div
          class="itinerary-place-search-results"
          data-place-search-results
          aria-live="polite"
          hidden
        ></div>

        <label>
          <span>주소</span>
          <input
            type="text"
            name="address"
            value=""
            placeholder="장소 검색 결과를 선택하면 자동으로 입력됩니다."
          />
        </label>

        <label>
          <span>카테고리</span>
          <input
            type="text"
            name="category"
            value=""
            placeholder="예: 관광지, 식당, 카페"
          />
        </label>

        <label>
          <span>메모</span>
          <textarea
            name="reason"
            rows="4"
            placeholder="이 장소를 일정에 추가하는 이유를 적어주세요."
          ></textarea>
        </label>

        <input type="hidden" name="lat" value="" />
<input type="hidden" name="lng" value="" />

<div class="itinerary-edit-modal__notice">
  추가 일정은 선택한 일정 바로 뒤에 삽입됩니다.
  장소 검색 결과를 선택하면 지도 위치가 자동으로 함께 반영됩니다.
</div>

        <div class="itinerary-edit-modal__actions">
          <button type="button" class="ghost-button" data-edit-close>
            취소
          </button>
          <button type="submit" class="primary-button">
            추가
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.append(modal);
  document.body.classList.add("is-modal-open");

  modal.querySelector("input[name='placeName']")?.focus();

  bindKakaoPlaceSearchInEditModal(modal);

  modal.querySelectorAll("[data-edit-close]").forEach((button) => {
    button.addEventListener("click", closeEditItineraryModal);
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeEditItineraryModal();
    }
  });

  modal
    .querySelector(".itinerary-edit-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      const formData = new FormData(form);

      const placeName = getTrimmedFormValue(formData, "placeName");
      const address = getTrimmedFormValue(formData, "address");
      const category = getTrimmedFormValue(formData, "category");
      const reason = getTrimmedFormValue(formData, "reason");

      const lat = parseOptionalNumber(formData.get("lat"));
      const lng = parseOptionalNumber(formData.get("lng"));

      if (!placeName) {
        showToast("장소명을 입력해 주세요.");
        form.querySelector("[name='placeName']")?.focus();
        return;
      }

      if (lat === null || lng === null) {
        showToast("장소 검색 결과를 선택해 주세요.");
        return;
      }

      if (lat < -90 || lat > 90) {
        showToast("위도는 -90부터 90 사이의 값이어야 합니다.");
        return;
      }

      if (lng < -180 || lng > 180) {
        showToast("경도는 -180부터 180 사이의 값이어야 합니다.");
        return;
      }

      let didAdd = false;

      updateEditableItinerary(
        (itinerary) => {
          const target = findItineraryItemInItinerary(
            itinerary,
            item.id,
            Number(dayNumber),
            Number(insertAfterOrder),
          );

          if (!target?.day || !target?.item) return;

          if (!Array.isArray(target.day.items)) {
            target.day.items = [];
          }

          const newItem = createUserAddedItineraryItem({
            dayNumber: Number(dayNumber),
            insertAfterIndex: target.itemIndex,
            placeName,
            address,
            category,
            reason,
            lat,
            lng,
          });

          target.day.items.splice(target.itemIndex + 1, 0, newItem);
          didAdd = true;
        },
        {
          updateMap: true,
          scrollTimeline: false,
        },
      );

      if (!didAdd) {
        showToast("새 일정을 추가할 위치를 찾지 못했습니다.");
        return;
      }

      closeEditItineraryModal();
      showToast("새 일정이 추가되었습니다.");
    });

  const handleEscape = (event) => {
    if (event.key === "Escape") {
      closeEditItineraryModal();
    }
  };

  activeEditModalEscapeHandler = handleEscape;
  document.addEventListener("keydown", handleEscape);
}

function openEditItineraryModal({ day, item, itemIndex }) {
  closeEditItineraryModal();
  removeEditModalEscapeHandler();

  const dayNumber = day?.day || resultState.selectedDay;
  const order = item?.order || itemIndex + 1;

  const lat = item.lat ?? item.latitude ?? "";
  const lng = item.lng ?? item.longitude ?? "";

  const modal = document.createElement("div");
  modal.className = "itinerary-edit-modal-backdrop";
  modal.setAttribute("role", "presentation");

  modal.innerHTML = `
    <div
      class="itinerary-edit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editItineraryModalTitle"
    >
      <div class="itinerary-edit-modal__header">
        <div>
          <p class="itinerary-edit-modal__eyebrow">Day ${escapeHtml(dayNumber)} · ${escapeHtml(order)}번째 일정</p>
          <h3 id="editItineraryModalTitle">일정 수정</h3>
        </div>
        <button
          class="itinerary-edit-modal__close"
          type="button"
          aria-label="수정 창 닫기"
          data-edit-close
        >
          ×
        </button>
      </div>

      <form class="itinerary-edit-form">
        <label>
          <span>장소명</span>
            <div class="itinerary-place-search-row">
              <input
                type="text"
                name="placeName"
                value="${escapeHtml(item.placeName || "")}"
                placeholder="예: 섭지코지"
                required
              />
              <button
                class="itinerary-place-search-button"
                type="button"
                data-place-search
              >
                장소 검색
              </button>
            </div>
        </label>

        <div
          class="itinerary-place-search-results"
          data-place-search-results
          aria-live="polite"
          hidden
        ></div>

        <label>
          <span>주소</span>
          <input
            type="text"
            name="address"
            value="${escapeHtml(item.address || "")}"
            placeholder="예: 제주 서귀포시 성산읍 ..."
          />
        </label>

        <label>
          <span>카테고리</span>
          <input
            type="text"
            name="category"
            value="${escapeHtml(item.category || "")}"
            placeholder="예: 관광지, 식당, 카페"
          />
        </label>

        <label>
          <span>메모</span>
          <textarea
            name="reason"
            rows="4"
            placeholder="이 장소를 일정에 넣는 이유를 적어주세요."
          >${escapeHtml(item.reason || "")}</textarea>
        </label>

        <input type="hidden" name="lat" value="${escapeHtml(lat)}" />
        <input type="hidden" name="lng" value="${escapeHtml(lng)}" />

        <div class="itinerary-edit-modal__notice">
          장소 검색 결과를 선택하면 지도 위치가 자동으로 함께 반영됩니다.
        </div>

        <div class="itinerary-edit-modal__actions">
          <button type="button" class="ghost-button" data-edit-close>
            취소
          </button>
          <button type="submit" class="primary-button">
            저장
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.append(modal);
  document.body.classList.add("is-modal-open");

  modal.querySelector("input[name='placeName']")?.focus();

  bindKakaoPlaceSearchInEditModal(modal);

  modal.querySelectorAll("[data-edit-close]").forEach((button) => {
    button.addEventListener("click", closeEditItineraryModal);
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeEditItineraryModal();
    }
  });

  modal
    .querySelector(".itinerary-edit-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      const formData = new FormData(form);

      const placeName = getTrimmedFormValue(formData, "placeName");
      const address = getTrimmedFormValue(formData, "address");
      const category = getTrimmedFormValue(formData, "category");
      const reason = getTrimmedFormValue(formData, "reason");

      const lat = parseOptionalNumber(formData.get("lat"));
      const lng = parseOptionalNumber(formData.get("lng"));

      if (!placeName) {
        showToast("장소명을 입력해 주세요.");
        form.querySelector("[name='placeName']")?.focus();
        return;
      }

      if ((lat === null && lng !== null) || (lat !== null && lng === null)) {
        showToast("위도와 경도는 함께 입력해 주세요.");
        return;
      }

      if (lat !== null && (lat < -90 || lat > 90)) {
        showToast("위도는 -90부터 90 사이의 값이어야 합니다.");
        return;
      }

      if (lng !== null && (lng < -180 || lng > 180)) {
        showToast("경도는 -180부터 180 사이의 값이어야 합니다.");
        return;
      }

      let didUpdate = false;

      updateEditableItinerary(
        (itinerary) => {
          const target = findItineraryItemInItinerary(
            itinerary,
            item.id,
            Number(dayNumber),
            Number(order),
          );

          if (!target?.item) return;

          target.item.placeName = placeName;
          target.item.address = address;
          target.item.category = category;
          target.item.reason = reason;
          target.item.isUserEdited = true;
          target.item.editedAt = new Date().toISOString();

          if (lat !== null && lng !== null) {
            target.item.lat = lat;
            target.item.lng = lng;
            target.item.latitude = lat;
            target.item.longitude = lng;
          }

          didUpdate = true;
        },
        {
          updateMap: true,
          scrollTimeline: false,
        },
      );

      if (!didUpdate) {
        showToast("수정할 일정을 찾지 못했습니다.");
        return;
      }

      closeEditItineraryModal();
      showToast("일정이 수정되었습니다.");
    });

  const handleEscape = (event) => {
    if (event.key === "Escape") {
      closeEditItineraryModal();
    }
  };

  activeEditModalEscapeHandler = handleEscape;
  document.addEventListener("keydown", handleEscape);
}

function closeEditItineraryModal() {
  document.querySelector(".itinerary-edit-modal-backdrop")?.remove();
  document.body.classList.remove("is-modal-open");
  removeEditModalEscapeHandler();
}

function removeEditModalEscapeHandler() {
  if (!activeEditModalEscapeHandler) return;

  document.removeEventListener("keydown", activeEditModalEscapeHandler);
  activeEditModalEscapeHandler = null;
}

function showToast(message) {
  const oldToast = document.querySelector(".toast");
  oldToast?.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  document.body.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2400);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
