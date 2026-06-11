import {
  requestItinerary,
  requestItineraryWithProgress,
} from "../common/api.js";
import { loadPayload, saveItinerary } from "./itinerary-state.js";

const loadingSummary = document.querySelector("#loadingSummary");
const loadingMessage = document.querySelector("#loadingMessage");
const loadingStepItems = document.querySelectorAll("#loadingSteps span");

const payload = loadPayload();

if (!payload?.keyword) {
  showError("저장된 여행 조건이 없습니다. 조건 입력 페이지로 돌아가 주세요.");
  setTimeout(() => {
    window.location.href = "./itinerary-create.html";
  }, 1600);
} else {
  renderPayloadSummary(payload);
  generateItinerary(payload);
}

function setLoadingStage(stage) {
  loadingStepItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.stage === stage);
  });
}

function handleProgress(progress) {
  if (progress.stage) {
    setLoadingStage(progress.stage);
  }

  if (progress.message) {
    loadingMessage.textContent = progress.message;
  }
}
async function generateItinerary(payload) {
  const startedAt = Date.now();

  try {
    const itinerary = await requestItineraryWithProgress(
      payload,
      handleProgress,
    );

    saveItinerary(itinerary);

    setLoadingStage("finalize");
    loadingMessage.textContent =
      "일정 생성이 완료되어 결과 페이지로 이동하고 있어요.";

    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, 500 - elapsed);

    window.setTimeout(() => {
      window.location.href = "./itinerary-result.html";
    }, wait);
  } catch (error) {
    showError(error.message || "일정 생성 중 오류가 발생했습니다.");
  }
}

function renderPayloadSummary(payload) {
  const rows = [
    ["키워드", payload.keyword || "-"],
    ["목적지", payload.destination || "AI 추천"],
    ["출발지", payload.departure || "미정"],
    ["기간", `${payload.days || 3}일`],
    ["인원", `${payload.people || 2}명`],
    ["예산", payload.budget || "미정"],
  ];

  loadingSummary.innerHTML = rows
    .map(
      ([label, value]) =>
        `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join("");
}

// 에러 발생 시
function showError(message) {
  loadingMessage.textContent = message;
  loadingMessage.classList.add("is-error");

  const actions = document.createElement("div");
  actions.className = "loading-actions";
  actions.innerHTML = `
  <a class="secondary-button" href="./itinerary-create.html">조건 입력 페이지로 돌아가기</a>
  <button class="ghost-button" type="button" id="retryLoadingButton">다시 시도</button>`;

  document.querySelector(".loading-page").append(actions);
  actions.querySelector("#retryLoadingButton").addEventListener("click", () => {
    window.location.reload();
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
