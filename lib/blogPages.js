// Returns a plain-text excerpt of the given content, up to maxLength chars, ending at a word boundary.
function buildExcerpt(content, maxLength = 150) {
  if (!content || typeof content !== "string") return "";
  const plain = content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  let cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 40) cut = cut.slice(0, lastSpace);
  return cut + "...";
}

const blogPosts = require("../data/blogPosts");

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function estimateReadingTime(post) {
  let wordCount = 0;
  if (Array.isArray(post.sections)) {
    for (const s of post.sections) {
      for (const p of s.paragraphs || []) wordCount += p.split(/\s+/).length;
      for (const sub of s.subsections || []) {
        for (const p of sub.paragraphs || []) wordCount += p.split(/\s+/).length;
      }
    }
  } else if (post.content) {
    wordCount = String(post.content).split(/\s+/).length;
  }
  return Math.max(1, Math.ceil(wordCount / 238));
}

function getAllCategories(posts) {
  const cats = {};
  for (const p of posts) {
    if (p.category) cats[p.category] = (cats[p.category] || 0) + 1;
  }
  return Object.entries(cats).sort((a, b) => b[1] - a[1]);
}

function getAllTags(posts) {
  const tags = {};
  for (const p of posts) {
    for (const t of p.tags || []) tags[t] = (tags[t] || 0) + 1;
  }
  return Object.entries(tags).sort((a, b) => b[1] - a[1]);
}

function getRelatedPosts(currentPost, allPosts, max = 3) {
  const currentTags = new Set(currentPost.tags || []);
  const currentCat = currentPost.category;
  const scored = allPosts
    .filter((p) => p.slug !== currentPost.slug)
    .map((p) => {
      let score = 0;
      if (p.category === currentCat) score += 3;
      for (const t of p.tags || []) {
        if (currentTags.has(t)) score += 2;
      }
      return { post: p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((s) => s.post);
}

function slugifyHeading(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Rendering Helpers ───────────────────────────────────────────────────────

function renderHead({ title, description, canonicalUrl, ogImage, jsonLd }) {
  return `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ""}
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/blog.css" />
    <link rel="stylesheet" href="/auth.css" />
    ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
  `;
}

function renderNav(activePage) {
  return `<site-navbar active-page="${escapeHtml(activePage || "")}"></site-navbar>`;
}

function renderSidebar(allPosts) {
  const categories = getAllCategories(allPosts);
  const tags = getAllTags(allPosts);
  const recent = allPosts
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const catItems = categories
    .map(([cat, count]) =>
      `<li><a href="/blog?category=${encodeURIComponent(cat)}" class="sidebar-cat-link" data-category="${escapeHtml(cat)}">${escapeHtml(cat)} <span class="sidebar-count">${count}</span></a></li>`
    )
    .join("\n");

  const recentItems = recent
    .map(
      (p) =>
        `<li><a href="/blog/${escapeHtml(p.slug)}" class="sidebar-recent-link">${escapeHtml(p.title)}</a><span class="sidebar-recent-date">${escapeHtml(formatDate(p.date))}</span></li>`
    )
    .join("\n");

  const tagCloud = tags
    .slice(0, 20)
    .map(
      ([tag]) =>
        `<a href="/blog?tag=${encodeURIComponent(tag)}" class="sidebar-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</a>`
    )
    .join("\n");

  return `
    <aside class="blog-sidebar" aria-label="Blog sidebar">
      <div class="sidebar-section">
        <h3 class="sidebar-heading">Categories</h3>
        <ul class="sidebar-cat-list">${catItems}</ul>
      </div>
      <div class="sidebar-section">
        <h3 class="sidebar-heading">Recent Posts</h3>
        <ul class="sidebar-recent-list">${recentItems}</ul>
      </div>
      <div class="sidebar-section">
        <h3 class="sidebar-heading">Tags</h3>
        <div class="sidebar-tag-cloud">${tagCloud}</div>
      </div>
    </aside>
  `;
}

function renderBlogCard(post) {
  const readTime = estimateReadingTime(post);
  const imageMarkup = post.image
    ? `<img class="blog-card-image" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy" />`
    : `<div class="blog-card-image-placeholder"><span>${escapeHtml((post.category || "Blog")[0])}</span></div>`;
  const catMarkup = post.category
    ? `<span class="blog-card-cat">${escapeHtml(post.category)}</span>`
    : "";
  return `
    <article class="blog-card" data-slug="${escapeHtml(post.slug)}" data-category="${escapeHtml(post.category || "")}" data-tags="${escapeHtml((post.tags || []).join(","))}" data-date="${escapeHtml(post.date || "")}">
      <a href="/blog/${escapeHtml(post.slug)}" class="blog-card-image-link">
        ${imageMarkup}
      </a>
      <div class="blog-card-body">
        <div class="blog-card-meta">
          ${catMarkup}
          <span class="blog-card-date">${escapeHtml(formatDate(post.date))}</span>
          <span class="blog-card-read-time">${readTime} min read</span>
        </div>
        <h2 class="blog-card-title"><a href="/blog/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a></h2>
        <p class="blog-card-excerpt">${escapeHtml(post.excerpt || post.description)}</p>
        <div class="blog-card-footer">
          <a class="blog-card-cta" href="/blog/${escapeHtml(post.slug)}">Read More &rarr;</a>
          <button class="blog-card-bookmark" data-slug="${escapeHtml(post.slug)}" aria-label="Bookmark post" title="Save for later">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedPost(post) {
  const readTime = estimateReadingTime(post);
  const imageMarkup = post.image
    ? `<img class="featured-image" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy" />`
    : `<div class="featured-image-placeholder"><span>Featured</span></div>`;
  return `
    <section class="blog-featured" aria-label="Featured post">
      <a href="/blog/${escapeHtml(post.slug)}" class="featured-image-link">${imageMarkup}</a>
      <div class="featured-content">
        <div class="featured-meta">
          <span class="blog-card-cat">${escapeHtml(post.category || "Blog")}</span>
          <span class="blog-card-date">${escapeHtml(formatDate(post.date))}</span>
          <span class="blog-card-read-time">${readTime} min read</span>
        </div>
        <h2 class="featured-title"><a href="/blog/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a></h2>
        <p class="featured-excerpt">${escapeHtml(post.excerpt || post.description)}</p>
        <a class="featured-cta" href="/blog/${escapeHtml(post.slug)}">Read Article &rarr;</a>
      </div>
    </section>
  `;
}

// ─── Blog List Page ──────────────────────────────────────────────────────────

function renderBlogListPage(siteUrl, posts = blogPosts) {
  const sorted = posts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const featured = sorted.find((p) => p.featured) || sorted[0];
  const rest = sorted.filter((p) => p.slug !== (featured && featured.slug));
  const cardsMarkup = rest.map((post) => renderBlogCard(post)).join("\n");
  const featuredMarkup = featured ? renderFeaturedPost(featured) : "";

  const postsJsonData = JSON.stringify(
    sorted.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || p.description,
      category: p.category || "",
      tags: p.tags || [],
      date: p.date,
    }))
  );

  return `<!DOCTYPE html>
<html lang="en">
  <head>${renderHead({
    title: "Resume & Career Blog | BulletAI",
    description:
      "Actionable resume guides, interview tips, career growth strategies, and job-search writing advice to help you land interviews faster.",
    canonicalUrl: siteUrl + "/blog",
  })}
  </head>
  <body class="blog-body">
    ${renderNav("blog")}

    <header class="blog-hero">
      <p class="blog-eyebrow">Career Writing Guides</p>
      <h1>Resume Advice That Helps You Get More Interviews</h1>
      <p class="blog-hero-sub">
        Browse practical, up-to-date guides on resume structure, templates, interview prep, and career growth.
      </p>
    </header>

    ${featuredMarkup}

    <div class="blog-toolbar" id="blogToolbar">
      <div class="blog-search-wrap">
        <svg class="blog-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="blogSearchInput" class="blog-search-input" placeholder="Search articles..." aria-label="Search blog posts" />
      </div>
      <div class="blog-filters">
        <select id="blogCategoryFilter" class="blog-filter-select" aria-label="Filter by category">
          <option value="">All Categories</option>
          ${getAllCategories(sorted)
            .map(([cat]) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
            .join("\n")}
        </select>
        <select id="blogSortSelect" class="blog-filter-select" aria-label="Sort posts">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="az">A – Z</option>
        </select>
      </div>
    </div>

    <div class="blog-layout">
      <main class="blog-main" aria-label="Blog posts">
        <section class="blog-grid" id="blogGrid">
          ${cardsMarkup || '<p class="blog-empty">No posts available yet. Check back soon!</p>'}
        </section>
        <div class="blog-pagination" id="blogPagination"></div>
      </main>
      ${renderSidebar(sorted)}
    </div>

    <footer class="blog-footer">
      <div class="blog-footer-inner">
        <a href="/">&#10022; BulletAI</a>
        <a href="/resume-template-builder">Resume Builder</a>
        <a href="/jobs">Job Resources</a>
        <a href="/blog">Blog</a>
      </div>
    </footer>

    <script>window.__BLOG_POSTS__ = ${postsJsonData};</script>
    <script src="/shared-navbar.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
    <script src="/auth.js"></script>
    <script src="/blog-client.js"></script>
  </body>
</html>`;
}

// ─── Post Content Rendering ──────────────────────────────────────────────────

function renderPostContent(post) {
  if (!Array.isArray(post.sections) || !post.sections.length) {
    return renderMarkdownLike(post.content || "");
  }

  return post.sections
    .map((section) => {
      const id = slugifyHeading(section.heading);
      const paragraphs = (section.paragraphs || [])
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("\n");

      const subsections = (section.subsections || [])
        .map((subsection) => {
          const subId = slugifyHeading(subsection.heading);
          const subParagraphs = (subsection.paragraphs || [])
            .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
            .join("\n");

          return `
            <section class="blog-subsection">
              <h3 id="${escapeHtml(subId)}">${escapeHtml(subsection.heading)}</h3>
              ${subParagraphs}
            </section>
          `;
        })
        .join("\n");

      return `
        <section class="blog-section">
          <h2 id="${escapeHtml(id)}">${escapeHtml(section.heading)}</h2>
          ${paragraphs}
          ${subsections}
        </section>
      `;
    })
    .join("\n");
}

function renderTableOfContents(post) {
  if (!Array.isArray(post.sections) || !post.sections.length) return "";
  const items = post.sections
    .map((s) => {
      const id = slugifyHeading(s.heading);
      let html = `<li><a href="#${escapeHtml(id)}">${escapeHtml(s.heading)}</a>`;
      if (Array.isArray(s.subsections) && s.subsections.length) {
        const subItems = s.subsections
          .map((sub) => {
            const subId = slugifyHeading(sub.heading);
            return `<li><a href="#${escapeHtml(subId)}">${escapeHtml(sub.heading)}</a></li>`;
          })
          .join("");
        html += `<ul>${subItems}</ul>`;
      }
      html += "</li>";
      return html;
    })
    .join("\n");

  return `
    <nav class="blog-toc" aria-label="Table of contents">
      <button class="blog-toc-toggle" id="tocToggle">
        <span class="toc-toggle-icon">&#9776;</span> Table of Contents
        <span class="toc-toggle-arrow">&#9662;</span>
      </button>
      <ol class="blog-toc-list" id="tocList">${items}</ol>
    </nav>
  `;
}

function renderShareButtons(post, siteUrl) {
  const url = encodeURIComponent(siteUrl + "/blog/" + post.slug);
  const title = encodeURIComponent(post.title);
  return `
    <div class="blog-share" aria-label="Share this article">
      <span class="blog-share-label">Share</span>
      <a href="https://twitter.com/intent/tweet?url=${url}&text=${title}" target="_blank" rel="noopener noreferrer" class="blog-share-btn blog-share-twitter" aria-label="Share on Twitter">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${url}" target="_blank" rel="noopener noreferrer" class="blog-share-btn blog-share-linkedin" aria-label="Share on LinkedIn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      </a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${url}" target="_blank" rel="noopener noreferrer" class="blog-share-btn blog-share-facebook" aria-label="Share on Facebook">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      </a>
      <button class="blog-share-btn blog-share-copy" id="copyLinkBtn" aria-label="Copy link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      </button>
    </div>
  `;
}

function renderAuthorSection(post) {
  if (!post.author) return "";
  return `
    <div class="blog-author-box">
      <div class="blog-author-avatar">${escapeHtml(post.author[0] || "B")}</div>
      <div class="blog-author-info">
        <span class="blog-author-name">${escapeHtml(post.author)}</span>
        ${post.authorBio ? `<p class="blog-author-bio">${escapeHtml(post.authorBio)}</p>` : ""}
      </div>
    </div>
  `;
}

function renderRelatedPosts(related) {
  if (!related.length) return "";
  const cards = related
    .map((p) => {
      const readTime = estimateReadingTime(p);
      return `
      <a href="/blog/${escapeHtml(p.slug)}" class="related-card">
        <span class="related-cat">${escapeHtml(p.category || "Blog")}</span>
        <h4>${escapeHtml(p.title)}</h4>
        <span class="related-meta">${escapeHtml(formatDate(p.date))} &middot; ${readTime} min read</span>
      </a>`;
    })
    .join("\n");

  return `
    <section class="blog-related" aria-label="Related posts">
      <h3 class="blog-related-heading">Related Articles</h3>
      <div class="blog-related-grid">${cards}</div>
    </section>
  `;
}

function renderMarkdownLike(content) {
  const lines = String(content || "").split(/\r?\n/);
  let html = "";
  let inList = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { if (inList) { html += "</ul>"; inList = false; } continue; }
    if (line.startsWith("### ")) { if (inList) { html += "</ul>"; inList = false; } html += `<section class="blog-subsection"><h3>${escapeHtml(line.slice(4))}</h3></section>`; continue; }
    if (line.startsWith("## ")) { if (inList) { html += "</ul>"; inList = false; } html += `<section class="blog-section"><h2>${escapeHtml(line.slice(3))}</h2></section>`; continue; }
    if (line.startsWith("- ")) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${escapeHtml(line.slice(2))}</li>`; continue; }
    if (inList) { html += "</ul>"; inList = false; }
    html += `<p>${escapeHtml(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return `<section class="blog-section">${html}</section>`;
}

// ─── Blog Post Page ──────────────────────────────────────────────────────────

function renderBlogPostPage(post, siteUrl) {
  const articleMarkup = renderPostContent(post);
  const readTime = estimateReadingTime(post);
  const related = getRelatedPosts(post, blogPosts);
  const tagsMarkup = (post.tags || [])
    .map((t) => `<a href="/blog?tag=${encodeURIComponent(t)}" class="blog-post-tag">${escapeHtml(t)}</a>`)
    .join("");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription || post.description,
    datePublished: post.date,
    author: { "@type": "Organization", name: post.author || "BulletAI" },
    publisher: { "@type": "Organization", name: "BulletAI" },
    mainEntityOfPage: { "@type": "WebPage", "@id": siteUrl + "/blog/" + post.slug },
    ...(post.image ? { image: post.image } : {}),
  });

  return `<!DOCTYPE html>
<html lang="en">
  <head>${renderHead({
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.description,
    canonicalUrl: siteUrl + "/blog/" + post.slug,
    ogImage: post.image || null,
    jsonLd,
  })}
  </head>
  <body class="blog-body blog-body--post">
    ${renderNav("blog")}

    <div class="blog-post-topbar">
      <a href="/blog" class="blog-back-link">&larr; Back to Blog</a>
      <div class="blog-post-topbar-actions">
        <button class="blog-like-btn" id="likeBtn" data-slug="${escapeHtml(post.slug)}" aria-label="Like this post">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          <span id="likeCount">0</span>
        </button>
        <button class="blog-card-bookmark blog-bookmark-topbar" id="bookmarkBtn" data-slug="${escapeHtml(post.slug)}" aria-label="Bookmark this post">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
        </button>
      </div>
    </div>

    <div class="blog-post-layout">
      <main class="blog-article-main">
        <article class="blog-article" aria-labelledby="post-title">
          <div class="blog-article-meta">
            ${post.category ? `<a href="/blog?category=${encodeURIComponent(post.category)}" class="blog-card-cat">${escapeHtml(post.category)}</a>` : ""}
            <span class="blog-card-date">${escapeHtml(formatDate(post.date))}</span>
            <span class="blog-card-read-time">${readTime} min read</span>
          </div>
          <h1 id="post-title">${escapeHtml(post.title)}</h1>
          ${post.image ? `<img class="blog-article-image" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy" />` : ""}
          <p class="blog-intro">${escapeHtml(post.description || post.excerpt || "")}</p>

          ${renderTableOfContents(post)}

          ${articleMarkup}

          ${tagsMarkup ? `<div class="blog-post-tags">${tagsMarkup}</div>` : ""}

          ${renderShareButtons(post, siteUrl)}

          ${renderAuthorSection(post)}

          <aside class="blog-post-cta" aria-label="Resume builder call to action">
            <h2>Ready To Put This Advice Into Action?</h2>
            <p>Use our resume builder to create a polished, modern resume in minutes.</p>
            <a href="/resume-template-builder" class="blog-post-cta-btn">Build Your Resume Now</a>
          </aside>
        </article>

        ${renderRelatedPosts(related)}

        <section class="blog-comments" id="blogComments" aria-label="Comments">
          <h3 class="blog-comments-heading">Comments</h3>
          <div class="blog-comment-form-wrap">
            <input type="text" id="commentName" class="blog-comment-input" placeholder="Your name" maxlength="80" />
            <textarea id="commentText" class="blog-comment-textarea" placeholder="Share your thoughts..." maxlength="2000" rows="3"></textarea>
            <button id="commentSubmitBtn" class="blog-comment-submit" data-slug="${escapeHtml(post.slug)}">Post Comment</button>
          </div>
          <div class="blog-comment-list" id="commentList"></div>
        </section>
      </main>
    </div>

    <footer class="blog-footer">
      <div class="blog-footer-inner">
        <a href="/">&#10022; BulletAI</a>
        <a href="/resume-template-builder">Resume Builder</a>
        <a href="/blog">Blog</a>
      </div>
    </footer>

    <script src="/shared-navbar.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
    <script src="/auth.js"></script>
    <script src="/blog-client.js"></script>
  </body>
</html>`;
}

const blogPostBySlug = Object.fromEntries(blogPosts.map((post) => [post.slug, post]));

module.exports = {
  blogPosts,
  blogPostBySlug,
  buildExcerpt,
  renderBlogCard,
  renderBlogListPage,
  renderBlogPostPage,
  estimateReadingTime,
  getAllCategories,
  getAllTags,
};
