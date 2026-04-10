(function () {
  "use strict";

  const NAV_LINKS = [
    { href: "/", label: "Home", key: "home" },
    { href: "/blog", label: "Blog", key: "blog" },
    { href: "/resume-template-builder", label: "Resume Builder", key: "resume-builder" },
  ];

  function inferActivePage(pathname) {
    if (!pathname || pathname === "/") return "home";
    if (pathname.startsWith("/blog")) return "blog";
    if (pathname.startsWith("/resume-template-builder")) return "resume-builder";
    return "";
  }

  function renderLinks(activePage) {
    return NAV_LINKS.map((link) => {
      const isActive = link.key === activePage;
      return `<a href="${link.href}" class="blog-nav-link${isActive ? " blog-nav-link--active" : ""}">${link.label}</a>`;
    }).join("");
  }

  function renderNavbarHtml(activePage) {
    return `
      <div class="blog-nav-shell" id="blogNavShell">
        <nav class="blog-nav" id="blogNav">
          <a href="/" class="blog-logo">&#10022; BulletAI</a>
          <button class="blog-nav-toggle" id="blogNavToggle" aria-label="Toggle navigation">
            <span></span><span></span><span></span>
          </button>
          <div class="blog-nav-actions" id="blogNavActions">
            ${renderLinks(activePage)}
            <button id="navAuthBtn" class="blog-nav-auth-btn" type="button" aria-label="Sign in to BulletAI">Sign In</button>
            <div id="navUserMenu" class="nav-user-menu" hidden>
              <button id="navUserMenuBtn" class="nav-user-avatar-btn" type="button" aria-expanded="false" aria-haspopup="true" aria-label="User menu">
                <span id="navUserAvatar" class="nav-user-avatar" aria-hidden="true"></span>
                <svg class="nav-user-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 4L5 7L8 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div id="navUserDropdown" class="nav-user-dropdown" hidden>
                <div class="nav-user-dropdown-header">
                  <p id="navUserEmail" class="nav-user-dropdown-email"></p>
                </div>
                <a href="/settings" class="nav-user-dropdown-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                  Settings
                </a>
                <button type="button" id="navSignOutBtn" class="nav-user-dropdown-item nav-user-dropdown-item--danger">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>
      </div>
    `;
  }

  class SiteNavbar extends HTMLElement {
    connectedCallback() {
      const explicit = this.getAttribute("active-page") || "";
      const activePage = explicit || inferActivePage(window.location.pathname);
      this.innerHTML = renderNavbarHtml(activePage);

      const navShell = this.querySelector("#blogNavShell");
      const nav = this.querySelector("#blogNav");
      const navToggle = this.querySelector("#blogNavToggle");
      const navActions = this.querySelector("#blogNavActions");
      if (!navShell || !nav || !navToggle || !navActions) return;

      navToggle.addEventListener("click", () => {
        navActions.classList.toggle("open");
        navToggle.classList.toggle("open");
      });

      let lastY = 0;
      window.addEventListener(
        "scroll",
        () => {
          const y = window.scrollY;
          navShell.classList.toggle("blog-nav-shell--scrolled", y > 24);
          lastY = y;
        },
        { passive: true }
      );
    }
  }

  if (!customElements.get("site-navbar")) {
    customElements.define("site-navbar", SiteNavbar);
  }
})();
