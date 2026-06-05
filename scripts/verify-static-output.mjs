import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blogDir = path.join(root, "_blog");
const outDir = path.join(root, "_site");

function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return {};

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index < 0) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    }
    data[key] = value;
  }

  return data;
}

async function readPostEntries() {
  let entries;
  try {
    entries = await fs.readdir(blogDir);
  } catch (error) {
    throw new Error(`Failed to read _blog directory: ${error.message}`);
  }
  const posts = [];

  for (const name of entries.filter((entry) => /^\d{5}\.md$/.test(entry)).sort()) {
    let source;
    try {
      source = await fs.readFile(path.join(blogDir, name), "utf8");
    } catch (error) {
      throw new Error(`Failed to read _blog/${name}: ${error.message}`);
    }
    const data = parseFrontMatter(source);
    posts.push({
      id: name.replace(/\.md$/, ""),
      name,
      draft: data.draft === true
    });
  }

  return posts;
}

async function readOutput(route) {
  try {
    return await fs.readFile(path.join(outDir, route), "utf8");
  } catch (error) {
    throw new Error(`Failed to read build output ${route}: ${error.message}`);
  }
}

async function assertFileExists(filePath, label) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} is missing: ${path.relative(root, filePath)}`);
  }
}

async function verify() {
  const posts = await readPostEntries();
  const published = posts.filter((post) => !post.draft);

  await assertFileExists(path.join(outDir, "index.html"), "Home page");
  await assertFileExists(path.join(outDir, "archive", "index.html"), "Archive page");
  await assertFileExists(path.join(outDir, "_redirects"), "Cloudflare redirects");

  for (const post of posts) {
    await assertFileExists(path.join(outDir, "posts", post.id, "index.html"), `Post ${post.id}`);
  }

  const homeHtml = await readOutput("index.html");
  const archiveHtml = await readOutput(path.join("archive", "index.html"));
  const redirects = await readOutput("_redirects");
  const rawTemplatePatterns = [
    /^---\s*$/m,
    /\{%\s*(assign|include|for|if)\b/,
    /\{\{\s*site\./
  ];

  for (const [label, html] of [
    ["Home page", homeHtml],
    ["Archive page", archiveHtml]
  ]) {
    for (const pattern of rawTemplatePatterns) {
      if (pattern.test(html)) {
        throw new Error(`${label} still contains unrendered Jekyll/Liquid template syntax.`);
      }
    }
  }

  for (const post of published) {
    const link = `/posts/${post.id}/`;
    if (!archiveHtml.includes(link)) {
      throw new Error(`Published post ${post.id} is missing from archive output.`);
    }
  }

  if (redirects.includes("/_site/")) {
    throw new Error("Cloudflare redirects should point inside the build output, not to /_site paths.");
  }

  console.log(`Verified _site output: ${published.length} published post(s), ${posts.length} total post file(s).`);
}

try {
  await verify();
} catch (error) {
  console.error(`Verification failed: ${error.message}`);
  process.exit(1);
}
