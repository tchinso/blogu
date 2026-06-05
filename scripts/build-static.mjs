import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import markdownItDeflist from "markdown-it-deflist";
import markdownItMark from "markdown-it-mark";
import markdownItTaskLists from "markdown-it-task-lists";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "_site");

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.join("=")];
  })
);

const site = {
  title: "NyanKat's blog",
  description: "냥캣의 블로그",
  lang: "ko",
  url: args.url ?? "https://blogu.pages.dev",
  baseurl: args.baseurl ?? "",
  defaultThumbnail: "assets/images/profile/mascot.png"
};

const navItems = [
  ["Home", ""],
  ["Archive", "archive/"],
  ["Tags", "tags/"],
  ["Projects", "projects/"],
  ["About", "about/"]
];

const md = new MarkdownIt({ html: true, linkify: true, typographer: true })
  .use(markdownItFootnote)
  .use(markdownItDeflist)
  .use(markdownItMark)
  .use(markdownItTaskLists, { enabled: true, label: true });

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const stripLeadingSlash = (value) => String(value).replace(/^\/+/, "");

const relativeUrl = (value = "") => {
  if (/^(https?:)?\/\//.test(value)) return value;
  const clean = stripLeadingSlash(value);
  const base = site.baseurl.replace(/\/$/, "");
  if (!clean) return `${base || ""}/`;
  return `${base}/${clean}`.replace(/\/{2,}/g, "/");
};

const absoluteUrl = (value = "") => `${site.url.replace(/\/$/, "")}${relativeUrl(value)}`;

const renderLiquidLite = (text) =>
  text.replace(/\{\{\s*['"]([^'"]+)['"]\s*\|\s*relative_url\s*\}\}/g, (_, target) => relativeUrl(target));

function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, body: text };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    }
    data[key] = value;
  }

  return { data, body: match[2] };
}

async function readMarkdown(filePath) {
  const fullPath = path.join(root, filePath);
  let source;
  try {
    source = await fs.readFile(fullPath, "utf8");
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
  return parseFrontMatter(source);
}

function dateDots(date) {
  return String(date || "").replaceAll("-", ".");
}

function navList() {
  return `<nav class="lec-category" aria-label="카테고리">
  <ul class="lec-category-list">
    ${navItems.map(([label, url]) => `<li class="lec-category-item"><a class="lec-category-link" href="${relativeUrl(url)}">${label}</a></li>`).join("")}
  </ul>
</nav>`;
}

function profileCard() {
  return `<section class="lec-profile lec-window" aria-label="프로필">
  <div class="lec-profile-ribbon" aria-hidden="true"></div>
  <div class="lec-profile-heart" aria-hidden="true"></div>
  <div class="lec-window-header">
    <span class="lec-window-header-title"><img src="${relativeUrl("assets/images/lec/mr_tit_icon.png")}" alt=""></span>
  </div>
  <div class="lec-profile-body">
    <a class="lec-profile-image" href="${relativeUrl("about/")}">
      <img src="${relativeUrl("assets/images/profile/mascot.png")}" alt="Paint Heart Atelier profile image">
    </a>
  </div>
</section>`;
}

function sidebarContent() {
  return `${profileCard()}${navList()}`;
}

function searchBox() {
  return `<div class="lec-search" role="search">
  <i class="lec-search-icon" data-lucide="search"></i>
  <label class="lec-sr-only" for="lec-search-input">검색</label>
  <input id="lec-search-input" class="lec-search-input" type="search" placeholder="Search blog..." autocomplete="off" data-lec-search-input>
  <button class="lec-search-submit" type="button" aria-label="검색어 지우기" data-lec-search-clear><i data-lucide="x"></i></button>
</div>`;
}

function dday() {
  return `<section class="lec-dday-cover" data-search-item data-search-text="d-day atelier opened">
  <h2 class="lec-cover-title">D-Day</h2>
  <div class="lec-dday-content" data-dday-since="2026-06-05">
    <div class="lec-dday-image"><img src="${relativeUrl("assets/images/profile/mascot.png")}" alt=""></div>
    <strong class="lec-dday-text" data-dday-output>D+001</strong>
    <span class="lec-dday-subtext">atelier opened</span>
  </div>
</section>`;
}

function galleryCard(post) {
  const search = [post.title, post.description, post.category, ...(post.tags || [])].join(" ").toLowerCase();
  return `<li class="lec-gallery-item" data-search-item data-search-text="${escapeHtml(search)}">
  <a class="lec-gallery-link" href="${relativeUrl(post.url)}">
    <div class="lec-gallery-thumb"><img src="${relativeUrl(post.thumbnail || site.defaultThumbnail)}" alt="${escapeHtml(post.title)}"></div>
    <div class="lec-gallery-info">
      <h3 class="lec-gallery-title">${escapeHtml(post.title)}</h3>
      <p class="lec-gallery-category">${escapeHtml(post.category || "notes")} · ${dateDots(post.date)}</p>
    </div>
  </a>
</li>`;
}

function shell({ title, bodyClass = "", layout = "", content }) {
  const pageTitle = title ? `${title} - ${site.title}` : site.title;
  return `<!doctype html>
<html lang="${site.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#ff7da4">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(site.description)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(site.description)}">
  <meta property="og:type" content="${layout === "post" ? "article" : "website"}">
  <meta property="og:image" content="${absoluteUrl(site.defaultThumbnail)}">
  <link rel="icon" href="${relativeUrl("assets/images/lec/mr_cate_icon_1.png")}">
  <link rel="stylesheet" href="${relativeUrl("assets/css/style.css")}">
</head>
<body class="${escapeHtml(`${bodyClass} ${layout === "post" ? "post-page" : ""}`.trim())}">
  <header class="lec-header">
    <button class="lec-mobile-toggle lec-mobile-menu" type="button" aria-label="메뉴 열기" aria-controls="lec-mobile-sidebar" aria-expanded="false" data-lec-mobile-toggle><span></span><span></span><span></span></button>
    <div class="lec-header-icons" aria-label="빠른 이동">
      <a class="lec-icon-button" href="${relativeUrl("")}" aria-label="Home"><i data-lucide="home"></i></a>
      <a class="lec-icon-button" href="${relativeUrl("archive/")}" aria-label="Archive"><i data-lucide="archive"></i></a>
      <button class="lec-icon-button" type="button" data-lec-top aria-label="Top"><i data-lucide="arrow-up"></i></button>
    </div>
  </header>

  <div class="lec-mobile-backdrop" data-lec-mobile-close hidden></div>
  <aside class="lec-mobile-sidebar" id="lec-mobile-sidebar" aria-hidden="true">
    <div class="lec-mobile-sidebar-inner">${sidebarContent()}</div>
  </aside>

  <div class="lec-logo-box">
    <div class="lec-logo-inner">
      <a class="lec-logo-link" href="${relativeUrl("")}" aria-label="${escapeHtml(site.title)}">
        <img class="lec-logo" src="${relativeUrl("assets/images/lec/mr_logo.png")}" alt="${escapeHtml(site.title)}">
      </a>
    </div>
  </div>

  <main class="lec-layout">
    <aside class="lec-left-column lec-desktop-only">${sidebarContent()}</aside>
    <section class="lec-main-column" id="content">
      <div class="lec-main-sticker" aria-hidden="true"></div>
      <div class="lec-main-wave" aria-hidden="true"></div>
      <div class="lec-window lec-main-window">
        <div class="lec-window-header"><span class="lec-window-header-title"><img src="${relativeUrl("assets/images/lec/mr_tit_icon.png")}" alt=""></span></div>
        <div class="lec-main-content">
          ${searchBox()}
          <div class="lec-content-box">
            <div class="lec-content-inner">
              ${content}
              <p class="lec-empty-state" data-lec-empty-state hidden>검색 결과가 없어요.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="lec-footer"><p>© 2026 ${escapeHtml(site.title)}</p></footer>
  <button class="lec-floating-top" type="button" data-lec-top aria-label="맨 위로"><img src="${relativeUrl("assets/images/lec/mr_top_icon.png")}" alt=""></button>
  <div class="lec-heart-cursor" aria-hidden="true"></div>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js" defer></script>
  <script src="${relativeUrl("assets/js/main.js")}" defer></script>
</body>
</html>`;
}

async function writePage(route, html) {
  const dir = path.join(outDir, stripLeadingSlash(route));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), html, "utf8");
}

async function loadPosts() {
  let entries;
  try {
    entries = await fs.readdir(path.join(root, "_blog"));
  } catch (error) {
    throw new Error(`Failed to read _blog directory: ${error.message}`);
  }
  const posts = [];
  for (const entry of entries.filter((name) => /^\d{5}\.md$/.test(name)).sort()) {
    let data, body;
    try {
      ({ data, body } = await readMarkdown(path.join("_blog", entry)));
    } catch (error) {
      throw new Error(`Error processing _blog/${entry}: ${error.message}`);
    }
    const id = entry.replace(/\.md$/, "");
    const html = md.render(renderLiquidLite(body));
    posts.push({
      id,
      name: entry,
      title: data.title || id,
      date: data.date || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      category: data.category || "notes",
      description: data.description || "",
      draft: data.draft === true,
      thumbnail: data.thumbnail || site.defaultThumbnail,
      url: `posts/${id}/`,
      html
    });
  }
  return posts;
}

function homePage(posts) {
  return `<section class="lec-cover" aria-label="홈">
  <div class="lec-cover-row">
    <section class="lec-notice-cover" data-search-item data-search-text="${escapeHtml(`${site.title} notice github pages jekyll markdown`.toLowerCase())}">
      <h2 class="lec-cover-title">Notice</h2>
      <div class="lec-notice-cover-inner">
        <div class="lec-notice-cover-scroll">
          <p class="lec-notice-lead">${escapeHtml(site.description)}</p>
          <ul class="lec-mini-list">
            <li>글은 <code>_blog/00001.md</code>처럼 다섯 자리 번호로 관리합니다.</li>
            <li>공개 URL은 <code>/posts/00001/</code> 형식으로 생성됩니다.</li>
            <li><code>draft: true</code> 글은 홈과 아카이브에서 숨겨집니다.</li>
          </ul>
          <a class="lec-text-link" href="${relativeUrl("archive/")}">전체 글 보기</a>
        </div>
      </div>
    </section>
    ${dday()}
  </div>
  <section class="lec-gallery-cover">
    <h2 class="lec-cover-title">Recent</h2>
    ${posts.length ? `<ul class="lec-gallery-list">${posts.slice(0, 8).map(galleryCard).join("")}</ul>` : `<p class="lec-soft-note">아직 공개된 글이 없어요.</p>`}
  </section>
</section>`;
}

function archivePage(posts) {
  return `<section class="lec-page-section">
  <h1 class="lec-page-title">Archive</h1>
  ${posts.length ? `<ol class="lec-post-list">${posts.map((post) => {
    const search = [post.title, post.description, post.category, ...post.tags].join(" ").toLowerCase();
    return `<li class="lec-post-list-item" data-search-item data-search-text="${escapeHtml(search)}">
      <a href="${relativeUrl(post.url)}">
        <span class="lec-post-list-number">${post.id}</span>
        <span class="lec-post-list-main"><strong>${escapeHtml(post.title)}</strong><small>${escapeHtml(post.description)}</small></span>
        <time datetime="${escapeHtml(post.date)}">${dateDots(post.date)}</time>
      </a>
    </li>`;
  }).join("")}</ol>` : `<p class="lec-soft-note">아직 공개된 글이 없어요.</p>`}
</section>`;
}

function tagsPage(posts) {
  const tags = [...new Set(posts.flatMap((post) => post.tags))].sort();
  return `<section class="lec-page-section">
  <h1 class="lec-page-title">Tags</h1>
  ${tags.length ? `<div class="lec-tag-cloud">${tags.map((tag) => `<a href="#tag-${encodeURIComponent(tag)}" data-search-item data-search-text="${escapeHtml(tag.toLowerCase())}">#${escapeHtml(tag)}</a>`).join("")}</div>
  ${tags.map((tag) => `<section class="lec-tag-section" id="tag-${encodeURIComponent(tag)}">
    <h2>#${escapeHtml(tag)}</h2>
    <ul class="lec-compact-list">${posts.filter((post) => post.tags.includes(tag)).map((post) => `<li data-search-item data-search-text="${escapeHtml([post.title, post.description, tag].join(" ").toLowerCase())}"><a href="${relativeUrl(post.url)}">${escapeHtml(post.title)}</a><time datetime="${escapeHtml(post.date)}">${dateDots(post.date)}</time></li>`).join("")}</ul>
  </section>`).join("")}` : `<p class="lec-soft-note">아직 태그가 없어요.</p>`}
</section>`;
}

function projectsPage() {
  return `<section class="lec-page-section" data-search-item data-search-text="projects github pages jekyll blog">
  <h1 class="lec-page-title">Projects</h1>
  <div class="lec-project-grid">
    <article class="lec-project-item">
      <strong>Numbered Jekyll Blog</strong>
      <p>날짜 파일명을 쓰지 않고 Jekyll collection으로 번호형 글을 운영하는 GitHub Pages 블로그입니다.</p>
      <a href="${relativeUrl("posts/00001/")}">샘플 글 보기</a>
    </article>
  </div>
</section>`;
}

function postPage(post, ascendingPosts) {
  const index = ascendingPosts.findIndex((item) => item.id === post.id);
  const prev = index > 0 ? ascendingPosts[index - 1] : null;
  const next = index < ascendingPosts.length - 1 ? ascendingPosts[index + 1] : null;
  return `<article class="lec-post" data-search-item data-search-text="${escapeHtml([post.title, post.description].join(" ").toLowerCase())}">
  <header class="lec-post-header">
    <p class="lec-post-kicker">${escapeHtml(post.category)}</p>
    <h1 class="lec-post-title">${escapeHtml(post.title)}</h1>
    <div class="lec-post-meta">
      <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time>
      <span aria-hidden="true">/</span>
      <span>${post.tags.map((tag) => `#${escapeHtml(tag)}`).join(" ")}</span>
    </div>
  </header>
  <div class="lec-post-content">${post.html}</div>
  <nav class="lec-post-nav" aria-label="이전 글과 다음 글">
    ${prev ? `<a class="lec-post-nav-link" href="${relativeUrl(prev.url)}"><span>Prev</span>${escapeHtml(prev.title)}</a>` : ""}
    ${next ? `<a class="lec-post-nav-link" href="${relativeUrl(next.url)}"><span>Next</span>${escapeHtml(next.title)}</a>` : ""}
  </nav>
</article>`;
}

async function build() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  try {
    await fs.cp(path.join(root, "assets"), path.join(outDir, "assets"), { recursive: true });
  } catch (error) {
    throw new Error(`Failed to copy assets directory: ${error.message}`);
  }

  try {
    await fs.copyFile(path.join(root, "_redirects"), path.join(outDir, "_redirects"));
  } catch (error) {
    throw new Error(`Failed to copy _redirects file: ${error.message}`);
  }

  const allPosts = await loadPosts();
  const publishedDesc = allPosts
    .filter((post) => !post.draft)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id.localeCompare(a.id));
  const publishedAsc = [...publishedDesc].reverse();

  await writePage("", shell({ title: "Home", bodyClass: "home", content: homePage(publishedDesc) }));
  await writePage("archive", shell({ title: "Archive", bodyClass: "archive", content: archivePage(publishedDesc) }));
  await writePage("tags", shell({ title: "Tags", bodyClass: "tags", content: tagsPage(publishedDesc) }));
  await writePage("projects", shell({ title: "Projects", bodyClass: "projects", content: projectsPage() }));

  const about = await readMarkdown("about.md");
  await writePage("about", shell({ title: about.data.title || "About", content: md.render(renderLiquidLite(about.body)) }));

  for (const post of allPosts) {
    await writePage(post.url, shell({ title: post.title, layout: "post", content: postPage(post, publishedAsc) }));
  }

  console.log(
    `Built ${path.relative(root, outDir)} with ${publishedDesc.length} published post(s) ` +
      `from ${allPosts.length} markdown file(s) for ${site.url}${site.baseurl || ""}/`
  );
}

try {
  await build();
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exit(1);
}
