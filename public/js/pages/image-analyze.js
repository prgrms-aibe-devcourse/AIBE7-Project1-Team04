const API_BASE = "http://localhost:3000";

const pages = {
  home: document.querySelector("#homePage"),
  location: document.querySelector("#locationPage"),
  mood: document.querySelector("#moodPage"),
};

const state = {
  location: {
    imageBase64: "",
    isLoading: false,
    previewUrl: "",
    requestId: 0,
  },
  mood: {
    imageBase64: "",
    isLoading: false,
    previewUrl: "",
    requestId: 0,
  },
};

const elements = {
  location: {
    input: document.querySelector("#locationImageInput"),
    preview: document.querySelector("#locationPreview"),
    placeholder: document.querySelector("#locationPlaceholder"),
    uploadBox: document.querySelector("#locationUploadBox"),
    hint: document.querySelector("#locationHintInput"),
    button: document.querySelector("#locationRecommendBtn"),
    moveMoodBtn: document.querySelector("#moveToMoodBtn"),
    status: document.querySelector("#locationStatus"),
    error: document.querySelector("#locationError"),
    result: document.querySelector("#locationResult"),
  },
  mood: {
    input: document.querySelector("#moodImageInput"),
    preview: document.querySelector("#moodPreview"),
    placeholder: document.querySelector("#moodPlaceholder"),
    uploadBox: document.querySelector("#moodUploadBox"),
    extra: document.querySelector("#moodExtraInput"),
    button: document.querySelector("#moodRecommendBtn"),
    status: document.querySelector("#moodStatus"),
    error: document.querySelector("#moodError"),
    result: document.querySelector("#moodResult"),
  },
};

const SPINNER =
  '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>';

function ensureKakaoReady() {
  return new Promise((resolve) => {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      resolve(window.kakao);
      return;
    }
    if (window.kakao && window.kakao.maps && window.kakao.maps.load) {
      window.kakao.maps.load(() => resolve(window.kakao));
      return;
    }
    const interval = setInterval(() => {
      if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
        clearInterval(interval);
        window.kakao.maps.load(() => resolve(window.kakao));
      }
    }, 100);
  });
}

async function searchKakaoPlaces(query) {
  const kakao = await ensureKakaoReady();
  return new Promise((resolve) => {
    const places = new kakao.maps.services.Places();

    places.keywordSearch(query, (results, status) => {
      if (status === kakao.maps.services.Status.ZERO_RESULT) {
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(query, (addrResults, addrStatus) => {
          if (addrStatus !== kakao.maps.services.Status.OK) {
            resolve([]);
            return;
          }
          resolve(
            addrResults.map((item) => ({
              name: item.road_address?.building_name || item.address_name,
              latitude: Number(item.y),
              longitude: Number(item.x),
            })),
          );
        });
        return;
      }

      if (status !== kakao.maps.services.Status.OK) {
        resolve([]);
        return;
      }

      resolve(
        results.map((item) => ({
          name: item.place_name || item.address_name,
          latitude: Number(item.y),
          longitude: Number(item.x),
        })),
      );
    });
  });
}

async function renderKakaoCardMap(container, place) {
  const kakao = await ensureKakaoReady();
  const position = new kakao.maps.LatLng(place.latitude, place.longitude);

  const map = new kakao.maps.Map(container, {
    center: position,
    level: 4,
  });

  const marker = new kakao.maps.Marker({ position, map });
  map.setDraggable(false);
  map.setZoomable(false);

  const infoContent = `
    <div style="padding: 6px 10px; font-size: 12px; font-weight: 700; color: #1e293b; font-family: sans-serif; text-align: center; background: #fff; min-width: 120px;">
      ${escapeHtml(place.name)}
    </div>
  `;

  const infoWindow = new kakao.maps.InfoWindow({
    content: infoContent,
  });

  setTimeout(() => {
    map.relayout();
    map.setCenter(position);
  }, 150);

  return map;
}

// 통합 지도 마운트 함수 (추정 위치 및 추천지 모두 키워드 검색 기반으로 작동)
async function renderKakaoMaps(spots, estimatedLocationName = null) {
  // 1. [변경 완료] 추정 위치도 이름을 가지고 키워드 검색 API로 실제 위치값 도출
  if (estimatedLocationName) {
    const estContainer = document.getElementById("estimated-map");
    if (estContainer) {
      try {
        const results = await searchKakaoPlaces(estimatedLocationName);
        if (results && results.length > 0) {
          const targetPlace = results[0];
          await renderKakaoCardMap(estContainer, {
            name: targetPlace.name, // 검색 결과로 나온 깔끔한 상호명 매핑
            latitude: targetPlace.latitude,
            longitude: targetPlace.longitude,
          });
        } else {
          // 검색 실패 시 폴백 (서버 데이터셋 활용)
          const fallbackLat = Number(estContainer.dataset.fallbackLat);
          const fallbackLng = Number(estContainer.dataset.fallbackLng);
          if (!isNaN(fallbackLat) && !isNaN(fallbackLng)) {
            await renderKakaoCardMap(estContainer, {
              name: estimatedLocationName,
              latitude: fallbackLat,
              longitude: fallbackLng,
            });
          }
        }
      } catch (err) {
        console.error("추정 위치 지도 렌더링 실패:", err);
      }
    }
  }

  // 2. 연관 추천 여행지 3곳 지도 렌더링
  for (const [index, spot] of spots.entries()) {
    const container = document.getElementById(`map-${index}`);
    if (!container) continue;

    const searchQuery = `${spot.name} ${spot.region || ""}`.trim();

    try {
      const results = await searchKakaoPlaces(searchQuery);
      if (results && results.length > 0) {
        const targetPlace = results[0];
        await renderKakaoCardMap(container, {
          name: spot.name,
          latitude: targetPlace.latitude,
          longitude: targetPlace.longitude,
        });
      } else {
        container.innerHTML = `
          <div class="d-flex align-items-center justify-content-center h-100 bg-light text-muted" style="font-size:12px;">
            지도 위치 검색 실패
          </div>`;
      }
    } catch (error) {
      console.error("지도 처리 실패:", error);
      container.innerHTML = `<div class="d-flex align-items-center justify-content-center h-100 bg-light text-danger" style="font-size:12px;">지도 로드 에러</div>`;
    }
  }
}

async function renderSpots(spots) {
  if (!Array.isArray(spots) || spots.length === 0) {
    return '<p class="text-secondary mb-0">추천 결과가 없습니다.</p>';
  }

  let html = '<div class="custom-travel-container fade-up">';

  for (const [index, spot] of spots.entries()) {
    const spotName = spot.name || "추천 여행지";
    const region = spot.region || "";
    const reason = spot.reason || "";

    html += `
    <div class="custom-travel-item">
      <div class="travel-card">
        <div id="map-${index}" class="travel-map"></div>
        <div class="travel-card-body">
          <div>
            <div class="travel-card-head">
              <h4 class="travel-card-title">${escapeHtml(spotName)}</h4>
              ${region ? `<span class="travel-card-subtitle">📍 ${escapeHtml(region)}</span>` : ""}
            </div>
            <p class="travel-reason">${escapeHtml(reason)}</p>
          </div>
          <button
            type="button"
            class="btn spot-action-btn mt-auto"
            data-name="${escapeHtml(spotName)}"
            data-region="${escapeHtml(region)}"
            data-reason="${escapeHtml(reason)}"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="me-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            이 여행지로 일정 만들기
          </button>
        </div>
      </div>
    </div>
    `;
  }

  html += "</div>";
  return html;
}

async function renderLocationResult(data) {
  let html = "";

  if (data.location) {
    const loc = data.location;
    const estName = loc.region || "추정된 장소";

    html += `
      <div class="mb-5">
        <div class="section-label mb-3">🎯 사진 속 추정 위치</div>
        <div class="custom-travel-container">
          <div class="custom-travel-item" style="flex: 1 1 100% !important;">
            <div class="travel-card">
              <div id="estimated-map" class="travel-map" data-fallback-lat="${loc.latitude}" data-fallback-lng="${loc.longitude}"></div>
              <div class="travel-card-body">
                <div>
                  <div class="travel-card-head">
                    <h4 class="travel-card-title">${escapeHtml(estName)}</h4>
                    <div class="meta-row mt-2">
                      ${Number.isFinite(loc.confidence) ? `<span class="meta-badge">AI 매칭 신뢰도 ${loc.confidence}%</span>` : ""}
                    </div>
                  </div>
                  <p class="travel-reason">AI 분석 결과, 업로드하신 이미지와 일치하는 추정 장소입니다. 해당 장소 정보를 카카오 지도 API로 정밀 조회하여 마운트했습니다.</p>
                </div>
                <button
                  type="button"
                  class="btn spot-action-btn mt-3"
                  data-name="${escapeHtml(estName)}"
                  data-region="${escapeHtml(estName)}"
                  data-reason="사진 파일 분석을 통해 역추적된 인공지능 탐지 장소입니다."
                >
                  <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="me-1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
                  </svg>
                  이 추정 위치로 일정 만들기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (data.recommendation?.spots) {
    html += `
      <div>
        <div class="section-label mb-3">✨ 연관 추천 여행지</div>
        ${await renderSpots(data.recommendation.spots)}
      </div>
    `;
  }

  return html;
}

async function renderMoodResult(data) {
  let html = "";
  if (data.moodTags) {
    html += `
      <div class="mb-4">
        <div class="section-label">분위기 해석</div>
        <div class="mood-tags">
          ${data.moodTags.terrain ? `<span class="mood-tag">지형: ${escapeHtml(data.moodTags.terrain)}</span>` : ""}
          ${data.moodTags.weather ? `<span class="mood-tag">날씨: ${escapeHtml(data.moodTags.weather)}</span>` : ""}
          ${data.moodTags.color ? `<span class="mood-tag">색감: ${escapeHtml(data.moodTags.color)}</span>` : ""}
          ${data.moodTags.mood ? `<span class="mood-tag">무드: ${escapeHtml(data.moodTags.mood)}</span>` : ""}
        </div>
      </div>
    `;
  }
  if (data.recommendation?.spots) {
    html += `
      <div>
        <div class="section-label mb-3">추천 여행지</div>
        ${await renderSpots(data.recommendation.spots)}
      </div>
    `;
  }
  return html;
}

function showPage(name) {
  Object.values(pages).forEach((page) => page.classList.remove("active"));
  pages[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetMode(mode) {
  const cfg = elements[mode];
  if (cfg.moveMoodBtn) cfg.moveMoodBtn.classList.add("d-none");

  if (state[mode].previewUrl) URL.revokeObjectURL(state[mode].previewUrl);

  state[mode].imageBase64 = "";
  state[mode].isLoading = false;
  state[mode].previewUrl = "";
  state[mode].requestId += 1;

  cfg.input.value = "";
  cfg.preview.src = "";
  cfg.preview.classList.add("d-none");
  cfg.placeholder.classList.remove("d-none");
  cfg.uploadBox.classList.remove("has-image");

  cfg.hint && (cfg.hint.value = "");
  cfg.extra && (cfg.extra.value = "");
  cfg.button.disabled = true;
  cfg.button.innerHTML =
    mode === "location" ? "위치 기반 여행지 추천" : "분위기 기반 여행지 추천";

  clearStatus(cfg.status);
  clearError(cfg.error);
  cfg.result.classList.remove("visible");
  cfg.result.innerHTML = "";
}

function resetAllModes() {
  resetMode("location");
  resetMode("mood");
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setStatus(el, message, animate = false) {
  el.innerHTML = animate
    ? `<span class="status-dots">${message}</span>`
    : message;
}

function clearStatus(el) {
  el.textContent = "";
}
function showError(el, resultEl, message) {
  el.textContent = message;
  el.classList.add("visible");
  resultEl.classList.remove("visible");
  resultEl.innerHTML = "";
}
function clearError(el) {
  el.textContent = "";
  el.classList.remove("visible");
}

function friendlyError(error) {
  const msg = error?.message || "";
  if (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("TypeError")
  ) {
    return "서버에 연결할 수 없습니다. 서버가 정상적으로 실행 중인지 확인해 주세요.";
  }
  if (msg === "413" || msg.includes("too large")) {
    return "업로드한 이미지 용량이 너무 큽니다. 더 작은 크기의 이미지로 다시 시도해 주세요.";
  }
  if (msg === "500" || msg.includes("Internal Server Error")) {
    return "서버에서 이미지를 분석하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "요청을 처리하는 동안 문제가 발생했습니다. 다시 시도해 주세요.";
}

function updatePreview(mode, file, imageEl, placeholderEl, uploadBoxEl) {
  if (state[mode].previewUrl) URL.revokeObjectURL(state[mode].previewUrl);
  state[mode].previewUrl = URL.createObjectURL(file);
  imageEl.src = state[mode].previewUrl;
  imageEl.classList.remove("d-none");
  placeholderEl.classList.add("d-none");
  uploadBoxEl.classList.add("has-image");
}

function configRecommendationSpots(spots) {
  sessionStorage.setItem("recommendationSpots", JSON.stringify(spots));
}

function setImageFromFile(
  mode,
  file,
  imageEl,
  placeholderEl,
  uploadBoxEl,
  inputEl,
  btnEl,
) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const value = event.target?.result;
    state[mode].imageBase64 =
      typeof value === "string" ? value.split(",")[1] : "";
    btnEl.disabled = !state[mode].imageBase64 || state[mode].isLoading;
  };
  reader.readAsDataURL(file);
  updatePreview(mode, file, imageEl, placeholderEl, uploadBoxEl);
}

async function analyzeLocation() {
  const hintInput = elements.location.hint;
  const btn = elements.location.button;
  const statusEl = elements.location.status;
  const errorEl = elements.location.error;
  const resultEl = elements.location.result;
  const requestId = ++state.location.requestId;

  if (!state.location.imageBase64) {
    showError(errorEl, resultEl, "이미지를 먼저 업로드해 주세요.");
    return;
  }

  clearError(errorEl);
  clearStatus(statusEl);
  state.location.isLoading = true;
  btn.disabled = true;
  btn.innerHTML = SPINNER + "분석 중";

  const steps = ["이미지 분석 중", "위치 추정 중", "여행지 추천 생성 중"];
  let idx = 0;
  setStatus(statusEl, steps[idx], true);
  const timer = setInterval(() => {
    idx = Math.min(idx + 1, steps.length - 1);
    setStatus(statusEl, steps[idx], true);
  }, 2500);

  try {
    const response = await fetch(`${API_BASE}/api/find-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: state.location.imageBase64,
        hint: hintInput.value.trim(),
      }),
    });

    if (!response.ok) throw new Error(String(response.status));

    const data = await response.json();
    configRecommendationSpots(data.recommendation?.spots || []);
    if (requestId !== state.location.requestId) return;

    resultEl.innerHTML = await renderLocationResult(data);

    // [수정] 추정 위치 이름을 두 번째 인자로 문자열 전달
    const estName = data.location?.region || null;
    await renderKakaoMaps(data.recommendation?.spots || [], estName);

    resultEl.classList.add("visible");
    elements.location.moveMoodBtn.classList.remove("d-none");
    setStatus(statusEl, "분석 완료");
  } catch (error) {
    if (requestId !== state.location.requestId) return;
    showError(errorEl, resultEl, friendlyError(error));
    clearStatus(statusEl);
  } finally {
    clearInterval(timer);
    if (requestId !== state.location.requestId) return;
    state.location.isLoading = false;
    btn.disabled = !state.location.imageBase64;
    btn.innerHTML = "위치 기반 여행지 추천";
  }
}

async function analyzeMood() {
  const extraInput = elements.mood.extra;
  const btn = elements.mood.button;
  const statusEl = elements.mood.status;
  const errorEl = elements.mood.error;
  const resultEl = elements.mood.result;
  const requestId = ++state.mood.requestId;

  if (!state.mood.imageBase64) {
    showError(errorEl, resultEl, "이미지를 먼저 업로드해 주세요.");
    return;
  }

  clearError(errorEl);
  clearStatus(statusEl);
  state.mood.isLoading = true;
  btn.disabled = true;
  btn.innerHTML = SPINNER + "분석 중";

  const steps = [
    "이미지 분위기 분석 중",
    "추천 조건 반영 중",
    "여행지 추천 생성 중",
  ];
  let idx = 0;
  setStatus(statusEl, steps[idx], true);
  const timer = setInterval(() => {
    idx = Math.min(idx + 1, steps.length - 1);
    setStatus(statusEl, steps[idx], true);
  }, 2500);

  try {
    const response = await fetch(`${API_BASE}/api/find-mood`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: state.mood.imageBase64,
        extra: extraInput.value.trim(),
      }),
    });

    if (!response.ok) throw new Error(String(response.status));

    const data = await response.json();
    if (data.recommendation?.spots) {
      configRecommendationSpots(data.recommendation.spots);
    }

    if (requestId !== state.mood.requestId) return;
    resultEl.innerHTML = await renderMoodResult(data);
    await renderKakaoMaps(data.recommendation.spots, null);
    resultEl.classList.add("visible");
    setStatus(statusEl, "분석 완료");
  } catch (error) {
    if (requestId !== state.mood.requestId) return;
    showError(errorEl, resultEl, friendlyError(error));
    clearStatus(statusEl);
  } finally {
    clearInterval(timer);
    if (requestId !== state.mood.requestId) return;
    state.mood.isLoading = false;
    btn.disabled = !state.mood.imageBase64;
    btn.innerHTML = "분위기 기반 여행지 추천";
  }
}

document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.open === "location") resetMode("location");
    if (button.dataset.open === "mood") resetMode("mood");
    showPage(button.dataset.open);
  });
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => {
    resetAllModes();
    showPage("home");
  });
});

document.body.addEventListener("click", (event) => {
  const targetBtn = event.target.closest(".spot-action-btn");
  if (!targetBtn) return;

  const spot = {
    name: targetBtn.dataset.name,
    region: targetBtn.dataset.region,
    reason: targetBtn.dataset.reason,
  };

  sessionStorage.setItem("selectedSpot", JSON.stringify(spot));
  window.location.href = "../ public/pages/itinerary-create.html";
});

elements.location.input.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  setImageFromFile(
    "location",
    file,
    elements.location.preview,
    elements.location.placeholder,
    elements.location.uploadBox,
    elements.location.input,
    elements.location.button,
  );
});

elements.location.button.addEventListener("click", analyzeLocation);

elements.mood.input.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  setImageFromFile(
    "mood",
    file,
    elements.mood.preview,
    elements.mood.placeholder,
    elements.mood.uploadBox,
    elements.mood.input,
    elements.mood.button,
  );
});

elements.mood.button.addEventListener("click", analyzeMood);

elements.location.moveMoodBtn.addEventListener("click", () => {
  if (!state.location.imageBase64) return;
  state.mood.imageBase64 = state.location.imageBase64;
  elements.mood.preview.src =
    "data:image/jpeg;base64," + state.location.imageBase64;
  elements.mood.preview.classList.remove("d-none");
  elements.mood.placeholder.classList.add("d-none");
  elements.mood.uploadBox.classList.add("has-image");
  elements.mood.button.disabled = false;
  showPage("mood");
});

window.addEventListener("beforeunload", () => {
  if (state.location.previewUrl) URL.revokeObjectURL(state.location.previewUrl);
  if (state.mood.previewUrl) URL.revokeObjectURL(state.mood.previewUrl);
});
