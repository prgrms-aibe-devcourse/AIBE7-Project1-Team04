const API_BASE = "http://localhost:3011";

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

function showPage(name) {
  Object.values(pages).forEach((page) => page.classList.remove("active"));
  pages[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetMode(mode) {
  const cfg = elements[mode];

  if (cfg.moveMoodBtn) {
    cfg.moveMoodBtn.classList.add("d-none");
  }

  if (state[mode].previewUrl) {
    URL.revokeObjectURL(state[mode].previewUrl);
  }

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
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return "서버에 연결할 수 없습니다. finalserver.js가 실행 중인지 확인해 주세요.";
  }
  if (msg.includes("413") || msg.includes("too large")) {
    return "이미지 파일이 너무 큽니다. 더 작은 파일로 다시 시도해 주세요.";
  }
  if (msg.includes("500")) {
    return "서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "요청 처리에 실패했습니다. 다시 시도해 주세요.";
}

function renderSpots(spots) {
  if (!Array.isArray(spots) || spots.length === 0) {
    return '<p class="text-secondary mb-0">추천 결과가 없습니다.</p>';
  }

  return spots
    .map(
      (spot) => `
              <div class="spot-card mb-2">
                <p class="spot-name mb-1">
                  ${escapeHtml(spot.name || "추천 여행지")}
                  ${spot.country ? `<span class="spot-country"> · ${escapeHtml(spot.country)}</span>` : ""}
                </p>
                <p class="spot-reason">${escapeHtml(spot.reason || "")}</p>
              </div>
            `,
    )
    .join("");
}

function renderLocationResult(data) {
  let html = "";

  if (data.location) {
    const loc = data.location;
    html += `
            <div class="mb-3">
              <div class="section-label">추정 위치</div>
              <div class="spot-card">
                <p class="spot-name mb-1">${escapeHtml(loc.region || "알 수 없음")}</p>
                <div class="meta-row">
                  ${Number.isFinite(loc.latitude) ? `<span class="meta-badge">위도 ${loc.latitude.toFixed(4)}</span>` : ""}
                  ${Number.isFinite(loc.longitude) ? `<span class="meta-badge">경도 ${loc.longitude.toFixed(4)}</span>` : ""}
                  ${Number.isFinite(loc.confidence) ? `<span class="meta-badge">신뢰도 ${loc.confidence}%</span>` : ""}
                </div>
              </div>
            </div>
          `;
  }

  if (data.recommendation?.spots) {
    html += `
            <div>
              <div class="section-label">추천 여행지</div>
              ${renderSpots(data.recommendation.spots)}
            </div>
          `;
  }

  return html;
}

function renderMoodResult(data) {
  let html = "";

  if (data.moodTags) {
    html += `
            <div class="mb-3">
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
              <div class="section-label">추천 여행지</div>
              ${renderSpots(data.recommendation.spots)}
            </div>
          `;
  }

  return html;
}

function updatePreview(mode, file, imageEl, placeholderEl, uploadBoxEl) {
  if (state[mode].previewUrl) {
    URL.revokeObjectURL(state[mode].previewUrl);
  }
  state[mode].previewUrl = URL.createObjectURL(file);
  imageEl.src = state[mode].previewUrl;
  imageEl.classList.remove("d-none");
  placeholderEl.classList.add("d-none");
  uploadBoxEl.classList.add("has-image");
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

    if (!response.ok) {
      throw new Error(String(response.status));
    }

    const data = await response.json();
    if (requestId !== state.location.requestId) return;
    resultEl.innerHTML = renderLocationResult(data);
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

    if (!response.ok) {
      throw new Error(String(response.status));
    }

    const data = await response.json();
    if (requestId !== state.mood.requestId) return;
    resultEl.innerHTML = renderMoodResult(data);
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
    if (button.dataset.open === "location") {
      resetMode("location");
    }
    if (button.dataset.open === "mood") {
      resetMode("mood");
    }
    showPage(button.dataset.open);
  });
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => {
    resetAllModes();
    showPage("home");
  });
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
