(function () {
  "use strict";

  const NAV_LINKS = [
    { href: "/", label: "Home", key: "home" },
    { href: "/check-my-resume", label: "Check My Resume", key: "check-my-resume" },
    { href: "/blog", label: "Blog", key: "blog" },
    { href: "/resume-template-builder", label: "Resume Builder", key: "resume-builder" },
  ];

  function inferActivePage(pathname) {
    if (!pathname || pathname === "/") return "home";
    if (pathname.startsWith("/check-my-resume")) return "check-my-resume";
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
