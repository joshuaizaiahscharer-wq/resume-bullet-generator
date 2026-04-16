(function () {
  "use strict";

  const NAV_LINKS = [
    { href: "/", label: "Home", key: "home" },
    { href: "/blog", label: "Blog", key: "blog" },
    { href: "/resume-template-builder", label: "Resume Builder", key: "resume-builder" },
    { href: "/check-my-resume", label: "Check My Resume", key: "check-my-resume" },
    { href: "/about", label: "About", key: "about" },
  ];

  function inferActivePage(pathname) {
    if (!pathname || pathname === "/") return "home";
    if (pathname.startsWith("/about")) return "about";
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
          <a href="/" class="blog-logo" aria-label="BulletAI Home">
            <img src="/Bullet_AI_logo2.0.jpg" alt="BulletAI" class="blog-logo-img" />
          </a>
          <div class="blog-nav-center">
            ${renderLinks(activePage)}
          </div>
          <button class="blog-nav-toggle" id="blogNavToggle" aria-label="Toggle navigation">
            <span></span><span></span><span></span>
          </button>
          <div class="blog-nav-actions" id="blogNavActions">
            <a id="navAuthBtn" href="#" class="blog-nav-login-btn" aria-label="Sign in to BulletAI">Log in</a>
          </div>
        </nav>
      </div>
    `;
  }

  function updateAuthBtn(user) {
    const btn = document.getElementById("navAuthBtn");
    if (!btn) return;
    if (user) {
      const email = user.email || "";
      btn.textContent = "Sign Out";
      btn.dataset.state = "signed-in";
      btn.setAttribute("aria-label", "Signed in" + (email ? " as " + email : "") + ". Click to sign out.");
      btn.title = "Sign out";
      btn.href = "#";
    } else {
      btn.textContent = "Log in";
      btn.dataset.state = "signed-out";
      btn.setAttribute("aria-label", "Sign in to BulletAI");
      btn.title = "";
      btn.href = "#";
    }
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

      fetch("/api/auth/user", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((user) => updateAuthBtn(user))
        .catch(() => updateAuthBtn(null));

      document.addEventListener("bulletauth:change", (e) => {
        updateAuthBtn(e.detail && e.detail.user);
      });
    }
  }

  if (!customElements.get("site-navbar")) {
    customElements.define("site-navbar", SiteNavbar);
  }
})();
