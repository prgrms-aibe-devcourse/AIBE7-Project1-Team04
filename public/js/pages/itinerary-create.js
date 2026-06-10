import { clearItinerary, loadPayload, savePayload } from "./itinerary-state.js";

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
  const imageAnalyzeSpotName = getImageAnalyzeSpotName();

  const nextPayload = imageAnalyzeSpotName
    ? {
        ...payload,
        keyword: imageAnalyzeSpotName,
        destination: imageAnalyzeSpotName,
        notes: payload.notes
          ? `${payload.notes}\n이미지 분석에서 선택한 여행지: ${imageAnalyzeSpotName}`
          : `이미지 분석에서 선택한 여행지: ${imageAnalyzeSpotName}`,
      }
    : payload;

  if (Object.keys(nextPayload).length === 0) return;

  setFieldValue("keyword", nextPayload.keyword);
  setFieldValue("destination", nextPayload.destination);
  setFieldValue("departure", nextPayload.departure);
  setFieldValue("days", nextPayload.days);
  setFieldValue("people", nextPayload.people);
  setFieldValue("budget", nextPayload.budget);
  setFieldValue("provider", nextPayload.provider);
  setFieldValue("notes", nextPayload.notes);

  if (imageAnalyzeSpotName) {
    savePayload(nextPayload);
    sessionStorage.removeItem("name");
  }
}

function getImageAnalyzeSpotName() {
  return String(sessionStorage.getItem("name") || "").trim();
}

function setFieldValue(name, value) {
  const field = form.elements[name];
  if (!field || value === undefined || value === null) return;

  field.value = value;
}

function getPayloadFromForm() {
  const formData = new FormData(form);
  return {
    keyword: String(formData.get("keyword") || "").trim(),
    destination: String(formData.get("destination") || "").trim(),
    departure: String(formData.get("departure") || "").trim(),
    days: Number(formData.get("days") || 3),
    people: Number(formData.get("people") || 2),
    budget: String(formData.get("budget") || "").trim(),
    provider: String(formData.get("provider") || "groq"),
    notes: String(formData.get("notes") || "").trim(),
  };
}
