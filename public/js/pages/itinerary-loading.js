import { requestItinerary } from "../common/api.js";
import { loadPayload, saveItinerary } from "./itinerary-state.js";

const loadingSummary = document.querySelector("#loadingSummary");
const loadingMessage = document.querySelector("#loadingMessage");

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

async function generateItinerary(payload) {
  const startedAt = Date.now();

  try {
    const itinerary = await requestItinerary(payload);
    saveItinerary(itinerary);

    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, 900 - elapsed);

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
    ["스타일", payload.style || "-"],
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
