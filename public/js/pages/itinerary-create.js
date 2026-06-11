import { clearItinerary, loadPayload, savePayload } from "./itinerary-state.js";

const DEFAULT_PROVIDER = "gemini";
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
  const payload = loadPayload() || {};
  const selectedSpot = getSelectedSpotFromSession();

  const nextPayload = selectedSpot
    ? {
        ...payload,
        keyword: selectedSpot.name,
        destination: selectedSpot.region || selectedSpot.name,
        notes: cleanImageAnalyzeNotes(payload.notes),
        provider: DEFAULT_PROVIDER,
        budgetType: payload.budgetType || extractBudgetType(payload.budget),
        budgetAmount:
          payload.budgetAmount || extractBudgetAmount(payload.budget),
      }
    : {
        ...payload,
        notes: cleanImageAnalyzeNotes(payload.notes),
        provider: DEFAULT_PROVIDER,
        budgetType: payload.budgetType || extractBudgetType(payload.budget),
        budgetAmount:
          payload.budgetAmount || extractBudgetAmount(payload.budget),
      };

  if (Object.keys(nextPayload).length === 0) return;

  setFieldValue("keyword", nextPayload.keyword);
  setFieldValue("destination", nextPayload.destination);
  setFieldValue("departure", nextPayload.departure);
  setFieldValue("days", nextPayload.days);
  setFieldValue("people", nextPayload.people);
  setFieldValue(
    "budget",
    nextPayload.budgetAmount || extractBudgetAmount(nextPayload.budget),
  );
  setRadioValue(
    "budgetType",
    nextPayload.budgetType || extractBudgetType(nextPayload.budget),
  );
  setFieldValue("provider", DEFAULT_PROVIDER);
  setFieldValue("notes", nextPayload.notes);

  if (selectedSpot) {
    savePayload(nextPayload);
    sessionStorage.removeItem("selectedSpot");
    sessionStorage.removeItem("name");
  } else if (payload.notes !== nextPayload.notes) {
    // 예전 방식으로 저장된 자동 문구 제거 반영
    savePayload(nextPayload);
  }
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
