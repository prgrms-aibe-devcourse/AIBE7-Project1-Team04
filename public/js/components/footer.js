function buildMarkup() {
  return `
    <footer class="main-footer">
      <div class="footer-inner">
        <div>
          <a href="/" class="footer-brand-logo" aria-label="PicTrip 홈">
            <img src="/assets/images/PicTrip-Logo-footer2.png" alt="PicTrip" class="footer-brand-logo-img" />
          </a>
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
            <li><a href="/pages/image-location-analyze.html">위치 기반 추천</a></li>
            <li><a href="/pages/image-mood-analyze.html">분위기 기반 추천</a></li>
            <li><a href="/pages/itinerary-create.html">여행 계획</a></li>
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
