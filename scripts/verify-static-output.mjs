import fs from "node:fs/promises";
import path from "node:path";
import { root, outDir, readPostEntries } from "./lib/shared.mjs";

async function assertFileExists(filePath, label) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} is missing: ${path.relative(root, filePath)}`);
  }
}

const posts = await readPostEntries();
const published = posts.filter((post) => !post.draft);

await assertFileExists(path.join(outDir, "index.html"), "Home page");
await assertFileExists(path.join(outDir, "archive", "index.html"), "Archive page");
await assertFileExists(path.join(outDir, "_redirects"), "Cloudflare redirects");

for (const post of posts) {
  await assertFileExists(path.join(outDir, "posts", post.id, "index.html"), `Post ${post.id}`);
}

const homeHtml = await fs.readFile(path.join(outDir, "index.html"), "utf8");
const archiveHtml = await fs.readFile(path.join(outDir, "archive", "index.html"), "utf8");
const redirects = await fs.readFile(path.join(outDir, "_redirects"), "utf8");
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
