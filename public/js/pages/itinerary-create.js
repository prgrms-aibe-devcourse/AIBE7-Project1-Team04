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

  const basePayload = {
    ...payload,
    notes: cleanImageAnalyzeNotes(payload.notes),
    provider: DEFAULT_PROVIDER,

    budgetAmount: payload.budgetAmount || extractBudgetAmount(payload.budget),
    budgetType: payload.budgetType || extractBudgetType(payload.budget),
  };

  const nextPayload = selectedSpot
    ? {
        ...basePayload,

        // selectedSpot.name → keyword
        keyword: selectedSpot.name,

        // selectedSpot.region → destination
        destination: selectedSpot.region || selectedSpot.name,

        // 이미지 분석에서 새로 넘어온 경우 추가 조건 초기화
        notes: "",
      }
    : basePayload;

  if (Object.keys(nextPayload).length === 0) return;

  setFieldValue("keyword", nextPayload.keyword);
  setFieldValue("destination", nextPayload.destination);
  setFieldValue("departure", nextPayload.departure);
  setFieldValue("days", nextPayload.days);
  setFieldValue("people", nextPayload.people);

  setFieldValue("budgetAmount", nextPayload.budgetAmount);
  setRadioValue("budgetType", nextPayload.budgetType || "perPerson");

  setFieldValue("provider", DEFAULT_PROVIDER);

  // selectedSpot이 있으면 여기서 빈 문자열이 들어가므로 textarea가 초기화됨
  setFieldValue("notes", nextPayload.notes);

  if (selectedSpot) {
    savePayload(nextPayload);
    sessionStorage.removeItem("selectedSpot");
    sessionStorage.removeItem("name");
    return;
  }

  const shouldSave =
    payload.notes !== nextPayload.notes ||
    payload.provider !== DEFAULT_PROVIDER ||
    (!payload.budgetAmount && Boolean(payload.budget));

  if (shouldSave) {
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
