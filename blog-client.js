/* ═══════════════════════════════════════════════════════════════════════════
   Blog Client – search, filter, sort, pagination, bookmarks, likes,
   comments, TOC scroll-spy, share & copy-link
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  // ─── Helpers ─────────────────────────────────────────────────────────
  function getBookmarks() {
    try { return JSON.parse(localStorage.getItem("blog_bookmarks") || "[]"); }
    catch { return []; }
  }
  function setBookmarks(arr) {
    localStorage.setItem("blog_bookmarks", JSON.stringify(arr));
  }

  // ─── Blog list page logic ───────────────────────────────────────────
  const grid = document.getElementById("blogGrid");
  const searchInput = document.getElementById("blogSearchInput");
  const catFilter = document.getElementById("blogCategoryFilter");
  const sortSelect = document.getElementById("blogSortSelect");
  const paginationEl = document.getElementById("blogPagination");

  if (grid && searchInput) {
    const POSTS_PER_PAGE = 6;
    let currentPage = 1;
    let allCards = Array.from(grid.querySelectorAll(".blog-card"));
    let filteredCards = allCards.slice();

    function applyFilters() {
      const query = (searchInput.value || "").toLowerCase().trim();
      const cat = catFilter ? catFilter.value : "";

      filteredCards = allCards.filter(card => {
        if (cat && card.dataset.category !== cat) return false;
        if (query) {
          const text = card.textContent.toLowerCase();
          const tags = (card.dataset.tags || "").toLowerCase();
          if (!text.includes(query) && !tags.includes(query)) return false;
        }
        return true;
      });

      // Sort
      const sort = sortSelect ? sortSelect.value : "newest";
      filteredCards.sort((a, b) => {
        if (sort === "oldest") return new Date(a.dataset.date) - new Date(b.dataset.date);
        if (sort === "az") return (a.querySelector(".blog-card-title")?.textContent || "").localeCompare(b.querySelector(".blog-card-title")?.textContent || "");
        return new Date(b.dataset.date) - new Date(a.dataset.date);
      });

      currentPage = 1;
      renderPage();
    }

    function renderPage() {
      const start = (currentPage - 1) * POSTS_PER_PAGE;
      const end = start + POSTS_PER_PAGE;

      allCards.forEach(c => c.style.display = "none");
      filteredCards.forEach((c, i) => {
        c.style.display = i >= start && i < end ? "" : "none";
      });

      renderPagination();
      syncBookmarkButtons();
    }

    function renderPagination() {
      if (!paginationEl) return;
      const total = Math.ceil(filteredCards.length / POSTS_PER_PAGE);
      if (total <= 1) { paginationEl.innerHTML = ""; return; }

      let html = "";
      if (currentPage > 1) html += `<button class="page-btn" data-page="${currentPage - 1}">&laquo; Prev</button>`;
      for (let i = 1; i <= total; i++) {
        html += `<button class="page-btn${i === currentPage ? " page-btn--active" : ""}" data-page="${i}">${i}</button>`;
      }
      if (currentPage < total) html += `<button class="page-btn" data-page="${currentPage + 1}">Next &raquo;</button>`;
      paginationEl.innerHTML = html;

      paginationEl.querySelectorAll(".page-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          currentPage = parseInt(btn.dataset.page, 10);
          renderPage();
          window.scrollTo({ top: grid.offsetTop - 100, behavior: "smooth" });
        });
      });
    }

    // Sync bookmark icons
    function syncBookmarkButtons() {
      const bookmarks = getBookmarks();
      document.querySelectorAll(".blog-card-bookmark").forEach(btn => {
        const isBookmarked = bookmarks.includes(btn.dataset.slug);
        btn.classList.toggle("bookmarked", isBookmarked);
        btn.querySelector("svg").style.fill = isBookmarked ? "currentColor" : "none";
      });
    }

    // Bookmark click
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest(".blog-card-bookmark");
      if (!btn) return;
      e.preventDefault();
      const slug = btn.dataset.slug;
      let bm = getBookmarks();
      if (bm.includes(slug)) bm = bm.filter(s => s !== slug);
      else bm.push(slug);
      setBookmarks(bm);
      syncBookmarkButtons();
    });

    // URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get("category") && catFilter) catFilter.value = params.get("category");
    if (params.get("tag")) searchInput.value = params.get("tag");

    searchInput.addEventListener("input", applyFilters);
    if (catFilter) catFilter.addEventListener("change", applyFilters);
    if (sortSelect) sortSelect.addEventListener("change", applyFilters);

    // Sidebar tag & category clicks
    document.querySelectorAll(".sidebar-tag").forEach(tag => {
      tag.addEventListener("click", (e) => {
        e.preventDefault();
        searchInput.value = tag.dataset.tag || tag.textContent.trim();
        if (catFilter) catFilter.value = "";
        applyFilters();
        grid.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    document.querySelectorAll(".sidebar-cat-link").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (catFilter) catFilter.value = link.dataset.category || "";
        searchInput.value = "";
        applyFilters();
        grid.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    applyFilters();
  }

  // ─── Blog post page logic ──────────────────────────────────────────
  const tocToggle = document.getElementById("tocToggle");
  const tocList = document.getElementById("tocList");
  if (tocToggle && tocList) {
    tocToggle.addEventListener("click", () => {
      tocList.classList.toggle("open");
      tocToggle.classList.toggle("open");
    });
    // Smooth scroll toc links
    tocList.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", (e) => {
        const target = document.querySelector(a.getAttribute("href"));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(null, "", a.getAttribute("href"));
        }
      });
    });

    // Scroll-spy
    const headings = [];
    tocList.querySelectorAll("a").forEach(a => {
      const id = a.getAttribute("href")?.slice(1);
      const el = id && document.getElementById(id);
      if (el) headings.push({ el, link: a });
    });

    if (headings.length) {
      function updateActive() {
        let active = headings[0];
        for (const h of headings) {
          if (h.el.getBoundingClientRect().top <= 120) active = h;
        }
        headings.forEach(h => h.link.classList.remove("toc-active"));
        if (active) active.link.classList.add("toc-active");
      }
      window.addEventListener("scroll", updateActive, { passive: true });
      updateActive();
    }
  }

  // Copy link
  const copyBtn = document.getElementById("copyLinkBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        const orig = copyBtn.innerHTML;
        copyBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => { copyBtn.innerHTML = orig; }, 2000);
      });
    });
  }

  // Bookmark on post page
  const bookmarkBtn = document.getElementById("bookmarkBtn");
  if (bookmarkBtn) {
    function syncPostBookmark() {
      const bm = getBookmarks();
      const isB = bm.includes(bookmarkBtn.dataset.slug);
      bookmarkBtn.classList.toggle("bookmarked", isB);
      bookmarkBtn.querySelector("svg").style.fill = isB ? "currentColor" : "none";
    }
    bookmarkBtn.addEventListener("click", () => {
      const slug = bookmarkBtn.dataset.slug;
      let bm = getBookmarks();
      if (bm.includes(slug)) bm = bm.filter(s => s !== slug);
      else bm.push(slug);
      setBookmarks(bm);
      syncPostBookmark();
    });
    syncPostBookmark();
  }

  // Like button (localStorage simple counter - no backend needed)
  const likeBtn = document.getElementById("likeBtn");
  const likeCount = document.getElementById("likeCount");
  if (likeBtn && likeCount) {
    const slug = likeBtn.dataset.slug;
    const key = "blog_likes";
    let likes;
    try { likes = JSON.parse(localStorage.getItem(key) || "{}"); } catch { likes = {}; }
    const count = likes[slug] || 0;
    likeCount.textContent = count;
    if (count > 0) {
      likeBtn.classList.add("liked");
      likeBtn.querySelector("svg").style.fill = "currentColor";
    }
    likeBtn.addEventListener("click", () => {
      const wasLiked = !!likes[slug];
      if (wasLiked) {
        delete likes[slug];
        likeBtn.classList.remove("liked");
        likeBtn.querySelector("svg").style.fill = "none";
      } else {
        likes[slug] = 1;
        likeBtn.classList.add("liked");
        likeBtn.querySelector("svg").style.fill = "currentColor";
      }
      localStorage.setItem(key, JSON.stringify(likes));
      likeCount.textContent = likes[slug] || 0;
    });
  }

  // Comments (localStorage)
  const commentSubmit = document.getElementById("commentSubmitBtn");
  const commentList = document.getElementById("commentList");
  const commentName = document.getElementById("commentName");
  const commentText = document.getElementById("commentText");
  if (commentSubmit && commentList && commentName && commentText) {
    const slug = commentSubmit.dataset.slug;
    const key = "blog_comments";
    let allComments;
    try { allComments = JSON.parse(localStorage.getItem(key) || "{}"); } catch { allComments = {}; }

    function renderComments() {
      const comments = allComments[slug] || [];
      if (!comments.length) {
        commentList.innerHTML = '<p class="blog-no-comments">No comments yet. Be the first to share your thoughts!</p>';
        return;
      }
      commentList.innerHTML = comments.map(c => `
        <div class="blog-comment">
          <div class="blog-comment-avatar">${escapeHtmlClient(c.name[0] || "?")}</div>
          <div class="blog-comment-body">
            <div class="blog-comment-header">
              <strong>${escapeHtmlClient(c.name)}</strong>
              <time>${new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>
            </div>
            <p>${escapeHtmlClient(c.text)}</p>
          </div>
        </div>
      `).join("");
    }

    commentSubmit.addEventListener("click", () => {
      const name = commentName.value.trim();
      const text = commentText.value.trim();
      if (!name || !text) return;
      if (!allComments[slug]) allComments[slug] = [];
      allComments[slug].unshift({ name, text, date: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(allComments));
      commentName.value = "";
      commentText.value = "";
      renderComments();
    });

    renderComments();
  }

  function escapeHtmlClient(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
