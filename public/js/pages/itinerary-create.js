import { clearItinerary, clearTripId, loadPayload, savePayload } from "./itinerary-state.js";

const DEFAULT_PROVIDER = "gemini";
const ENTRY_MODE_KEY = "itineraryEntryMode";

const ENTRY_MODE = {
  FRESH: "fresh",
  IMAGE: "image",
  CLEAR_NOTES_ONLY: "clearNotesOnly",
};

const form = document.querySelector("#plannerForm");

restorePreviousPayload();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const payload = getPayloadFromForm();

  if (!payload.keyword) {
    showToast("키워드를 입력해 주세요.");
    return;
  }

  savePayload(payload);
  clearItinerary();
  window.location.href = "./itinerary-loading.html";
});

function restorePreviousPayload() {
  const entryMode = consumeEntryMode();
  const payload = loadPayload() || {};
  const selectedSpot = getSelectedSpotFromSession();

  // 1. main → itinerary-create
  // 완전히 새 여행 작성
  if (entryMode === ENTRY_MODE.FRESH) {
    const emptyPayload = createDefaultPayload();

    applyPayloadToForm(emptyPayload);
    savePayload(emptyPayload);
    clearItinerary();
    clearTripId();
    clearSelectedSpotSession();
    return;
  }

  // 2. image-location / image-mood → itinerary-create
  // 전체 초기화 후 이미지 분석 결과의 name, region만 반영
  if (entryMode === ENTRY_MODE.IMAGE && selectedSpot) {
    const imagePayload = {
      ...createDefaultPayload(),
      keyword: selectedSpot.name,
      destination: selectedSpot.region || selectedSpot.name,
      notes: "",
    };

    applyPayloadToForm(imagePayload);
    savePayload(imagePayload);
    clearItinerary();
    clearTripId();
    clearSelectedSpotSession();
    return;
  }

  // 3. itinerary-result → itinerary-create
  // 기존 조건은 유지하고 추가 조건만 초기화
  if (entryMode === ENTRY_MODE.CLEAR_NOTES_ONLY) {
    const nextPayload = normalizePayload({
      ...payload,
      notes: "",
    });

    applyPayloadToForm(nextPayload);
    savePayload(nextPayload);
    return;
  }

  // 4. 일반 재진입
  // 기존 조건 복원
  const nextPayload = normalizePayload(payload);

  if (Object.keys(nextPayload).length === 0) return;

  applyPayloadToForm(nextPayload);

  const shouldSave =
    payload.notes !== nextPayload.notes ||
    payload.provider !== DEFAULT_PROVIDER ||
    (!payload.budgetAmount && Boolean(payload.budget));

  if (shouldSave) {
    savePayload(nextPayload);
  }
}

function consumeEntryMode() {
  const mode = sessionStorage.getItem(ENTRY_MODE_KEY);
  sessionStorage.removeItem(ENTRY_MODE_KEY);
  return mode;
}

function createDefaultPayload() {
  return {
    keyword: "",
    destination: "",
    departure: "",
    days: 3,
    people: 2,
    budget: "",
    budgetAmount: "",
    budgetType: "perPerson",
    provider: DEFAULT_PROVIDER,
    notes: "",
  };
}

function normalizePayload(payload = {}) {
  return {
    ...payload,
    notes: cleanImageAnalyzeNotes(payload.notes),
    provider: DEFAULT_PROVIDER,
    budgetAmount: payload.budgetAmount || extractBudgetAmount(payload.budget),
    budgetType: payload.budgetType || extractBudgetType(payload.budget),
  };
}

function applyPayloadToForm(payload) {
  setFieldValue("keyword", payload.keyword);
  setFieldValue("destination", payload.destination);
  setFieldValue("departure", payload.departure);
  setFieldValue("days", payload.days);
  setFieldValue("people", payload.people);
  setFieldValue("budgetAmount", payload.budgetAmount);
  setRadioValue("budgetType", payload.budgetType || "perPerson");
  setFieldValue("provider", DEFAULT_PROVIDER);
  setFieldValue("notes", payload.notes);
}

function clearSelectedSpotSession() {
  sessionStorage.removeItem("selectedSpot");
  sessionStorage.removeItem("name");
}

function getSelectedSpotFromSession() {
  const raw = sessionStorage.getItem("selectedSpot");

  if (!raw) {
    return null;
  }

  try {
    const spot = JSON.parse(raw);

    const name = String(spot?.name || "").trim();
    const region = String(spot?.region || "").trim();
    const reason = String(spot?.reason || "").trim();

    if (!name) {
      return null;
    }

    return {
      name,
      region,
      reason,
    };
  } catch (error) {
    console.warn("selectedSpot 파싱 실패:", error);
    sessionStorage.removeItem("selectedSpot");
    return null;
  }
}

function cleanImageAnalyzeNotes(notes) {
  return String(notes || "")
    .split("\n")
    .filter((line) => {
      const text = line.trim();

      if (!text) return false;

      return (
        !text.startsWith("이미지 분석에서 선택한 장소:") &&
        !text.startsWith("이미지 분석에서 선택한 여행지:") &&
        !text.startsWith("추천 목적지:") &&
        !text.startsWith("분석 이유:")
      );
    })
    .join("\n")
    .trim();
}

function setFieldValue(name, value) {
  const field = form.elements[name];
  if (!field || value === undefined || value === null) return;

  field.value = value;
}

function getPayloadFromForm() {
  const formData = new FormData(form);

  const budgetAmount = String(formData.get("budgetAmount") || "").trim();
  const budgetType = String(formData.get("budgetType") || "perPerson").trim();

  return {
    keyword: String(formData.get("keyword") || "").trim(),
    destination: String(formData.get("destination") || "").trim(),
    departure: String(formData.get("departure") || "").trim(),
    days: Number(formData.get("days") || 3),
    people: Number(formData.get("people") || 2),

    // 서버 prompt에서 바로 쓰기 좋은 문자열
    budget: formatBudget(budgetAmount, budgetType),

    // 폼 복원용 데이터
    budgetAmount,
    budgetType,

    // 화면 선택 없이 Gemini 고정
    provider: DEFAULT_PROVIDER,

    notes: String(formData.get("notes") || "").trim(),
  };
}

function formatBudget(amount, type) {
  if (!amount) return "";

  const label = type === "total" ? "전체" : "1인당";
  return `${label} ${amount}`;
}

function setRadioValue(name, value) {
  const field = form.querySelector(`input[name="${name}"][value="${value}"]`);
  if (!field) return;

  field.checked = true;
}

function extractBudgetType(budget) {
  const text = String(budget || "").trim();

  if (text.includes("전체") || text.includes("총")) {
    return "total";
  }

  return "perPerson";
}

function extractBudgetAmount(budget) {
  return String(budget || "")
    .replace(/^1인당\s*/, "")
    .replace(/^1인\s*/, "")
    .replace(/^개인\s*/, "")
    .replace(/^전체\s*/, "")
    .replace(/^총\s*/, "")
    .trim();
}
