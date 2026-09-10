
// 首页随机脚本

const HOME_SCRIPTS = [
  "p5/dots.js",
  "p5/orbit.js",
  "p5/rotating-square.js",
];

function pickRandomScriptPath() {
  if (!HOME_SCRIPTS.length) return null;
  return HOME_SCRIPTS[Math.floor(Math.random() * HOME_SCRIPTS.length)];
}

function buildHomeFrameHtml(scriptPath) {
  const absPath = new URL(scriptPath, window.location.href).href;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"><\/script>
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script src="${absPath}"><\/script>
</body>
</html>`;
}

let homeScriptPath = null;
let homeScriptHtml = null;

function pickRandomHomeScript() {
  homeScriptPath = pickRandomScriptPath();
  homeScriptHtml = homeScriptPath ? buildHomeFrameHtml(homeScriptPath) : null;
}

// 加载文本内容

let CONTENT = null;

async function loadContent() {
  try {
    const res = await fetch("data/content.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    CONTENT = await res.json();
  } catch (e) {
    console.error("加载 content.json 失败:", e);
    CONTENT = { nav: {}, pages: {}, messages: {}, meta: {} };
  }
}

function get(path, fallback = "") {
  if (!CONTENT) return fallback;
  return (
    path
      .split(".")
      .reduce(
        (obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined),
        CONTENT,
      ) ?? fallback
  );
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = get(key);
    if (value) el.textContent = value;
  });
  const searchInput = document.getElementById("searchInput");
  if (searchInput)
    searchInput.placeholder = get("nav.searchPlaceholder", "搜索...");
  document.title = get("meta.pageTitle", "p5.js 脚本生成器");
}

// 本地存储

function getPages() {
  try {
    return JSON.parse(localStorage.getItem("p5_pages")) || [];
  } catch {
    return [];
  }
}
function savePages(pages) {
  localStorage.setItem("p5_pages", JSON.stringify(pages));
}

// 工具

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function generatePageHtml(title, script, imageDataUrl) {
  const safeTitle = escapeHtml(title) || "Untitled";
  const imgVar = imageDataUrl
    ? `var imageUrl = "${imageDataUrl}";`
    : "var imageUrl = null;";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"><\/script>
  <style>html, body { margin: 0; padding: 0; overflow: hidden; background: #000; } canvas { display: block; }</style>
</head>
<body>
  <script>
    ${imgVar}
    ${script}
  <\/script>
</body>
</html>`;
}

function exportZip() {
  const pages = getPages();
  if (!pages.length) {
    alert(get("messages.zipEmpty", "没有可导出的作品。"));
    return;
  }
  const zip = new JSZip();
  pages.forEach((page, idx) => {
    const filename = `p5_${page.title || "untitled"}_${idx + 1}.html`.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
    zip.file(filename, page.html);
  });
  zip.generateAsync({ type: "blob" }).then((blob) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "p5_works.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  });
}

// 状态

let editor = null;
let uploadedImageDataUrl = null;
let theme = "light";
let searchTerm = "";

// 侧边栏作品列表

function updateSidebarPages() {
  const container = document.getElementById("sidebar-pages");
  const pages = getPages();
  const term = searchTerm.trim().toLowerCase();

  const visible = [];
  pages.forEach((page, index) => {
    if (term && !(page.title || "").toLowerCase().includes(term)) return;
    visible.push({ page, index });
  });

  if (!visible.length) {
    container.innerHTML = `<div class="no-pages">${
      term
        ? get("messages.noMatches", "没有匹配的作品")
        : get("messages.noPages", "暂无生成的脚本")
    }</div>`;
    return;
  }

  let html = "";
  visible.forEach(({ page, index }) => {
    const title = escapeHtml(page.title);
    html += `
      <div class="page-item">
        <span class="page-title" onclick="navigateToPage(${index})">${title}</span>
        <div class="actions">
          <button class="rename" onclick="event.stopPropagation(); renamePage(${index})" title="重命名">✏️</button>
          <button class="del" onclick="event.stopPropagation(); deletePage(${index})" title="删除">🗑️</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function navigateToPage(index) {
  const pages = getPages();
  if (!pages[index]) return;
  sessionStorage.setItem("p5_preview_override", pages[index].html);
  history.pushState(null, "", "/");
  render();
  closeSidebar();
}
window.navigateToPage = navigateToPage;

function deletePage(index) {
  if (!confirm(get("messages.deleteConfirm", "确定删除该作品吗？"))) return;
  const pages = getPages();
  pages.splice(index, 1);
  savePages(pages);
  updateSidebarPages();
  render();
}
window.deletePage = deletePage;

function renamePage(index) {
  const pages = getPages();
  const page = pages[index];
  if (!page) return;
  const newTitle = prompt(
    get("messages.renamePrompt", "请输入新标题："),
    page.title,
  );
  if (newTitle === null || newTitle.trim() === "") return;
  page.title = newTitle.trim();
  savePages(pages);
  updateSidebarPages();
  render();
}
window.renamePage = renamePage;

// 侧边栏控制

function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("overlay").classList.add("show");
  document.getElementById("hamburgerBtn").classList.add("hidden");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
  document.getElementById("hamburgerBtn").classList.remove("hidden");
}

document.getElementById("hamburgerBtn").addEventListener("click", openSidebar);
document.getElementById("overlay").addEventListener("click", closeSidebar);

document.querySelectorAll(".sidebar .nav-item[data-path]").forEach((el) => {
  el.addEventListener("click", function () {
    const path = this.getAttribute("data-path");
    if (path === "/") {
      sessionStorage.removeItem("p5_preview_override");
      pickRandomHomeScript();
    }
    history.pushState(null, "", path);
    render();
    closeSidebar();
  });
});

// 主题切换

function toggleTheme() {
  const body = document.body;
  const lightTheme = document.getElementById("cm-theme");
  const darkTheme = document.getElementById("cm-theme-dark");
  if (theme === "light") {
    body.classList.add("dark-mode");
    lightTheme.disabled = true;
    darkTheme.disabled = false;
    theme = "dark";
    if (editor) editor.setOption("theme", "dracula");
  } else {
    body.classList.remove("dark-mode");
    lightTheme.disabled = false;
    darkTheme.disabled = true;
    theme = "light";
    if (editor) editor.setOption("theme", "default");
  }
}
document
  .getElementById("themeToggleSidebar")
  .addEventListener("click", toggleTheme);

// 路由渲染

function render() {
  const path = window.location.pathname;
  const app = document.getElementById("app");

  if (editor) {
    editor.toTextArea();
    editor = null;
  }

  app.classList.remove("preview-mode");

  if (path === "/" || path === "/index.html") {
    const override = sessionStorage.getItem("p5_preview_override");
    let html = override || homeScriptHtml;

    if (!html) {
      pickRandomHomeScript();
      html = homeScriptHtml;
    }

    if (html) {
      app.classList.add("preview-mode");
      app.innerHTML = `<iframe srcdoc="${escapeAttr(html)}"></iframe>`;
    } else {
      app.innerHTML = `<p style="text-align:center;padding:60px;">${escapeHtml(get("messages.noScripts", "暂无脚本"))}</p>`;
    }
  } else if (path === "/about") {
    const about = get("pages.about", {});
    const paragraphs = (about.paragraphs || [])
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");
    app.innerHTML = `
      <h1>${escapeHtml(about.title || "")}</h1>
      ${paragraphs}
    `;
  } else if (path === "/generator") {
    const g = get("pages.generator", {});
    const labels = g.labels || {};
    const scriptPlaceholder = escapeHtml(labels.scriptPlaceholder || "");
    app.innerHTML = `
      <h1>${escapeHtml(g.title || "")}</h1>
      <p>${escapeHtml(g.description || "")}</p>
      <div class="form-group">
        <label for="title">${escapeHtml(labels.titleInput || "页面标题")}</label>
        <input type="text" id="title" placeholder="${escapeHtml(labels.titlePlaceholder || "")}">
      </div>
      <div class="form-group">
        <label for="script">${escapeHtml(labels.scriptInput || "p5.js 脚本代码")}</label>
        <textarea id="script" placeholder="${scriptPlaceholder}"></textarea>
      </div>
      <div class="form-group">
        <label for="image">${escapeHtml(labels.imageInput || "上传图片")}</label>
        <input type="file" id="image" accept="image/*" onchange="handleImageUpload(this)">
        <div id="image-preview"></div>
      </div>
      <button onclick="buildPage()">${escapeHtml(labels.generateBtn || "生成页面")}</button>
      <div id="result" class="result" style="display:none;"></div>
    `;

    setTimeout(() => {
      const textarea = document.getElementById("script");
      if (textarea && !editor) {
        const themeName = theme === "dark" ? "dracula" : "default";
        editor = CodeMirror.fromTextArea(textarea, {
          mode: "javascript",
          lineNumbers: true,
          theme: themeName,
          tabSize: 2,
          indentUnit: 2,
          autofocus: true,
        });
        editor.setSize(null, 200);
      }
    }, 50);

    uploadedImageDataUrl = null;
    document.getElementById("image-preview").innerHTML = "";

    window.handleImageUpload = function (input) {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        uploadedImageDataUrl = e.target.result;
        document.getElementById("image-preview").innerHTML =
          `<p>✅ 图片上传成功</p><img src="${e.target.result}" class="preview-img">`;
      };
      reader.readAsDataURL(file);
    };

    window.buildPage = function () {
      const title =
        document.getElementById("title").value.trim() ||
        get("messages.emptyTitle", "未命名脚本");
      const script = editor
        ? editor.getValue().trim()
        : document.getElementById("script").value.trim();
      if (!script) {
        alert(get("messages.scriptRequired", "请填写 p5.js 脚本代码"));
        return;
      }
      const imageDataUrl = uploadedImageDataUrl || "";
      const resultDiv = document.getElementById("result");
      resultDiv.style.display = "block";
      resultDiv.innerHTML = get("messages.generating", "正在生成...");

      const htmlContent = generatePageHtml(title, script, imageDataUrl);

      const pages = getPages();
      pages.push({
        id: Date.now(),
        title: title,
        html: htmlContent,
        timestamp: new Date().toISOString(),
      });
      savePages(pages);
      updateSidebarPages();

      resultDiv.innerHTML = "";
      const msg = document.createElement("p");
      msg.textContent = get(
        "messages.generateSuccess",
        "✅ 页面生成成功！已保存到本地存储。",
      );
      resultDiv.appendChild(msg);

      const btnContainer = document.createElement("div");
      btnContainer.className = "action-buttons";

      const previewBtn = document.createElement("button");
      previewBtn.className = "preview";
      previewBtn.textContent = get("messages.previewBtn", "🏠 返回首页预览");
      previewBtn.addEventListener("click", function () {
        sessionStorage.setItem("p5_preview_override", htmlContent);
        history.pushState(null, "", "/");
        render();
      });
      btnContainer.appendChild(previewBtn);

      const zipBtn = document.createElement("button");
      zipBtn.className = "zip";
      zipBtn.textContent = get("messages.zipBtn", "📦 导出所有作品 (ZIP)");
      zipBtn.addEventListener("click", exportZip);
      btnContainer.appendChild(zipBtn);

      resultDiv.appendChild(btnContainer);

      document.getElementById("title").value = "";
      if (editor) editor.setValue("");
      else document.getElementById("script").value = "";
      uploadedImageDataUrl = "";
      document.getElementById("image-preview").innerHTML = "";
      document.getElementById("image").value = "";
    };
  } else {
    const nf = get("pages.notFound", {});
    const paragraphs = (nf.paragraphs || [])
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");
    app.innerHTML = `
      <h1>${escapeHtml(nf.title || "📄 页面未找到")}</h1>
      ${paragraphs || `<p>${escapeHtml(path)}</p>`}
    `;
  }
}

// 搜索输入监听
document.getElementById("searchInput").addEventListener("input", function () {
  searchTerm = this.value;
  updateSidebarPages();
});

window.addEventListener("popstate", function () {
  render();
});

// 初始化

window.addEventListener("load", async function () {
  await loadContent();
  pickRandomHomeScript(); // 同步，无网络请求
  applyI18n();
  updateSidebarPages();
  render();
});