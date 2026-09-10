// 首页随机脚本

const HOME_SCRIPTS = [
  "p5sketches/dots.js",
  "p5sketches/orbit.js",
  "p5sketches/rotating-square.js",
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

// AI 助手

const AI_MODELS = {
  chatgpt: {
    name: "ChatGPT",
    key: "ai_key_chatgpt",
    storage: "ai_msgs_chatgpt",
  },
  gemini: { name: "Gemini", key: "ai_key_gemini", storage: "ai_msgs_gemini" },
  deepseek: {
    name: "DeepSeek",
    key: "ai_key_deepseek",
    storage: "ai_msgs_deepseek",
  },
};

let aiCurrentModel = null;
let aiMessages = [];
let aiSending = false;

function aiGetKey(model) {
  return localStorage.getItem(AI_MODELS[model].key) || "";
}
function aiSetKey(model, key) {
  localStorage.setItem(AI_MODELS[model].key, key);
}
function aiLoadMessages(model) {
  try {
    return JSON.parse(localStorage.getItem(AI_MODELS[model].storage)) || [];
  } catch {
    return [];
  }
}
function aiSaveMessages() {
  if (aiCurrentModel) {
    localStorage.setItem(
      AI_MODELS[aiCurrentModel].storage,
      JSON.stringify(aiMessages),
    );
  }
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

// 侧边栏列表

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

// AI 助手 - 渲染与逻辑

function renderAIChat(app) {
  app.classList.add("ai-mode");
  app.classList.remove("preview-mode");

  if (!aiCurrentModel) {
    const saved = localStorage.getItem("ai_last_model");
    if (saved && AI_MODELS[saved]) {
      aiCurrentModel = saved;
      aiMessages = aiLoadMessages(saved);
    }
  }

  app.innerHTML = `
    <div class="ai-chat-wrap">
      <div class="ai-messages" id="aiMessages"></div>
      <div class="ai-input-bar">
        <button class="ai-plus-btn" id="aiPlusBtn" title="选择模型">+</button>
        <span class="ai-model-badge" id="aiModelBadge" style="display:${aiCurrentModel ? "inline-block" : "none"}">
          ${aiCurrentModel ? AI_MODELS[aiCurrentModel].name : ""}
        </span>
        <input type="text" class="ai-input" id="aiInput" placeholder="${escapeHtml(get("pages.ai.placeholder", "输入你的问题..."))}">
        <button class="ai-send-btn" id="aiSendBtn">${escapeHtml(get("pages.ai.sendBtn", "发送"))}</button>
      </div>
    </div>
  `;

  renderAIMessages();

  document.getElementById("aiPlusBtn").addEventListener("click", showModelMenu);
  document.getElementById("aiSendBtn").addEventListener("click", aiSendMessage);
  document.getElementById("aiInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      aiSendMessage();
    }
  });
}

function renderAIMessages() {
  const box = document.getElementById("aiMessages");
  if (!box) return;
  box.innerHTML = "";
  if (!aiMessages.length) {
    const tip = document.createElement("p");
    tip.style.color = "#999";
    tip.style.textAlign = "center";
    tip.style.marginTop = "40px";
    tip.textContent = aiCurrentModel
      ? `当前模型：${AI_MODELS[aiCurrentModel].name}`
      : "点击左下角 + 选择模型开始对话";
    box.appendChild(tip);
    return;
  }
  aiMessages.forEach((msg) => {
    const div = document.createElement("div");
    div.className = "ai-msg " + (msg.role === "user" ? "user" : "assistant");
    div.textContent = msg.content;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function showModelMenu() {
  const old = document.querySelector(".ai-model-menu");
  if (old) {
    old.remove();
    return;
  }

  const menu = document.createElement("div");
  menu.className = "ai-model-menu";
  ["chatgpt", "gemini", "deepseek"].forEach((key) => {
    const item = document.createElement("div");
    item.className = "item";
    item.textContent = AI_MODELS[key].name;
    item.addEventListener("click", () => {
      menu.remove();
      selectModel(key);
    });
    menu.appendChild(item);
  });
  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener("click", function closeMenu(e) {
      if (!menu.contains(e.target) && e.target.id !== "aiPlusBtn") {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    });
  }, 0);
}

function selectModel(model) {
  aiCurrentModel = model;
  localStorage.setItem("ai_last_model", model);
  const badge = document.getElementById("aiModelBadge");
  if (badge) {
    badge.textContent = AI_MODELS[model].name;
    badge.style.display = "inline-block";
  }

  aiMessages = aiLoadMessages(model);
  renderAIMessages();

  if (!aiGetKey(model)) {
    showApiKeyModal(model);
  }
}

function showApiKeyModal(model) {
  const overlay = document.createElement("div");
  overlay.className = "ai-modal-overlay";
  overlay.innerHTML = `
    <div class="ai-modal">
      <h3>${escapeHtml(get("pages.ai.apiKeyTitle", "请输入 API Key"))} - ${AI_MODELS[model].name}</h3>
      <input type="password" id="aiKeyInput" placeholder="sk-...">
      <p class="hint">${escapeHtml(get("pages.ai.apiKeyHint", "Key 只保存在你的浏览器本地，不会上传到任何服务器。"))}</p>
      <div class="buttons">
        <button class="cancel" id="aiKeyCancel">取消</button>
        <button class="save" id="aiKeySave">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById("aiKeyInput");
  input.focus();

  document
    .getElementById("aiKeyCancel")
    .addEventListener("click", () => overlay.remove());
  document.getElementById("aiKeySave").addEventListener("click", () => {
    const key = input.value.trim();
    if (key) {
      aiSetKey(model, key);
      overlay.remove();
    } else {
      alert(get("pages.ai.noKey", "请先输入 API Key"));
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("aiKeySave").click();
  });
}

async function aiSendMessage() {
  if (aiSending) return;
  if (!aiCurrentModel) {
    alert(get("pages.ai.noModel", "请先选择模型"));
    return;
  }
  const key = aiGetKey(aiCurrentModel);
  if (!key) {
    showApiKeyModal(aiCurrentModel);
    return;
  }
  const input = document.getElementById("aiInput");
  const text = input.value.trim();
  if (!text) return;

  aiMessages.push({ role: "user", content: text });
  aiSaveMessages();
  input.value = "";
  renderAIMessages();

  aiSending = true;
  const sendBtn = document.getElementById("aiSendBtn");
  if (sendBtn) sendBtn.disabled = true;

  const loadingDiv = document.createElement("div");
  loadingDiv.className = "ai-msg assistant";
  loadingDiv.textContent = get("pages.ai.thinking", "思考中...");
  loadingDiv.id = "aiLoading";
  document.getElementById("aiMessages").appendChild(loadingDiv);
  document.getElementById("aiMessages").scrollTop = 99999;

  try {
    const reply = await callAI(aiCurrentModel, key, aiMessages);
    aiMessages.push({ role: "assistant", content: reply });
    aiSaveMessages();
  } catch (e) {
    aiMessages.push({
      role: "assistant",
      content: get("pages.ai.errorPrefix", "请求失败：") + e.message,
    });
    aiSaveMessages();
  } finally {
    aiSending = false;
    if (sendBtn) sendBtn.disabled = false;
    const l = document.getElementById("aiLoading");
    if (l) l.remove();
    renderAIMessages();
  }
}

async function callAI(model, key, messages) {
  if (model === "chatgpt") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "(空响应)";
  }

  if (model === "deepseek") {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "(空响应)";
  }

  if (model === "gemini") {
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "(空响应)";
  }

  throw new Error("Unknown model");
}

// 路由渲染

function render() {
  const path = window.location.pathname;
  const app = document.getElementById("app");

  if (editor) {
    editor.toTextArea();
    editor = null;
  }

  app.classList.remove("preview-mode");
  app.classList.remove("ai-mode");

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
  } else if (path === "/ai") {
    renderAIChat(app);
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
  pickRandomHomeScript();
  applyI18n();
  updateSidebarPages();
  render();
});
