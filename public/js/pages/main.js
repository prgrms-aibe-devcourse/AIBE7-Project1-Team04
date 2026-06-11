import { saveItinerary, savePayload } from "./itinerary-state.js";
import { renderHeader } from "../components/header.js";
import { renderFooter } from "../components/footer.js";

const session = JSON.parse(localStorage.getItem("session") || "null");
const isLoggedIn = Boolean(session?.access_token);

init();

function init() {
  renderHeader({ active: "home" });
  renderFooter();
  setupHeroButtons();
  setupAccordion();

  if (isLoggedIn) {
    injectTripsSection();
  }
}

// ── Hero buttons (로그인 상태에 따라 CTA만 교체) ──
function setupHeroButtons() {
  const btns = document.getElementById("heroBtns");

  if (isLoggedIn) {
    btns.innerHTML = `
      <a href="/pages/image-location-analyze.html" class="btn-hero-outline">위치 기반 추천 시작</a>
      <a href="/pages/image-mood-analyze.html" class="btn-hero-fill">분위기 기반 추천 시작</a>
    `;
  } else {
    btns.innerHTML = `
      <a href="/pages/login.html" class="btn-hero-outline">로그인하고 사진 검색</a>
      <a href="/pages/itinerary-create.html" class="btn-hero-fill">서비스 둘러보기</a>
    `;
  }
}

// ── Accordion ──
function setupAccordion() {
  document
    .querySelectorAll("#howAccordion .accordion-trigger")
    .forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const item = trigger.closest(".accordion-item");
        const isOpen = item.classList.contains("open");
        document
          .querySelectorAll("#howAccordion .accordion-item")
          .forEach((i) => i.classList.remove("open"));
        if (!isOpen) item.classList.add("open");
      });
    });
}

// ── 로그인 후: 후기 섹션 위에 내 여행 일정 섹션 삽입 ──
function injectTripsSection() {
  const reviewSection = document.getElementById("reviewSection");

  const section = document.createElement("section");
  section.className = "section";
  section.id = "tripsSection";
  section.innerHTML = `
    <div class="container">
      <div class="section-row">
        <h2 class="section-title" style="margin-bottom:0;">내 여행 일정</h2>
        <a href="/pages/my-trips.html" class="section-row-link">전체 보기 →</a>
      </div>
      <div class="trips-grid" id="tripsGrid">
        <div class="trips-empty-main">불러오는 중...</div>
      </div>
    </div>
  `;

  reviewSection.before(section);
  loadRecentTrips();
}

async function loadRecentTrips() {
  const grid = document.getElementById("tripsGrid");

  try {
    const res = await fetch("/api/trips", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("session");
      window.location.reload();
      return;
    }

    const { trips } = await res.json();
    const recent = (trips || []).slice(0, 3);

    if (recent.length === 0) {
      grid.innerHTML = `
        <div class="trips-empty-main">
          아직 저장된 여행 일정이 없어요.<br>
          <a href="/pages/image-location-analyze.html" style="color:#2563eb;font-weight:600;margin-top:8px;display:inline-block;">여행지 탐색하기 →</a>
        </div>
      `;
      return;
    }

    grid.innerHTML = recent
      .map((t) => {
        const date = new Date(t.created_at).toLocaleDateString("ko-KR", {
          month: "long",
          day: "numeric",
        });
        const keyword = t.payload?.keyword || "";
        const days = t.payload?.days ? `${t.payload.days}일` : "";
        return `
        <div class="trip-card-main" data-id="${t.id}">
          <p class="trip-card-title">${escapeHtml(t.title)}</p>
          <div class="trip-card-tags">
            ${keyword ? `<span class="trip-tag">${escapeHtml(keyword)}</span>` : ""}
            ${days ? `<span class="trip-tag">${days}</span>` : ""}
          </div>
          <p class="trip-card-date">${date}</p>
        </div>
      `;
      })
      .join("");

    grid.querySelectorAll(".trip-card-main").forEach((card) => {
      card.addEventListener("click", () => viewTrip(card.dataset.id));
    });
  } catch (_err) {
    grid.innerHTML = '<div class="trips-empty-main">불러오지 못했습니다.</div>';
  }
}

async function viewTrip(id) {
  const res = await fetch(`/api/trips/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => null);
  if (!res?.ok) return;
  const { trip } = await res.json();
  savePayload(trip.payload || {});
  saveItinerary(trip.itinerary);
  window.location.href = "/pages/itinerary-result.html";
}

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
