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

function renderHead({ title, description, canonicalUrl }) {
  return `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/blog.css" />
    <link rel="stylesheet" href="/auth.css" />
  `;
}

function renderNav() {
  return `
    <nav class="blog-nav">
      <a href="/" class="blog-logo">&#10022; BulletAI</a>
      <div class="blog-nav-actions">
        <a href="/" class="blog-nav-link">Bullet Generator</a>
        <a href="/resume-template-builder" class="blog-nav-link">Resume Template Builder</a>
        <button id="navAuthBtn" class="blog-nav-auth-btn" type="button" aria-label="Sign in to BulletAI">Sign In</button>
      </div>
    </nav>
  `;
}

function renderBlogCard(post) {
  return `
    <article class="blog-card">
      <p class="blog-card-date">${escapeHtml(formatDate(post.date))}</p>
      <h2 class="blog-card-title">${escapeHtml(post.title)}</h2>
      <p class="blog-card-excerpt">${escapeHtml(post.excerpt || post.description)}</p>
      <a class="blog-card-cta" href="/blog/${escapeHtml(post.slug)}">Read More</a>
    </article>
  `;
}

function renderBlogListPage(siteUrl, posts = blogPosts) {
  const cardsMarkup = posts
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((post) => renderBlogCard(post))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>${renderHead({
    title: "Resume Blog | BulletAI",
    description:
      "Actionable resume guides, template advice, and practical job-search writing tips to help you land interviews faster.",
    canonicalUrl: `${siteUrl}/blog`,
  })}
  </head>
  <body class="blog-body">
    ${renderNav()}

    <header class="blog-hero">
      <p class="blog-eyebrow">Career Writing Guides</p>
      <h1>Resume Advice That Helps You Get More Interviews</h1>
      <p class="blog-hero-sub">
        Browse practical, up-to-date guides on resume structure, templates, and writing mistakes to avoid.
      </p>
    </header>

    <main class="blog-main" aria-label="Blog posts">
      <section class="blog-grid">
        ${cardsMarkup}
      </section>
    </main>

    <footer class="blog-footer">
      <a href="/resume-template-builder">Build Your Resume Now</a>
      <a href="/jobs">Browse Job Resources</a>
    </footer>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
    <script src="/auth.js"></script>
  </body>
</html>`;
}

function renderPostContent(post) {
  if (!Array.isArray(post.sections) || !post.sections.length) {
    return renderMarkdownLike(post.content || "");
  }

  return post.sections
    .map((section) => {
      const paragraphs = (section.paragraphs || [])
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("\n");

      const subsections = (section.subsections || [])
        .map((subsection) => {
          const subParagraphs = (subsection.paragraphs || [])
            .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
            .join("\n");

          return `
            <section class="blog-subsection">
              <h3>${escapeHtml(subsection.heading)}</h3>
              ${subParagraphs}
            </section>
          `;
        })
        .join("\n");

      return `
        <section class="blog-section">
          <h2>${escapeHtml(section.heading)}</h2>
          ${paragraphs}
          ${subsections}
        </section>
      `;
    })
    .join("\n");
}

function renderMarkdownLike(content) {
  const lines = String(content || "").split(/\r?\n/);
  let html = "";
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<section class="blog-subsection"><h3>${escapeHtml(line.slice(4))}</h3></section>`;
      continue;
    }

    if (line.startsWith("## ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<section class="blog-section"><h2>${escapeHtml(line.slice(3))}</h2></section>`;
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${escapeHtml(line.slice(2))}</li>`;
      continue;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }

    html += `<p>${escapeHtml(line)}</p>`;
  }

  if (inList) {
    html += "</ul>";
  }

  return `<section class="blog-section">${html}</section>`;
}

function renderBlogPostPage(post, siteUrl) {
  const articleMarkup = renderPostContent(post);

  return `<!DOCTYPE html>
<html lang="en">
  <head>${renderHead({
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.description,
    canonicalUrl: `${siteUrl}/blog/${post.slug}`,
  })}
  </head>
  <body class="blog-body">
    ${renderNav()}

    <main class="blog-article-main">
      <article class="blog-article" aria-labelledby="post-title">
        <p class="blog-card-date">${escapeHtml(formatDate(post.date))}</p>
        <h1 id="post-title">${escapeHtml(post.title)}</h1>
        <p class="blog-intro">${escapeHtml(post.description || post.excerpt || "")}</p>

        ${articleMarkup}

        <aside class="blog-post-cta" aria-label="Resume builder call to action">
          <h2>Ready To Put This Advice Into Action?</h2>
          <p>Use our resume builder to create a polished, modern resume in minutes.</p>
          <a href="/resume-template-builder" class="blog-post-cta-btn">Build Your Resume Now</a>
        </aside>
      </article>
    </main>

    <footer class="blog-footer">
      <a href="/blog">More Resume Guides</a>
      <a href="/resume-template-builder">Resume Template Builder</a>
    </footer>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
    <script src="/auth.js"></script>
  </body>
</html>`;
}

const blogPostBySlug = Object.fromEntries(blogPosts.map((post) => [post.slug, post]));

module.exports = {
  blogPosts,
  blogPostBySlug,
  renderBlogCard,
  renderBlogListPage,
  renderBlogPostPage,
};
