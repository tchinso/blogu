import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(new URL(".", import.meta.url))),
  ".."
);
export const outDir = path.join(root, "_site");
export const blogDir = path.join(root, "_blog");

export function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, body: text };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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

export async function readPostEntries() {
  const entries = await fs.readdir(blogDir);
  const posts = [];

  for (const name of entries
    .filter((entry) => /^\d{5}\.md$/.test(entry))
    .sort()) {
    const source = await fs.readFile(path.join(blogDir, name), "utf8");
    const { data } = parseFrontMatter(source);
    posts.push({
      id: name.replace(/\.md$/, ""),
      name,
      draft: data.draft === true,
      title: data.title || name.replace(/\.md$/, ""),
      date: data.date || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      category: data.category || "notes",
      description: data.description || "",
      thumbnail: data.thumbnail || ""
    });
  }

  return posts;
}

export const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function dateDots(date) {
  return String(date || "").replaceAll("-", ".");
}

export function searchText(...parts) {
  return parts.flat().join(" ").toLowerCase();
}

export function emptyNote(message) {
  return `<p class="lec-soft-note">${escapeHtml(message)}</p>`;
}
