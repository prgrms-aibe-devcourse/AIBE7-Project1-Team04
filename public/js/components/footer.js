function buildMarkup() {
  return `
    <footer class="main-footer">
      <div class="footer-inner">
        <div>
          <div class="footer-brand-logo">
            <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
              <circle cx="10" cy="10" r="4.5" fill="#fff"/>
              <circle cx="26" cy="10" r="4.5" fill="#fff"/>
              <circle cx="10" cy="26" r="4.5" fill="#fff"/>
              <circle cx="26" cy="26" r="4.5" fill="#fff"/>
              <line x1="10" y1="10" x2="26" y2="10" stroke="#fff" stroke-width="1.5"/>
              <line x1="10" y1="10" x2="10" y2="26" stroke="#fff" stroke-width="1.5"/>
              <line x1="26" y1="10" x2="26" y2="26" stroke="#fff" stroke-width="1.5"/>
              <line x1="10" y1="26" x2="26" y2="26" stroke="#fff" stroke-width="1.5"/>
            </svg>
            PicTrip
          </div>
          <p class="footer-brand-desc">당신의 여행을 더 특별하게,<br>맞춤 여행 추천 서비스</p>
          <div class="footer-socials">
            <a href="#" class="footer-social">X</a>
            <a href="#" class="footer-social">In</a>
            <a href="#" class="footer-social">▶</a>
          </div>
        </div>

        <div>
          <p class="footer-col-title">서비스</p>
          <ul class="footer-col-links">
            <li><a href="/pages/image-analyze.html">이미지 검색</a></li>
            <li><a href="/pages/itinerary-create.html">여행 계획</a></li>
            <li><a href="#">커뮤니티</a></li>
            <li><a href="/pages/my-trips.html">마이페이지</a></li>
          </ul>
        </div>

        <div>
          <p class="footer-col-title">고객센터</p>
          <ul class="footer-col-links">
            <li><a href="#">공지사항</a></li>
            <li><a href="#">FAQ</a></li>
            <li><a href="#">문의하기</a></li>
          </ul>
        </div>

        <div>
          <p class="footer-col-title">회사 정보</p>
          <ul class="footer-col-links">
            <li><a href="#">이용약관</a></li>
            <li><a href="#">개인정보처리방침</a></li>
          </ul>
        </div>
      </div>
    </footer>
  `;
}

export function renderFooter({ mount = "#site-footer" } = {}) {
  const target =
    typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!target) return;
  target.innerHTML = buildMarkup();
}
