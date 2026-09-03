(function () {
  "use strict";

  const ready = (callback) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  };

  ready(() => {
    const byId = (id) => document.getElementById(id);
    const fields = {
      id: byId("writer-id"),
      date: byId("writer-date"),
      title: byId("writer-title"),
      category: byId("writer-category"),
      tags: byId("writer-tags"),
      description: byId("writer-description"),
      thumbnail: byId("writer-thumbnail"),
      password: byId("writer-password"),
      body: byId("writer-body"),
      imagePath: byId("writer-image-path"),
      imageAlt: byId("writer-image-alt"),
      imageCaption: byId("writer-image-caption")
    };
    const form = byId("writer-form");
    const previewFrame = byId("writer-preview");
    const previewStatus = byId("writer-preview-status");
    const status = byId("writer-status");
    const draftState = byId("writer-draft-state");
    const restoreButton = byId("writer-restore");
    const tagPreview = byId("writer-tag-preview");
    const imagePreview = byId("writer-image-preview");
    const thumbnailPreview = byId("writer-thumbnail-preview");
    const previewThumbnail = byId("writer-preview-thumbnail");
    const previewCategory = byId("writer-preview-category");
    const previewTitle = byId("writer-preview-post-title");
    const previewDate = byId("writer-preview-date");
    const count = byId("writer-count");
    const passwordToggle = byId("writer-password-toggle");
    const DRAFT_KEY = "blogu-md-writer-v1";
    const DEFAULT_THUMBNAIL = "assets/images/profile/mascot.png";
    const IMAGE_FALLBACK = "/assets/images/strawberry.png";

    let markdown = null;
    let previewTimer = null;
    let draftTimer = null;

    function localDate() {
      const today = new Date();
      const pad = (number) => String(number).padStart(2, "0");
      return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    }

    function normalizeNewlines(value) {
      return String(value ?? "").replace(/\r\n?/g, "\n");
    }

    function normalizeAssetPath(value) {
      return String(value ?? "")
        .trim()
        .replaceAll("\\", "/")
        .replace(/^\.\/+/, "")
        .replace(/^\/+/, "");
    }

    function displayAssetPath(value, fallback = IMAGE_FALLBACK) {
      const normalized = normalizeAssetPath(value);
      return normalized ? `/${normalized}` : fallback;
    }

    function escapeHtml(value = "") {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function escapeMarkdownLabel(value = "") {
      return String(value).replace(/[\\\[\]]/g, "\\$&").replace(/\r?\n/g, " ");
    }

    function setStatus(message, isError = false) {
      status.textContent = message;
      status.classList.toggle("is-error", isError);
    }

    function setDraftState(message = "") {
      draftState.textContent = message;
    }

    function configureMarkdown() {
      if (typeof window.markdownit !== "function") return null;

      const instance = window.markdownit({ html: true, linkify: true, typographer: true });
      const plugins = [
        [window.markdownitFootnote],
        [window.markdownitDeflist],
        [window.markdownitTaskLists, { enabled: true, label: true }]
      ];

      plugins.forEach(([plugin, options]) => {
        if (typeof plugin === "function") instance.use(plugin, options);
      });

      return instance;
    }

    function splitTags(value = fields.tags.value, strict = false) {
      const tags = String(value)
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const uniqueTags = [...new Set(tags)];

      if (strict) {
        const invalidTag = uniqueTags.find((tag) => /[\r\n\[\],"']/.test(tag));
        if (invalidTag) {
          throw new Error(`태그 “${invalidTag}”에는 쉼표, 대괄호, 큰따옴표, 작은따옴표를 쓸 수 없어요.`);
        }
      }

      return uniqueTags;
    }

    function updateTagPreview() {
      tagPreview.replaceChildren();
      splitTags().forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "writer-tag-chip";
        chip.textContent = `#${tag}`;
        tagPreview.append(chip);
      });
    }

    function updateImagePlaceholders() {
      const imageCode = imagePreview.querySelector("code");
      const thumbnailCode = thumbnailPreview.querySelector("code");
      const previewThumbnailCode = previewThumbnail.querySelector("code");
      const imagePath = displayAssetPath(fields.imagePath.value);
      const thumbnailPath = displayAssetPath(fields.thumbnail.value, "기본 썸네일");

      imageCode.textContent = imagePath;
      thumbnailCode.textContent = thumbnailPath;
      previewThumbnailCode.textContent = thumbnailPath;
    }

    function updateCounts() {
      const source = fields.body.value;
      const words = source.trim() ? source.trim().split(/\s+/u).length : 0;
      count.textContent = `${source.length.toLocaleString("ko-KR")}자 · ${words.toLocaleString("ko-KR")}단어`;
    }

    function updatePreviewMeta() {
      previewTitle.textContent = fields.title.value.trim() || "제목 미리보기";
      previewCategory.textContent = fields.category.value.trim() || "notes";
      previewDate.textContent = fields.date.value || "날짜 미리보기";
    }

    function liquidForPath(path) {
      return `{{ '${path}' | relative_url }}`;
    }

    function liquidForPreview(source) {
      return String(source).replace(
        /\{\{\s*(['"])([^'"\r\n]+)\1\s*\|\s*relative_url\s*\}\}/g,
        (_, __, path) => `#blogu-relative-${encodeURIComponent(normalizeAssetPath(path))}`
      );
    }

    function previewImagePath(rawValue) {
      const value = String(rawValue ?? "");
      const marker = "#blogu-relative-";

      if (value.startsWith(marker)) {
        try {
          return decodeURIComponent(value.slice(marker.length));
        } catch {
          return null;
        }
      }

      const withoutQuery = value.split(/[?#]/, 1)[0];
      if (/^\/?assets\//i.test(withoutQuery)) return normalizeAssetPath(withoutQuery);
      return null;
    }

    function createPreviewImagePlaceholder(doc, path, alt) {
      const placeholder = doc.createElement("span");
      const label = doc.createElement("span");
      const description = doc.createElement("span");
      const pathNode = doc.createElement("code");
      placeholder.className = "writer-image-placeholder";
      placeholder.setAttribute("role", "img");
      placeholder.setAttribute("aria-label", alt ? `${alt} 이미지 자리` : "이미지 자리");
      label.textContent = "IMAGE PLACEHOLDER";
      description.textContent = alt || "여기에 이미지가 들어가요";
      pathNode.textContent = displayAssetPath(path);
      placeholder.append(label, description, pathNode);
      return placeholder;
    }

    function previewDocument(content) {
      const body = content || '<p class="writer-empty-preview">왼쪽에 Markdown을 쓰면 여기에 미리보기가 보여요.</p>';
      return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { color: #2d292a; font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.8; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 22px; overflow-wrap: anywhere; background: #fff; color: #2d292a; font-size: 15px; }
    :where(h1, h2, h3, h4, h5, h6) { margin: 25px 0 10px; color: #ff7da4; font-weight: 900; line-height: 1.45; }
    h1 { font-size: 1.45rem; } h2 { font-size: 1.25rem; } h3 { font-size: 1.12rem; } h4, h5, h6 { font-size: 1rem; }
    p, ul, ol, dl, blockquote, table, pre, details, figure { margin: 12px 0 0; }
    ul, ol { padding-left: 24px; } li + li { margin-top: 4px; }
    a { color: #f86e83; font-weight: 700; }
    blockquote { padding: 10px 12px; margin-left: 0; background: #fff4f7; border-left: 4px solid #ff7da4; border-radius: 0 10px 10px 0; }
    blockquote p { margin: 0; } blockquote p + p { margin-top: 8px; }
    code, kbd, pre { font-family: "SFMono-Regular", Consolas, monospace; }
    code { padding: 2px 5px; color: #f86e83; background: #fff4f7; border: 1px solid #ffd3de; border-radius: 5px; font-size: .88em; }
    pre { overflow: auto; padding: 12px; background: #fff9fb; border: 2px solid #ffd3de; border-radius: 10px; }
    pre code { padding: 0; color: inherit; background: transparent; border: 0; }
    table { width: 100%; display: block; overflow-x: auto; border-collapse: collapse; border: 2px solid #ffd3de; border-radius: 10px; }
    th, td { padding: 8px 10px; border: 1px solid #ffd3de; text-align: left; vertical-align: top; }
    th { color: #ff7da4; background: #ffe6ec; }
    details, figure { padding: 10px 12px; background: #fff4f7; border: 2px solid #ffd3de; border-radius: 10px; }
    summary { color: #ff7da4; font-weight: 800; cursor: pointer; }
    figure figcaption { margin-top: 8px; color: #b09ca3; font-size: .82em; text-align: center; }
    mark { padding: 1px 4px; color: #f86e83; background: #ffe6ec; border-radius: 4px; }
    kbd { padding: 2px 6px; color: #ff7da4; background: #fff; border: 2px solid #ffd3de; border-radius: 6px; box-shadow: 0 2px 0 #feb3c7; font-size: .8em; }
    .task-list { padding-left: 0; list-style: none; } .task-list-item-checkbox { accent-color: #ff7da4; margin-right: 6px; }
    .footnotes { margin-top: 22px; padding-top: 12px; border-top: 2px dashed #ffd3de; color: #b09ca3; font-size: .82em; }
    .writer-image-placeholder { min-height: 94px; padding: 12px; display: grid; align-content: center; gap: 4px; overflow: hidden; color: #ff7da4; background: linear-gradient(135deg, #ffe6ec, #fff), repeating-linear-gradient(45deg, transparent 0 10px, rgba(255, 211, 222, .45) 10px 11px); border: 1.5px dashed #ff7da4; border-radius: 10px; }
    .writer-image-placeholder > span:first-child { color: #f86e83; font-size: .66rem; font-weight: 900; letter-spacing: .1em; }
    .writer-image-placeholder > span:nth-child(2) { color: #b09ca3; font-size: .84rem; font-weight: 700; }
    .writer-image-placeholder code { overflow: hidden; color: #ff7da4; text-overflow: ellipsis; white-space: nowrap; }
    .writer-empty-preview { margin: 0; padding: 20px; color: #b09ca3; text-align: center; background: #fff4f7; border: 2px dashed #ffd3de; border-radius: 12px; }
  </style>
</head>
<body>${body}</body>
</html>`;
    }

    function renderPreview() {
      updatePreviewMeta();
      updateImagePlaceholders();

      if (!markdown) {
        previewStatus.textContent = "미리보기 라이브러리를 불러오지 못했어요";
        previewFrame.srcdoc = previewDocument('<p class="writer-empty-preview">인터넷 연결 후 새로고침하면 미리보기를 볼 수 있어요. 다운로드 기능은 그대로 사용할 수 있어요.</p>');
        return;
      }

      const template = document.createElement("template");
      template.innerHTML = markdown.render(liquidForPreview(fields.body.value));
      template.content.querySelectorAll("img").forEach((image) => {
        const localPath = previewImagePath(image.getAttribute("src"));
        if (!localPath) return;
        image.replaceWith(createPreviewImagePlaceholder(document, localPath, image.getAttribute("alt") || ""));
      });

      previewStatus.textContent = "실시간 반영";
      previewFrame.srcdoc = previewDocument(template.innerHTML);
    }

    function schedulePreview() {
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(renderPreview, 110);
    }

    function draftPayload() {
      return {
        version: 1,
        id: fields.id.value,
        date: fields.date.value,
        title: fields.title.value,
        category: fields.category.value,
        tags: fields.tags.value,
        description: fields.description.value,
        thumbnail: fields.thumbnail.value,
        body: fields.body.value,
        imagePath: fields.imagePath.value,
        imageAlt: fields.imageAlt.value,
        imageCaption: fields.imageCaption.value
      };
    }

    function savedDraft() {
      try {
        const value = window.localStorage.getItem(DRAFT_KEY);
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    }

    function updateRestoreButton() {
      restoreButton.hidden = !savedDraft();
    }

    function saveDraft() {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draftPayload()));
        setDraftState("임시저장됨");
        updateRestoreButton();
      } catch {
        setDraftState("임시저장을 사용할 수 없어요");
      }
    }

    function scheduleDraft() {
      window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(saveDraft, 420);
    }

    function refresh({ save = true } = {}) {
      updateTagPreview();
      updateImagePlaceholders();
      updateCounts();
      updatePreviewMeta();
      schedulePreview();
      if (save) scheduleDraft();
    }

    function replaceSelectedText(text, selectionStart = text.length, selectionEnd = selectionStart) {
      const textarea = fields.body;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.setRangeText(text, start, end, "end");
      textarea.focus();
      textarea.setSelectionRange(start + selectionStart, start + selectionEnd);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function wrapSelection(before, after, fallback) {
      const textarea = fields.body;
      const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) || fallback;
      replaceSelectedText(`${before}${selected}${after}`, before.length, before.length + selected.length);
    }

    function prefixSelectedLines(prefix, fallback) {
      const textarea = fields.body;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start === end) {
        replaceSelectedText(`${prefix}${fallback}`, prefix.length, prefix.length + fallback.length);
        return;
      }

      const lineStart = textarea.value.lastIndexOf("\n", start - 1) + 1;
      const nextBreak = textarea.value.indexOf("\n", end);
      const lineEnd = nextBreak === -1 ? textarea.value.length : nextBreak;
      const selectedLines = textarea.value.slice(lineStart, lineEnd);
      const prefixed = selectedLines.split("\n").map((line) => `${prefix}${line}`).join("\n");
      textarea.setRangeText(prefixed, lineStart, lineEnd, "end");
      textarea.focus();
      textarea.setSelectionRange(lineStart + prefix.length, lineStart + prefixed.length);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function insertBlock(template, marker = "") {
      const textarea = fields.body;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = textarea.value.slice(0, start);
      const after = textarea.value.slice(end);
      const beforeGap = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
      const afterGap = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
      const insertion = `${beforeGap}${template}${afterGap}`;
      const markerIndex = marker ? template.indexOf(marker) : -1;
      const selectionStart = beforeGap.length + (markerIndex >= 0 ? markerIndex : template.length);
      const selectionEnd = markerIndex >= 0 ? selectionStart + marker.length : selectionStart;
      replaceSelectedText(insertion, selectionStart, selectionEnd);
    }

    function imageContext() {
      const result = validateAssetPath(fields.imagePath.value, "이미지 경로", false);
      if (!result.path) throw new Error("이미지 경로를 입력해 주세요.");

      return {
        path: result.path,
        alt: fields.imageAlt.value.trim() || "image",
        caption: fields.imageCaption.value.trim() || "이미지 설명"
      };
    }

    function insertImage(asFigure) {
      let image;
      try {
        image = imageContext();
      } catch (error) {
        setStatus(error.message, true);
        fields.imagePath.focus();
        return;
      }

      const relativePath = liquidForPath(image.path);
      if (asFigure) {
        const markup = `<figure>\n  <img src="${relativePath}" alt="${escapeHtml(image.alt)}">\n  <figcaption>${escapeHtml(image.caption)}</figcaption>\n</figure>`;
        insertBlock(markup, image.caption);
      } else {
        const markup = `![${escapeMarkdownLabel(image.alt)}](${relativePath})`;
        replaceSelectedText(markup, 2, 2 + escapeMarkdownLabel(image.alt).length);
      }
      setStatus("이미지 경로를 본문에 넣었어요.");
    }

    function runTemplate(name) {
      const templates = {
        "heading-1": () => prefixSelectedLines("# ", "제목"),
        "heading-2": () => prefixSelectedLines("## ", "제목"),
        "heading-3": () => prefixSelectedLines("### ", "제목"),
        "heading-4": () => prefixSelectedLines("#### ", "제목"),
        "heading-5": () => prefixSelectedLines("##### ", "제목"),
        "heading-6": () => prefixSelectedLines("###### ", "제목"),
        bold: () => wrapSelection("**", "**", "굵은 텍스트"),
        italic: () => wrapSelection("*", "*", "기울임 텍스트"),
        "bold-italic": () => wrapSelection("***", "***", "굵고 기울인 텍스트"),
        strike: () => wrapSelection("~~", "~~", "취소선 텍스트"),
        "inline-code": () => wrapSelection("`", "`", "code"),
        mark: () => wrapSelection("<mark>", "</mark>", "강조할 텍스트"),
        link: () => wrapSelection("[", "](https://example.com)", "링크 텍스트"),
        rule: () => insertBlock("---"),
        "unordered-list": () => insertBlock("- 첫 번째 항목\n- 두 번째 항목\n  - 하위 항목", "첫 번째 항목"),
        "ordered-list": () => insertBlock("1. 첫 번째 항목\n2. 두 번째 항목\n3. 세 번째 항목", "첫 번째 항목"),
        "task-list": () => insertBlock("- [x] 끝낸 일\n- [ ] 남은 일", "끝낸 일"),
        quote: () => insertBlock("> 인용문\n>\n> > 중첩 인용문", "인용문"),
        "code-block": () => insertBlock("```js\nconst message = \"Hello, Blogu!\";\n```", "Hello, Blogu!"),
        table: () => insertBlock("| 항목 | 내용 |\n| --- | --- |\n| 첫 번째 | 여기에 내용을 적어요 |", "첫 번째"),
        details: () => insertBlock("<details>\n  <summary>접기 영역 제목</summary>\n  <p>접힌 영역 안의 내용입니다.</p>\n</details>", "접기 영역 제목"),
        "definition-list": () => insertBlock("용어\n: 용어에 대한 설명", "용어"),
        footnote: () => insertBlock("각주가 필요한 문장입니다.[^1]\n\n[^1]: 각주 내용", "각주 내용"),
        kbd: () => wrapSelection("<kbd>", "</kbd>", "Ctrl"),
        small: () => wrapSelection("<small>", "</small>", "작은 글자"),
        figure: () => insertImage(true),
        image: () => insertImage(false),
        html: () => insertBlock("<p><kbd>Ctrl</kbd> + <kbd>K</kbd></p>\n\n<mark>mark 태그</mark>와 <small>small 태그</small>", "mark 태그")
      };

      if (templates[name]) templates[name]();
    }

    function validDate(value) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!match) return false;
      const [year, month, day] = match.slice(1).map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    }

    function yamlScalar(value, label) {
      const text = String(value ?? "").trim();
      if (!text) return '""';
      if (/[\r\n]/.test(text)) throw new Error(`${label}은 한 줄로 입력해 주세요.`);
      if (!text.includes("'")) return `'${text}'`;
      if (!text.includes('"') && !text.includes("\\")) return `"${text}"`;
      throw new Error(`${label}에는 작은따옴표와 큰따옴표를 함께, 또는 작은따옴표와 역슬래시를 함께 쓸 수 없어요. 현재 Blogu용 Front Matter 형식의 제한이에요.`);
    }

    function validateAssetPath(value, label, optional = true) {
      const path = normalizeAssetPath(value);
      if (!path && optional) return { path: "" };
      if (!path) throw new Error(`${label}를 입력해 주세요.`);
      if (!path.startsWith("assets/")) {
        throw new Error(`${label}는 /assets/로 시작하는 Blogu 경로를 입력해 주세요.`);
      }
      if (/[\r\n'"{}|]/.test(path)) {
        throw new Error(`${label}에는 줄바꿈, 따옴표, Liquid 문자를 쓸 수 없어요.`);
      }
      return { path };
    }

    function markdownForDownload() {
      const id = fields.id.value.trim();
      if (!/^\d{5}$/.test(id)) {
        throw new Error("파일 번호는 00001처럼 숫자 다섯 자리여야 해요.");
      }

      const title = fields.title.value.trim();
      if (!title) throw new Error("제목을 입력해 주세요.");
      if (!validDate(fields.date.value)) throw new Error("날짜를 올바르게 입력해 주세요.");

      const thumbnail = validateAssetPath(fields.thumbnail.value, "Thumbnail 경로").path;
      const password = fields.password.value;
      if (password !== password.trim()) {
        throw new Error("비밀번호 앞뒤 공백은 Blogu에서 유지되지 않아요. 공백을 빼고 입력해 주세요.");
      }

      const category = fields.category.value.trim() || "notes";
      const frontMatter = [
        "---",
        `title: ${yamlScalar(title, "제목")}`,
        `date: ${fields.date.value}`,
        `tags: [${splitTags(fields.tags.value, true).map((tag) => yamlScalar(tag, "태그")).join(", ")}]`,
        `category: ${yamlScalar(category, "Category")}`,
        `description: ${yamlScalar(fields.description.value, "Description")}`,
        `thumbnail: ${thumbnail ? yamlScalar(thumbnail, "Thumbnail 경로") : '""'}`,
        `password: ${password ? yamlScalar(password, "비밀번호") : '""'}`,
        "---",
        "",
        normalizeNewlines(fields.body.value).replace(/^\n+/, "")
      ];

      return {
        id,
        markdown: `${frontMatter.join("\n").replace(/\n+$/, "")}\n`
      };
    }

    function downloadMarkdown() {
      let result;
      try {
        result = markdownForDownload();
      } catch (error) {
        setStatus(error.message, true);
        return;
      }

      // TextEncoder emits UTF-8 bytes without a BOM. The current Blogu parser
      // expects the very first byte to begin the `---` front matter delimiter.
      const utf8 = new TextEncoder().encode(result.markdown);
      const blob = new Blob([utf8], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${result.id}.md`;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus(`${result.id}.md 파일을 UTF-8 (BOM 없음)으로 다운로드했어요.`);
    }

    function restoreDraft() {
      const draft = savedDraft();
      if (!draft) {
        setStatus("불러올 임시저장 글이 없어요.", true);
        updateRestoreButton();
        return;
      }

      if (!window.confirm("지금 작성 중인 내용 대신 저장된 초안을 불러올까요?")) return;
      Object.entries(draft).forEach(([key, value]) => {
        if (key === "version" || !(key in fields)) return;
        fields[key].value = value ?? "";
      });
      fields.password.value = "";
      refresh({ save: false });
      setDraftState("저장된 초안을 불러왔어요");
      setStatus("비밀번호를 제외한 임시저장 내용을 불러왔어요.");
    }

    function clearWriter() {
      if (!window.confirm("작성 중인 내용과 이 브라우저의 임시저장을 지울까요?")) return;
      fields.id.value = "";
      fields.date.value = localDate();
      fields.title.value = "";
      fields.category.value = "notes";
      fields.tags.value = "";
      fields.description.value = "";
      fields.thumbnail.value = DEFAULT_THUMBNAIL;
      fields.password.value = "";
      fields.body.value = "";
      fields.imagePath.value = "";
      fields.imageAlt.value = "";
      fields.imageCaption.value = "";
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // The writer remains usable when browser storage is unavailable.
      }
      updateRestoreButton();
      setDraftState("");
      refresh({ save: false });
      setStatus("작성 내용을 지웠어요.");
    }

    if (!fields.date.value) fields.date.value = localDate();
    markdown = configureMarkdown();
    updateRestoreButton();
    refresh({ save: false });

    Object.values(fields).forEach((field) => {
      field.addEventListener("input", () => refresh());
    });

    fields.id.addEventListener("input", () => {
      const digits = fields.id.value.replace(/\D/g, "").slice(0, 5);
      if (fields.id.value !== digits) fields.id.value = digits;
    });

    fields.tags.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (fields.tags.value.trim() && !fields.tags.value.trimEnd().endsWith(",")) {
        fields.tags.value = `${fields.tags.value.trimEnd()}, `;
        fields.tags.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    document.querySelectorAll("[data-writer-template]").forEach((button) => {
      button.addEventListener("click", () => runTemplate(button.dataset.writerTemplate));
    });

    byId("writer-insert-image").addEventListener("click", () => insertImage(false));
    byId("writer-insert-figure").addEventListener("click", () => insertImage(true));
    byId("writer-clear").addEventListener("click", clearWriter);
    restoreButton.addEventListener("click", restoreDraft);

    passwordToggle.addEventListener("click", () => {
      const showing = fields.password.type === "text";
      fields.password.type = showing ? "password" : "text";
      passwordToggle.textContent = showing ? "보기" : "숨기기";
      passwordToggle.setAttribute("aria-label", showing ? "비밀번호 표시" : "비밀번호 숨기기");
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      downloadMarkdown();
    });

    window.addEventListener("pagehide", saveDraft);
  });
})();
