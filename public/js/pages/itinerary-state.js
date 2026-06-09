const PAYLOAD_KEY = "PicTrip.payload";
const ITINERARY_KEY = "PicTrip.itinerary";

export function savePayload(payload) {
  sessionStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload));
}

export function loadPayload() {
  return readJson(PAYLOAD_KEY);
}

export function saveItinerary(itinerary) {
  sessionStorage.setItem(ITINERARY_KEY, JSON.stringify(itinerary));
}

export function loadItinerary() {
  return readJson(ITINERARY_KEY);
}

export function clearItinerary() {
  sessionStorage.removeItem(ITINERARY_KEY);
}

function readJson(key) {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    sessionStorage.removeItem(key);
    return null;
  }
}
