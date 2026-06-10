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
  const payload = loadPayload();
  if (!payload) return;

  setFieldValue("keyword", payload.keyword);
  setFieldValue("destination", payload.destination);
  setFieldValue("departure", payload.departure);
  setFieldValue("days", payload.days);
  setFieldValue("people", payload.people);
  setFieldValue("budget", payload.budget);
  setFieldValue("style", payload.style);
  setFieldValue("notes", payload.notes);
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
    style: String(formData.get("style") || "키워드가 여정에 포함된 여행"),
    notes: String(formData.get("notes") || "").trim(),
  };
}
