import { loadItinerary, loadPayload, savePayload } from "./itinerary-state.js";

const CREATE_PAGE_URL = "./itinerary-create.html";
const LOADING_PAGE_URL = "./itinerary-loading.html";

const DOT_COLORS = ["#8e5cff", "#ff5c68", "#22c7b8", "#2f86ff"];

const resultContainer = document.querySelector("#resultContainer");
const shareButton = document.querySelector("#shareButton");
const retryButton = document.querySelector("#retryButton");

const payload = loadPayload();
const itinerary = loadItinerary();

initResultPage();

function initResultPage() {
  if (!resultContainer) {
    console.error("#resultContainer 요소를 찾을 수 없습니다.");
    return;
  }

  if (!payload?.keyword) {
    renderEmptyState(
      "저장된 여행 조건이 없어요.",
      "조건 입력 페이지에서 키워드와 조건을 먼저 입력해 주세요.",
      CREATE_PAGE_URL,
      "조건 입력하기",
    );
    bindCommonEvents();
    return;
  }

  if (!itinerary) {
    renderEmptyState(
      "생성된 여행 일정이 없어요.",
      "AI 생성 페이지로 이동해 일정을 먼저 만들어 주세요.",
      LOADING_PAGE_URL,
      "일정 생성하기",
    );
    bindCommonEvents();
    return;
  }

  renderItinerary({
    container: resultContainer,
    itinerary,
    onRegenerate: (refineText, previousItinerary) => {
      const nextPayload = {
        ...payload,
        refineText,
        previousItinerary,
      };

      savePayload(nextPayload);
      window.location.href = LOADING_PAGE_URL;
    },
  });

  bindCommonEvents();
}

function bindCommonEvents() {
  retryButton?.addEventListener("click", (event) => {
    if (!payload?.keyword) {
      event.preventDefault();
      showToast("먼저 여행 조건을 입력해 주세요.");
    }
  });

  shareButton?.addEventListener("click", handleShare);
}

async function handleShare() {
  const text = itinerary
    ? `${itinerary.headline || "AI 맞춤 여행 일정"}\n${itinerary.summary || ""}`.trim()
    : "AI 맞춤 여행 일정";

  try {
    if (navigator.share) {
      await navigator.share({
        title: "AI 맞춤 여행 일정",
        text,
      });
      return;
    }

    await navigator.clipboard.writeText(text);
    showToast("현재 일정을 클립보드에 복사했어요.");
  } catch (_error) {
    showToast("공유를 취소했어요.");
  }
}

function renderItinerary({ container, itinerary, onRegenerate }) {
  container.innerHTML = "";

  const screen = document.createElement("article");
  screen.className = "result-screen";

  screen.append(
    createResultHero(itinerary),
    createMapStrip(itinerary),
    createDayTabs(itinerary),
    createTimeline(itinerary),
    createTipsBox(itinerary),
    createFeedbackBox(itinerary, onRegenerate),
  );

  container.append(screen);
  bindDayTabs(screen);
}

function createResultHero(itinerary) {
  const hero = document.createElement("div");
  hero.className = "result-hero";

  const headline =
    itinerary.headline ||
    `${itinerary.destinationTitle || "여행지"}, 추천일정입니다.`;

  const highlighted = highlightLastWord(headline);

  hero.innerHTML = `
    <div class="result-avatar" aria-hidden="true"></div>
    <h2>${highlighted}</h2>
    <p>${escapeHtml(
      itinerary.subTitle || "AI가 알려준 맞춤일정으로 여행을 떠나보세요.",
    )}</p>
  `;

  if (itinerary.notice) {
    const notice = document.createElement("div");
    notice.className = "notice-box";
    notice.textContent = itinerary.notice;
    hero.append(notice);
  }

  if (itinerary.summary) {
    const summary = document.createElement("p");
    summary.textContent = itinerary.summary;
    hero.append(summary);
  }

  return hero;
}

function createMapStrip(itinerary) {
  const map = document.createElement("div");
  map.className = "map-strip";
  map.setAttribute("aria-label", "추천 코스 지도 요약");

  const firstDayItems = itinerary.days?.[0]?.items || [];
  const markerCount = Math.min(4, firstDayItems.length || 4);

  for (let i = 0; i < markerCount; i += 1) {
    const marker = document.createElement("span");
    marker.className = "map-marker";
    marker.textContent = String(i + 1);
    marker.style.background = DOT_COLORS[i % DOT_COLORS.length];
    map.append(marker);
  }

  const label = document.createElement("span");
  label.className = "map-label";
  label.textContent =
    itinerary.mapLabel || `${itinerary.destinationTitle || "여행지"} 주요 코스`;

  map.append(label);

  return map;
}

function createDayTabs(itinerary) {
  const tabs = document.createElement("div");
  tabs.className = "day-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "일차 선택");

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];

  days.forEach((day, index) => {
    const button = document.createElement("button");
    button.className = `day-tab${index === 0 ? " is-active" : ""}`;
    button.type = "button";
    button.role = "tab";
    button.dataset.day = String(day.day || index + 1);
    button.setAttribute("aria-selected", index === 0 ? "true" : "false");
    button.textContent = `Day ${day.day || index + 1}`;
    tabs.append(button);
  });

  return tabs;
}

function createTimeline(itinerary) {
  const wrapper = document.createElement("div");
  wrapper.className = "timeline";

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];

  if (days.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-description";
    empty.textContent = "표시할 일정이 없습니다.";
    wrapper.append(empty);
    return wrapper;
  }

  days.forEach((day, index) => {
    const dayNumber = day.day || index + 1;

    const panel = document.createElement("section");
    panel.className = "day-panel";
    panel.dataset.dayPanel = String(dayNumber);
    panel.hidden = index !== 0;

    const title = document.createElement("div");
    title.className = "day-title";
    title.innerHTML = `
      <h3>${escapeHtml(day.title || `Day ${dayNumber}`)}</h3>
      <p>${escapeHtml(day.theme || "")}</p>
    `;

    const list = document.createElement("ol");
    list.className = "timeline-list";

    const items = Array.isArray(day.items) ? day.items : [];

    items.forEach((item, itemIndex) => {
      list.append(createTimelineItem(item, itemIndex));
    });

    panel.append(title, list);
    wrapper.append(panel);
  });

  return wrapper;
}

function createTimelineItem(item, index) {
  const li = document.createElement("li");
  li.className = "timeline-item";

  const order = item.order || index + 1;
  const meta = [item.category, item.area].filter(Boolean).join(" · ");
  const chips = [item.duration, item.budgetHint].filter(Boolean);

  li.innerHTML = `
    <span class="timeline-dot">${escapeHtml(order)}</span>
    <p class="timeline-heading">${escapeHtml(item.sectionTitle || "추천 코스")}</p>
    <div class="place-card">
      <div class="card-thumb card-thumb--placeholder" aria-hidden="true">
        ${getIconByCategory(item.category)}
      </div>
      <div>
        <h4>${escapeHtml(item.placeName || "추천 장소")}</h4>
        <p class="place-meta">${escapeHtml(meta)}</p>
        <p class="place-reason">
          <strong>추천</strong>
          ${escapeHtml(item.reason || "조건에 맞춰 추천된 장소입니다.")}
        </p>
        <div class="place-extra">
          ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
        </div>
      </div>
    </div>
  `;

  return li;
}

function createTipsBox(itinerary) {
  const box = document.createElement("section");
  box.className = "tips-box";

  const tips =
    Array.isArray(itinerary.tips) && itinerary.tips.length > 0
      ? itinerary.tips
      : ["편한 신발과 보조 배터리를 준비하면 좋습니다."];

  box.innerHTML = `
    <h3>여행 전 확인하면 좋은 팁</h3>
    <ul>
      ${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}
    </ul>
  `;

  if (itinerary.estimatedBudget) {
    const budget = document.createElement("p");
    budget.className = "estimated-budget";
    budget.textContent = `예상 예산: ${itinerary.estimatedBudget}`;
    box.append(budget);
  }

  return box;
}

function createFeedbackBox(itinerary, onRegenerate) {
  const box = document.createElement("section");
  box.className = "feedback-box";

  box.innerHTML = `
    <span class="heart" aria-hidden="true">💖</span>
    <h3>추천일정이 마음에 드세요?</h3>
    <p>
      만족하면 텍스트 파일로 저장하고, 아쉬운 점이 있으면 추가 요청을 입력해 다시 생성할 수 있어요.
    </p>
    <div class="feedback-actions">
      <button class="secondary-button" type="button" data-action="save">
        내 텍스트 파일로 저장
      </button>
      <button class="ghost-button" type="button" data-action="open-refine">
        아쉬운 점 입력하기
      </button>
    </div>
    <div class="refine-panel" hidden>
      <label for="refineText">추가 설명</label>
      <textarea
        id="refineText"
        placeholder="예: 걷는 거리를 줄이고, 저녁에는 야경 코스를 넣어줘"
      ></textarea>
      <button class="primary-button" type="button" data-action="regenerate">
        재생성 요청
      </button>
    </div>
  `;

  box.querySelector('[data-action="save"]')?.addEventListener("click", () => {
    downloadItineraryAsText(itinerary);
    showToast("텍스트 파일 저장을 시작했어요.");
  });

  box
    .querySelector('[data-action="open-refine"]')
    ?.addEventListener("click", () => {
      const panel = box.querySelector(".refine-panel");
      panel.hidden = !panel.hidden;

      if (!panel.hidden) {
        panel.querySelector("textarea")?.focus();
      }
    });

  box
    .querySelector('[data-action="regenerate"]')
    ?.addEventListener("click", () => {
      const refineText = box.querySelector("#refineText")?.value.trim();

      if (!refineText) {
        showToast("재생성 요청 내용을 입력해 주세요.");
        return;
      }

      onRegenerate(refineText, itinerary);
    });

  return box;
}

function bindDayTabs(screen) {
  const tabs = screen.querySelectorAll(".day-tab");
  const panels = screen.querySelectorAll(".day-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const selectedDay = tab.dataset.day;

      tabs.forEach((item) => {
        const isActive = item === tab;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      panels.forEach((panel) => {
        panel.hidden = panel.dataset.dayPanel !== selectedDay;
      });
    });
  });
}

function renderEmptyState(
  title,
  description,
  href = CREATE_PAGE_URL,
  label = "조건 입력하기",
) {
  resultContainer.innerHTML = `
    <article class="empty-state">
      <div class="result-avatar" aria-hidden="true"></div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <a class="primary-button empty-state__button" href="${escapeHtml(href)}">
        ${escapeHtml(label)}
      </a>
    </article>
  `;
}

function downloadItineraryAsText(itinerary) {
  const text = createItineraryText(itinerary);
  const blob = new Blob([text], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  const fileName = `${
    itinerary.destinationTitle || itinerary.keyword || "ai-travel-plan"
  }.txt`;

  anchor.href = url;
  anchor.download = sanitizeFileName(fileName);
  anchor.click();

  URL.revokeObjectURL(url);
}

function createItineraryText(itinerary) {
  const lines = [];

  lines.push(itinerary.headline || "AI 맞춤 여행 일정");
  lines.push("");
  lines.push(itinerary.subTitle || "");
  lines.push(itinerary.summary || "");
  lines.push("");

  if (itinerary.estimatedBudget) {
    lines.push(`[예상 예산] ${itinerary.estimatedBudget}`);
    lines.push("");
  }

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];

  days.forEach((day, index) => {
    lines.push(`Day ${day.day || index + 1}. ${day.title || ""}`);
    if (day.theme) {
      lines.push(`테마: ${day.theme}`);
    }

    const items = Array.isArray(day.items) ? day.items : [];

    items.forEach((item, itemIndex) => {
      lines.push("");
      lines.push(
        `${item.order || itemIndex + 1}. ${item.placeName || "추천 장소"}`,
      );

      if (item.sectionTitle) {
        lines.push(`- 섹션: ${item.sectionTitle}`);
      }

      if (item.category || item.area) {
        lines.push(
          `- 분류: ${[item.category, item.area].filter(Boolean).join(" · ")}`,
        );
      }

      if (item.reason) {
        lines.push(`- 추천 이유: ${item.reason}`);
      }

      if (item.duration) {
        lines.push(`- 예상 소요 시간: ${item.duration}`);
      }

      if (item.budgetHint) {
        lines.push(`- 예상 비용: ${item.budgetHint}`);
      }
    });

    lines.push("");
  });

  if (Array.isArray(itinerary.tips) && itinerary.tips.length > 0) {
    lines.push("[여행 팁]");
    itinerary.tips.forEach((tip) => {
      lines.push(`- ${tip}`);
    });
  }

  return lines.filter((line) => line !== undefined && line !== null).join("\n");
}

function sanitizeFileName(fileName) {
  return String(fileName)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
}

function highlightLastWord(text) {
  const safe = escapeHtml(text);
  const parts = safe.split(" ");

  if (parts.length < 2) {
    return `<strong>${safe}</strong>`;
  }

  const last = parts.pop();
  return `${parts.join(" ")}<br /><strong>${last}</strong>`;
}

function getIconByCategory(category = "") {
  if (category.includes("음식")) return "🍽️";
  if (category.includes("카페")) return "☕";
  if (category.includes("숙소")) return "🏨";
  if (category.includes("이동")) return "✈️";
  if (category.includes("체험")) return "🎟️";
  return "🗺️";
}

function showToast(message) {
  const oldToast = document.querySelector(".toast");
  oldToast?.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  document.body.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2400);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
