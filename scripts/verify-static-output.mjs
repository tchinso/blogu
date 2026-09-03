import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blogDir = path.join(root, "_blog");
const outDir = path.join(root, "_site");

async function readPostEntries() {
  const entries = await fs.readdir(blogDir);
  return entries
    .filter((name) => /^\d{5}\.md$/.test(name))
    .sort()
    .map((name) => ({ id: name.replace(/\.md$/, ""), name }));
}

async function assertFileExists(filePath, label) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} is missing: ${path.relative(root, filePath)}`);
  }
}

async function assertFileAbsent(filePath, label) {
  try {
    await fs.access(filePath);
  } catch {
    return;
  }
  throw new Error(`${label} should not be published: ${path.relative(root, filePath)}`);
}

async function readOutput(route) {
  return fs.readFile(path.join(outDir, route), "utf8");
}

const posts = await readPostEntries();
const requiredPages = [
  ["index.html", "Home page"],
  [path.join("tags", "index.html"), "Tags page"],
  [path.join("about", "index.html"), "About page"],
  [path.join("writer", "index.html"), "Writer page"],
  [path.join("assets", "js", "writer.js"), "Writer script"],
  [path.join("assets", "css", "writer.css"), "Writer stylesheet"],
  ["_redirects", "Cloudflare redirects"]
];

for (const [route, label] of requiredPages) {
  await assertFileExists(path.join(outDir, route), label);
}

await assertFileAbsent(path.join(outDir, "archive", "index.html"), "Archive page");
await assertFileAbsent(path.join(outDir, "projects", "index.html"), "Projects page");

for (const post of posts) {
  await assertFileExists(path.join(outDir, "posts", post.id, "index.html"), `Post ${post.id}`);
}

const homeHtml = await readOutput("index.html");
const aboutHtml = await readOutput(path.join("about", "index.html"));
const tagsHtml = await readOutput(path.join("tags", "index.html"));
const writerHtml = await readOutput(path.join("writer", "index.html"));
const redirects = await readOutput("_redirects");

for (const [label, html] of [
  ["Home page", homeHtml],
  ["About page", aboutHtml],
  ["Tags page", tagsHtml]
]) {
  if (/\{%|\{\{\s*(?:site|page|post|item|include)\b/.test(html)) {
    throw new Error(`${label} still contains unrendered Jekyll/Liquid template syntax.`);
  }
}

if (!homeHtml.includes("lec-notice-bar")) {
  throw new Error("Home page is missing the compact notice bar.");
}

if (!aboutHtml.includes("data-dday-since")) {
  throw new Error("About page is missing the D-Day block from _data/dday.yml.");
}

if (!writerHtml.includes("data-writer-download")) {
  throw new Error("Writer page is missing its Markdown download action.");
}

if (!writerHtml.includes("../assets/js/writer.js") || !writerHtml.includes("../assets/css/writer.css")) {
  throw new Error("Writer page is missing a required local asset reference.");
}

for (const post of posts) {
  if (!homeHtml.includes(`/posts/${post.id}/`)) {
    throw new Error(`Post ${post.id} is missing from the home feed.`);
  }
}

if (!redirects.includes("/writer /writer/index.html 200")) {
  throw new Error("Cloudflare redirects are missing the writer route.");
}

if (/\/(?:archive|projects)\b/.test(redirects)) {
  throw new Error("Cloudflare redirects still expose a retired Archive or Projects route.");
}

console.log(`Verified Jekyll output: ${posts.length} post file(s), Home, Tags, About, and Writer.`);
