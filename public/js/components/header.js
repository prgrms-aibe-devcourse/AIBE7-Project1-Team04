const NAV_ITEMS = [
  { key: "home", href: "/", label: "홈" },
  {
    key: "image-location-analyze",
    href: "/pages/image-location-analyze.html",
    label: "위치 기반 추천",
  },
  {
    key: "image-mood-analyze",
    href: "/pages/image-mood-analyze.html",
    label: "분위기 기반 추천",
  },
  {
    key: "itinerary-create",
    href: "/pages/itinerary-create.html",
    label: "여행 계획",
    entryMode: "fresh",
  },
  { key: "my-trips", href: "/pages/my-trips.html", label: "마이페이지" },
];

function getSession() {
  try {
    return JSON.parse(localStorage.getItem("session") || "null");
  } catch {
    return null;
  }
}

function getNickname(session) {
  return (
    session?.user?.user_metadata?.nickname ||
    session?.user?.email?.split("@")[0] ||
    "사용자"
  );
}

function buildMarkup(active) {
  const navHtml = NAV_ITEMS.map((item) => {
    const activeClass = item.key === active ? ' class="nav-active"' : "";
    const entryModeAttr = item.entryMode
      ? ` data-planner-entry="${item.entryMode}"`
      : "";

    return `
    <li>
      <a href="${item.href}"${activeClass}${entryModeAttr}>
        ${item.label}
      </a>
    </li>
  `;
  }).join("");

  return `
    <header class="main-header">
      <div class="main-header-inner">
        <a href="/" class="header-logo">
          <svg viewBox="0 0 36 36" fill="none">
            <circle cx="10" cy="10" r="4.5" fill="#2563eb"/>
            <circle cx="26" cy="10" r="4.5" fill="#2563eb"/>
            <circle cx="10" cy="26" r="4.5" fill="#2563eb"/>
            <circle cx="26" cy="26" r="4.5" fill="#2563eb"/>
            <line x1="10" y1="10" x2="26" y2="10" stroke="#2563eb" stroke-width="1.5"/>
            <line x1="10" y1="10" x2="10" y2="26" stroke="#2563eb" stroke-width="1.5"/>
            <line x1="26" y1="10" x2="26" y2="26" stroke="#2563eb" stroke-width="1.5"/>
            <line x1="10" y1="26" x2="26" y2="26" stroke="#2563eb" stroke-width="1.5"/>
            <line x1="10" y1="10" x2="26" y2="26" stroke="#2563eb" stroke-width="1" stroke-dasharray="2 2"/>
            <line x1="26" y1="10" x2="10" y2="26" stroke="#2563eb" stroke-width="1" stroke-dasharray="2 2"/>
          </svg>
        </a>

        <ul class="header-nav">${navHtml}</ul>

        <div class="header-right">
          <div id="guestActions">
            <a href="/pages/login.html" class="btn-nav-outline">로그인</a>
            <a href="/pages/signup.html" class="btn-nav-fill" style="margin-left:8px;">회원가입</a>
          </div>
          <div class="user-menu hidden" id="userActions">
            <button class="user-menu-trigger" id="userTrigger" type="button">
              <div class="user-avatar" id="userAvatar">U</div>
              <span id="userNickname">사용자</span>
              <svg class="accordion-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="user-menu-dropdown" id="userDropdown">
              <a href="/pages/my-trips.html">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                내 여행 목록
              </a>
              <hr/>
              <button id="logoutBtn" class="danger-item" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

function bindAuthUi(session) {
  const isLoggedIn = Boolean(session?.access_token);
  if (!isLoggedIn) return;

  document.getElementById("guestActions")?.classList.add("hidden");
  document.getElementById("userActions")?.classList.remove("hidden");

  const nickname = getNickname(session);
  const nickEl = document.getElementById("userNickname");
  const avatarEl = document.getElementById("userAvatar");
  if (nickEl) nickEl.textContent = nickname;
  if (avatarEl) avatarEl.textContent = nickname.charAt(0).toUpperCase();

  document.getElementById("userTrigger")?.addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("userDropdown")?.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    document.getElementById("userDropdown")?.classList.remove("open");
  });

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("session");
    window.location.href = "/";
  });
}

function bindPlannerEntryLinks() {
  document.querySelectorAll("[data-planner-entry]").forEach((link) => {
    link.addEventListener("click", () => {
      const entryMode = link.dataset.plannerEntry;

      sessionStorage.setItem("itineraryEntryMode", entryMode);

      if (entryMode === "fresh") {
        sessionStorage.removeItem("selectedSpot");
        sessionStorage.removeItem("name");
      }
    });
  });
}

export function renderHeader({ active = null, mount = "#site-header" } = {}) {
  const target =
    typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!target) return null;

  const session = getSession();

  target.innerHTML = buildMarkup(active);

  bindAuthUi(session);
  bindPlannerEntryLinks();

  return { session, isLoggedIn: Boolean(session?.access_token) };
}
