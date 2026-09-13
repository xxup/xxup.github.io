(function () {
  "use strict";

  var STORAGE_KEY = "p5_pages";
  var THEME_KEY = "p5_theme";
  var MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

  /* p5脚本文件夹配置 */
  var P5_DIR = "p5/";
  var P5_CDN = "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js";
  var P5_FILES = ["dots.js", "orbit.js", "rotating-square.js"];

  /* 主题系统 */
  var THEMES = [
    { id: "light", label: "亮色", bodyClass: "", cmTheme: "default" },
    { id: "dark", label: "暗色", bodyClass: "dark-mode", cmTheme: "dracula" },
    { id: "green", label: "护眼绿", bodyClass: "theme-green", cmTheme: "default" },
  ];

  /* 根据id查找主题配置；未命中返回 null */
  function themeConf(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return THEMES[i];
    }
    return null;
  }

  /* AI助手配置 */
  var AI_KEY_STORAGE = "p5_ai_keys";
  var AI_CHAT_STORAGE = "p5_ai_chats";
  var AI_PROMPT_STORAGE = "p5_ai_prompts";

  var AI_MODELS = [
    {
      id: "chatgpt",
      name: "ChatGPT",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiModel: "gpt-4o-mini",
    },
    {
      id: "gemini",
      name: "Gemini",
      endpoint:
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      apiModel: "gemini-2.0-flash",
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      endpoint: "https://api.deepseek.com/chat/completions",
      apiModel: "deepseek-chat",
    },
  ];

  var aiState = {
    currentModel: null,
    keys: {},
    chats: {},
    prompts: {},
    busy: false,
  };

  function aiModelConf(id) {
    for (var i = 0; i < AI_MODELS.length; i++) {
      if (AI_MODELS[i].id === id) return AI_MODELS[i];
    }
    return null;
  }
  function aiModelName(id) {
    var c = aiModelConf(id);
    return c ? c.name : id;
  }
  function loadAIKeys() {
    try {
      var raw = localStorage.getItem(AI_KEY_STORAGE);
      var o = raw ? JSON.parse(raw) : {};
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }
  function saveAIKeys() {
    try {
      localStorage.setItem(AI_KEY_STORAGE, JSON.stringify(aiState.keys));
    } catch (e) {}
  }
  function loadAIChats() {
    try {
      var raw = localStorage.getItem(AI_CHAT_STORAGE);
      var o = raw ? JSON.parse(raw) : {};
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }
  function saveAIChats() {
    try {
      localStorage.setItem(AI_CHAT_STORAGE, JSON.stringify(aiState.chats));
    } catch (e) {}
  }
  function loadAIPrompts() {
    try {
      var raw = localStorage.getItem(AI_PROMPT_STORAGE);
      var o = raw ? JSON.parse(raw) : {};
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }
  function saveAIPrompts() {
    try {
      localStorage.setItem(AI_PROMPT_STORAGE, JSON.stringify(aiState.prompts));
    } catch (e) {}
  }
  function initAIState() {
    aiState.keys = loadAIKeys();
    aiState.chats = loadAIChats();
    aiState.prompts = loadAIPrompts();
    AI_MODELS.forEach(function (m) {
      if (!Array.isArray(aiState.chats[m.id])) aiState.chats[m.id] = [];
      if (typeof aiState.prompts[m.id] !== "string") {
        aiState.prompts[m.id] = "";
      }
    });
    /* 默认不选中模型 */
    aiState.currentModel = null;
  }

  var SCRIPT_PLACEHOLDER =
    "例如：\n" +
    "function setup() {\n" +
    "  createCanvas(windowWidth, windowHeight);\n" +
    "  background(102);\n" +
    "}\n" +
    "function draw() {\n" +
    "  variableEllipse(mouseX, mouseY, pmouseX, pmouseY);\n" +
    "}\n" +
    "function variableEllipse(x, y, px, py) {\n" +
    "  let speed = abs(x - px) + abs(y - py);\n" +
    "  stroke(speed);\n" +
    "  ellipse(x, y, speed, speed);\n" +
    "}";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeScriptClose(str) {
    return String(str).replace(/<\/script/gi, "<\\/script");
  }
  function safeFileName(name) {
    var n = String(name || "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim();
    return n || "untitled";
  }

  function getPages() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }
  function savePages(pages) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
      return true;
    } catch (e) {
      if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
        showAlert(
          "本地存储已满",
          "请删除部分作品，或上传更小的图片后再试。",
          true,
        );
      } else {
        showAlert("保存失败", String((e && e.message) || e), true);
      }
      return false;
    }
  }

  var modalBackdrop, modalBox, lastFocused;

  function openModal(builder) {
    lastFocused = document.activeElement;
    modalBox.innerHTML = "";
    builder(modalBox);
    modalBackdrop.classList.add("show");
    var f = $("input, textarea, button", modalBox);
    if (f && f.focus) f.focus();
  }
  function closeModal() {
    modalBackdrop.classList.remove("show");
    modalBox.innerHTML = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  function showAlert(title, message, isError) {
    openModal(function (box) {
      var h = document.createElement("h3");
      h.textContent = title;
      var p = document.createElement("p");
      p.textContent = message;
      var a = document.createElement("div");
      a.className = "modal-actions";
      var right = document.createElement("div");
      right.className = "right-group";
      var ok = document.createElement("button");
      ok.textContent = "知道了";
      if (isError) ok.className = "danger";
      ok.addEventListener("click", closeModal);
      right.appendChild(ok);
      a.appendChild(right);
      box.appendChild(h);
      box.appendChild(p);
      box.appendChild(a);
    });
  }
  function showConfirm(title, message, onConfirm, danger) {
    openModal(function (box) {
      var h = document.createElement("h3");
      h.textContent = title;
      var p = document.createElement("p");
      p.textContent = message;
      var a = document.createElement("div");
      a.className = "modal-actions";
      var right = document.createElement("div");
      right.className = "right-group";
      var cancel = document.createElement("button");
      cancel.className = "cancel";
      cancel.textContent = "取消";
      cancel.addEventListener("click", closeModal);
      var ok = document.createElement("button");
      ok.textContent = "确定";
      if (danger) ok.className = "danger";
      ok.addEventListener("click", function () {
        closeModal();
        onConfirm();
      });
      right.appendChild(cancel);
      right.appendChild(ok);
      a.appendChild(right);
      box.appendChild(h);
      box.appendChild(p);
      box.appendChild(a);
    });
  }
  function showPrompt(title, defaultValue, onOk, inputType) {
    openModal(function (box) {
      var h = document.createElement("h3");
      h.textContent = title;
      var input = document.createElement("input");
      input.type = inputType || "text";
      input.value = defaultValue || "";
      input.autocomplete = "off";
      input.spellcheck = false;
      var a = document.createElement("div");
      a.className = "modal-actions";
      var right = document.createElement("div");
      right.className = "right-group";
      var cancel = document.createElement("button");
      cancel.className = "cancel";
      cancel.textContent = "取消";
      cancel.addEventListener("click", closeModal);
      var ok = document.createElement("button");
      ok.textContent = "保存";
      ok.addEventListener("click", function () {
        var v = input.value.trim();
        if (!v) {
          input.focus();
          return;
        }
        closeModal();
        onOk(v);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") ok.click();
      });
      right.appendChild(cancel);
      right.appendChild(ok);
      a.appendChild(right);
      box.appendChild(h);
      box.appendChild(input);
      box.appendChild(a);
    });
  }

  /* 多行文本输入弹窗（用于系统提示词） */
  function showPromptArea(opts) {
    openModal(function (box) {
      var h = document.createElement("h3");
      h.textContent = opts.title;

      var hint = document.createElement("div");
      hint.className = "modal-hint";
      hint.textContent =
        opts.hint || "提示词会在每次对话时作为系统消息发送给模型。";

      var ta = document.createElement("textarea");
      ta.value = opts.value || "";
      ta.placeholder = opts.placeholder || "";
      ta.rows = 7;
      ta.spellcheck = false;

      var a = document.createElement("div");
      a.className = "modal-actions";

      /* 左侧"清除提示词"按钮（仅当已有内容时显示） */
      var leftWrap = document.createElement("div");
      if (opts.value && opts.value.trim()) {
        var clearBtn = document.createElement("button");
        clearBtn.className = "link-btn";
        clearBtn.textContent = "清除提示词";
        clearBtn.addEventListener("click", function () {
          closeModal();
          if (opts.onClear) opts.onClear();
        });
        leftWrap.appendChild(clearBtn);
      }

      var rightWrap = document.createElement("div");
      rightWrap.className = "right-group";
      var cancel = document.createElement("button");
      cancel.className = "cancel";
      cancel.textContent = "取消";
      cancel.addEventListener("click", closeModal);

      var ok = document.createElement("button");
      ok.textContent = "保存";
      ok.addEventListener("click", function () {
        var v = ta.value; /* 保留用户换行不做trim */
        closeModal();
        opts.onOk(v);
      });
      ta.addEventListener("keydown", function (e) {
        /* Ctrl+Enter快速保存 */
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          ok.click();
        }
      });
      rightWrap.appendChild(cancel);
      rightWrap.appendChild(ok);

      a.appendChild(leftWrap);
      a.appendChild(rightWrap);
      box.appendChild(h);
      box.appendChild(hint);
      box.appendChild(ta);
      box.appendChild(a);
    });
  }

  function generatePageHtml(title, script, imageDataUrl) {
    var safeTitle = escapeHtml(title || "未命名页面");
    var imgVar = imageDataUrl
      ? 'var imageUrl = "' + imageDataUrl + '";'
      : "var imageUrl = null;";
    var safeImgVar = escapeScriptClose(imgVar);
    var safeScript = escapeScriptClose(script);

    return (
      "<!DOCTYPE html>\n" +
      '<html lang="zh-CN">\n' +
      "<head>\n" +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      "  <title>" +
      safeTitle +
      "</title>\n" +
      "  <style>\n" +
      "    html, body { margin: 0; padding: 0; }\n" +
      "    canvas { display: block; }\n" +
      "  </style>\n" +
      '  <script src="' +
      P5_CDN +
      '"><\/script>\n' +
      "</head>\n" +
      "<body>\n" +
      "  <script>\n" +
      "    " +
      safeImgVar +
      "\n" +
      "    " +
      safeScript +
      "\n" +
      "  <\/script>\n" +
      "</body>\n" +
      "</html>"
    );
  }

  function downloadSingleHtml(filename, html) {
    try {
      var blob = new Blob([html], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      showAlert("下载失败", String((err && err.message) || err), true);
    }
  }

  function exportZip() {
    var pages = getPages();
    if (!pages.length) {
      showAlert("无法导出", "当前没有可导出的作品。");
      return;
    }
    var zip = new JSZip();
    pages.forEach(function (page, idx) {
      var base = (page.title || "untitled").replace(/[\\/:*?"<>|]/g, "_");
      zip.file("p5_" + base + "_" + (idx + 1) + ".html", page.html);
    });
    zip
      .generateAsync({ type: "blob" })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "p5_works.zip";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
      })
      .catch(function (err) {
        showAlert("导出失败", String((err && err.message) || err), true);
      });
  }

  var sidebarPagesEl, sidebarEl, overlayEl, hamburgerBtn;
  var sidebarSearchEl;
  var sidebarSearchKeyword = "";
  var appEl;

  /* 首页运行器 */
  var runner = { mode: "random", pageId: null };
  var currentRandomFile = null;

  function pickRandomP5File() {
    if (!P5_FILES || !P5_FILES.length) return null;
    if (P5_FILES.length === 1) return P5_FILES[0];
    var pool = P5_FILES.filter(function (f) {
      return f !== currentRandomFile;
    });
    if (!pool.length) pool = P5_FILES.slice();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function encodePath(fileName) {
    return String(fileName)
      .split("/")
      .map(function (seg) {
        return encodeURIComponent(seg);
      })
      .join("/");
  }

  function buildP5SrcDoc(fileName) {
    var src = P5_DIR + encodePath(fileName);
    return (
      "<!DOCTYPE html>\n" +
      '<html lang="zh-CN">\n' +
      "<head>\n" +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">\n' +
      "  <style>\n" +
      "    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }\n" +
      "    canvas { display: block; }\n" +
      "  </style>\n" +
      '  <script src="' +
      P5_CDN +
      '"><\/script>\n' +
      '  <script src="' +
      src +
      '"><\/script>\n' +
      "</head>\n" +
      "<body></body>\n" +
      "</html>"
    );
  }

  function updateSidebarPages() {
    var pages = getPages();
    var kw = sidebarSearchKeyword.trim().toLowerCase();
    var filtered = pages;
    if (kw) {
      filtered = pages.filter(function (p) {
        return (
          String(p.title || "")
            .toLowerCase()
            .indexOf(kw) !== -1
        );
      });
    }

    if (!filtered.length) {
      var empty = document.createElement("div");
      empty.className = "no-pages";
      empty.textContent = kw ? "没有找到匹配的脚本" : "暂无生成的脚本";
      sidebarPagesEl.replaceChildren(empty);
      return;
    }

    var frag = document.createDocumentFragment();
    filtered.forEach(function (page) {
      var item = document.createElement("div");
      item.className = "page-item";

      var titleSpan = document.createElement("span");
      titleSpan.className = "page-title";
      titleSpan.textContent = page.title;
      titleSpan.dataset.action = "open";
      titleSpan.dataset.id = String(page.id);

      var actions = document.createElement("div");
      actions.className = "actions";

      var renameBtn = document.createElement("button");
      renameBtn.className = "rename";
      renameBtn.title = "重命名";
      renameBtn.textContent = "✏️";
      renameBtn.dataset.action = "rename";
      renameBtn.dataset.id = String(page.id);

      var delBtn = document.createElement("button");
      delBtn.className = "del";
      delBtn.title = "删除";
      delBtn.textContent = "🗑️";
      delBtn.dataset.action = "delete";
      delBtn.dataset.id = String(page.id);

      actions.appendChild(renameBtn);
      actions.appendChild(delBtn);
      item.appendChild(titleSpan);
      item.appendChild(actions);
      frag.appendChild(item);
    });
    sidebarPagesEl.replaceChildren(frag);
  }

  function bindIframeProxy(iframe) {
    var iwin, idoc;
    try {
      iwin = iframe.contentWindow;
      idoc = iframe.contentDocument;
    } catch (e) {
      console.warn("无法访问 iframe 内部文档：", e);
      return;
    }
    if (!iwin || !idoc) return;

    var tries = 0;
    function tryFindCanvas() {
      var canvas = idoc.querySelector("canvas");
      if (canvas) {
        attachProxy(canvas, iwin, idoc);
        return;
      }
      if (++tries < 80) setTimeout(tryFindCanvas, 100);
    }
    tryFindCanvas();
  }

  function attachProxy(canvas, iwin, idoc) {
    if (canvas.__proxyAttached) return;
    canvas.__proxyAttached = true;

    var MOUSE_TYPES = [
      "mousemove",
      "mousedown",
      "mouseup",
      "click",
      "dblclick",
    ];
    var TOUCH_TYPES = ["touchstart", "touchmove", "touchend", "touchcancel"];

    function relayMouse(e) {
      if (e.target === canvas) return;
      if (
        (e.type === "mousedown" ||
          e.type === "mouseup" ||
          e.type === "click" ||
          e.type === "dblclick") &&
        e.button !== 0
      )
        return;

      var ev;
      try {
        ev = new iwin.MouseEvent(e.type, {
          bubbles: true,
          cancelable: true,
          view: iwin,
          detail: e.detail || 1,
          screenX: e.screenX,
          screenY: e.screenY,
          clientX: e.clientX,
          clientY: e.clientY,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          button: e.button,
          buttons: e.buttons,
          relatedTarget: null,
        });
      } catch (err) {
        return;
      }
      canvas.dispatchEvent(ev);
    }

    function relayTouch(e) {
      if (e.target === canvas) return;
      if (!e.touches || !e.touches.length) return;
      var t = e.touches[0];
      var type =
        e.type === "touchstart"
          ? "mousedown"
          : e.type === "touchmove"
            ? "mousemove"
            : e.type === "touchend"
              ? "mouseup"
              : null;
      if (!type) return;
      var ev;
      try {
        ev = new iwin.MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: iwin,
          clientX: t.clientX,
          clientY: t.clientY,
          screenX: t.screenX,
          screenY: t.screenY,
          button: 0,
          buttons: type === "mouseup" ? 0 : 1,
        });
      } catch (err) {
        return;
      }
      canvas.dispatchEvent(ev);
    }

    MOUSE_TYPES.forEach(function (type) {
      idoc.addEventListener(type, relayMouse, true);
    });
    TOUCH_TYPES.forEach(function (type) {
      idoc.addEventListener(type, relayTouch, {
        capture: true,
        passive: true,
      });
    });
  }

  function lockAppSize() {
    document.body.classList.add("preview-lock");
    var w = window.innerWidth;
    var h = window.innerHeight;
    appEl.style.position = "fixed";
    appEl.style.top = "0";
    appEl.style.left = "0";
    appEl.style.width = w + "px";
    appEl.style.height = h + "px";
    appEl.style.overflow = "hidden";
  }

  function unlockAppSize() {
    document.body.classList.remove("preview-lock");
    appEl.style.position = "";
    appEl.style.top = "";
    appEl.style.left = "";
    appEl.style.width = "";
    appEl.style.height = "";
    appEl.style.overflow = "";
  }

  /* 首页运行器 */

  function renderRunner() {
    destroyEditor();
    appEl.replaceChildren();
    appEl.classList.remove("preview-mode");
    appEl.classList.remove("ai-mode");
    setActiveNav("/");

    var html = null;

    if (runner.mode === "page") {
      var page = getPages().find(function (p) {
        return p.id === runner.pageId;
      });
      if (page) {
        html = page.html;
        appEl.dataset.currentPageId = String(page.id);
      } else {
        runner.mode = "random";
        runner.pageId = null;
      }
    }

    if (html === null) {
      var file = pickRandomP5File();
      if (!file) {
        unlockAppSize();
        delete appEl.dataset.currentPageId;
        var wrap = document.createElement("div");
        wrap.innerHTML =
          "<h1>还没有可运行的脚本</h1>" +
          "<p>请把脚本放进与本页面同级的文件夹，" +
          "并在页面代码顶部的数组里写上文件名</p>";
        appEl.appendChild(wrap);
        return;
      }
      currentRandomFile = file;
      html = buildP5SrcDoc(file);
      delete appEl.dataset.currentPageId;
    }

    lockAppSize();
    appEl.classList.add("preview-mode");

    var iframe = document.createElement("iframe");
    iframe.setAttribute("title", "p5 运行");
    iframe.setAttribute("scrolling", "no");
    iframe.srcdoc = html;
    iframe.addEventListener("load", function () {
      bindIframeProxy(iframe);
    });
    appEl.appendChild(iframe);
  }

  function setRandom() {
    runner.mode = "random";
    runner.pageId = null;
    if (getRoute() === "/") render();
    else location.hash = "#/";
  }

  function runPage(id) {
    runner.mode = "page";
    runner.pageId = id;
    if (getRoute() === "/") render();
    else location.hash = "#/";
  }

  function deletePage(id) {
    var pages = getPages();
    var page = pages.find(function (p) {
      return p.id === id;
    });
    if (!page) return;
    showConfirm(
      "删除作品",
      "确定要删除「" + page.title + "」吗？此操作不可恢复。",
      function () {
        var list = getPages().filter(function (p) {
          return p.id !== id;
        });
        savePages(list);
        updateSidebarPages();
        if (runner.mode === "page" && runner.pageId === id) {
          runner.mode = "random";
          runner.pageId = null;
        }
        render();
      },
      true,
    );
  }

  function renamePage(id) {
    var pages = getPages();
    var page = pages.find(function (p) {
      return p.id === id;
    });
    if (!page) return;
    showPrompt("重命名作品", page.title, function (newTitle) {
      page.title = newTitle;
      savePages(pages);
      updateSidebarPages();
      render();
    });
  }

  function openSidebar() {
    sidebarEl.classList.add("open");
    overlayEl.classList.add("show");
    document.body.classList.add("sidebar-open");
    hamburgerBtn.setAttribute("aria-expanded", "true");
  }
  function closeSidebar() {
    sidebarEl.classList.remove("open");
    overlayEl.classList.remove("show");
    document.body.classList.remove("sidebar-open");
    hamburgerBtn.setAttribute("aria-expanded", "false");
  }

  var editor = null;
  var uploadedImageDataUrl = null;

  /* ⭐ ============================================================
       ⭐ 主题应用（重写）
       ⭐ ------------------------------------------------------------
       ⭐ 原实现只能识别 "light"/"dark" 两个硬编码值，写死了 dark-mode
       ⭐ 类名与 CodeMirror 主题名。现改为数据驱动：
       ⭐
       ⭐   1. 先移除所有已知主题的 bodyClass（避免多主题叠加）
       ⭐   2. 从 THEMES 里解析目标主题（未知 id 自动 fallback 到首项）
       ⭐   3. 挂上新的 bodyClass（"" 表示直接用 :root 默认值）
       ⭐   4. 按 cmTheme 切换 CodeMirror 的亮/暗 CSS link
       ⭐   5. 如果编辑器实例存在，同步 setOption("theme", ...)
       ⭐
       ⭐ 加新主题时只需改 THEMES 数组和 CSS，本函数零改动。
       ⭐ ============================================================ */
  function applyTheme(themeId) {
    /* ① 移除所有旧主题类，避免"暗色+护眼绿"同时挂着 */
    THEMES.forEach(function (t) {
      if (t.bodyClass) document.body.classList.remove(t.bodyClass);
    });

    /* ② 解析目标主题；未命中时退回 THEMES[0]（即 light） */
    var conf = themeConf(themeId) || THEMES[0];

    /* ③ 应用 bodyClass；空串表示不附加任何类（用默认 :root 变量） */
    if (conf.bodyClass) document.body.classList.add(conf.bodyClass);

    /* ④ 切换 CodeMirror 主题 CSS link
         约定：只有 "default" 视为亮色，其它主题名一律走暗色 link。
         若未来引入更多 CM 主题 CSS，可在此按名字查找对应 <link>。 */
    var lightLink = $("#cm-theme-light");
    var darkLink = $("#cm-theme-dark");
    var useDarkCm = conf.cmTheme !== "default";
    if (lightLink) lightLink.disabled = useDarkCm;
    if (darkLink) darkLink.disabled = !useDarkCm;

    /* ⑤ 编辑器实例存在则同步刷新主题 */
    if (editor) editor.setOption("theme", conf.cmTheme);
  }

  /* ⭐ 返回当前生效的主题 id
       - 遍历 THEMES，看 body 上挂了哪个 bodyClass 就返回对应 id
       - 都没命中（即 body 无任何主题类）→ 返回默认主题 THEMES[0].id */
  function currentTheme() {
    for (var i = 0; i < THEMES.length; i++) {
      var t = THEMES[i];
      if (t.bodyClass && document.body.classList.contains(t.bodyClass)) {
        return t.id;
      }
    }
    return THEMES[0].id;
  }

  /* ⭐ 在 THEMES 数组里循环切换：
       light → dark → (green) → light ...
       主题数量从 2 变 N 后依然可用，无需改动此处逻辑。 */
  function toggleTheme() {
    var cur = currentTheme();
    var idx = 0;
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === cur) {
        idx = i;
        break;
      }
    }
    var next = THEMES[(idx + 1) % THEMES.length].id;
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {}
  }

  function getRoute() {
    var hash = location.hash;
    if (!hash || hash === "#" || hash === "#/") return "/";
    return hash.replace(/^#/, "") || "/";
  }
  function setActiveNav(path) {
    $$(".sidebar .nav-item[data-path]").forEach(function (el) {
      if (el.getAttribute("data-path") === "#" + path) {
        el.setAttribute("aria-current", "page");
      } else {
        el.removeAttribute("aria-current");
      }
    });
  }
  function destroyEditor() {
    if (editor) {
      try {
        editor.toTextArea();
      } catch (e) {}
      editor = null;
    }
  }

  function renderAbout() {
    var wrap = document.createElement("div");
    wrap.innerHTML =
      "<h1>关于</h1>" +
      "<p>纯前端工具，基于localStorage存储，无需后端。</p>" +
      "<p>使用CodeMirror实现代码高亮，支持亮色/暗色主题。</p>" +
      "<p>所有脚本均可导出为ZIP包，也可单独下载为HTML。</p>" +
      "<p>首页随机加载运行p5.js脚本，编写脚本后提交脚本点击预览可运行该脚本或在侧边栏中选择脚本名点击即可直接运行该脚本，再点击其它导航项会回到随机状态。</p>" +
      "<p>AI助手支持ChatGPT / Gemini / DeepSeek流式输出，" +
      "每个模型可单独设置API Key与系统提示词，并可导出对话内容为Markdown格式 </p>";
    return wrap;
  }
  function renderGenerator() {
    var wrap = document.createElement("div");
    wrap.className = "generator-page";
    wrap.innerHTML =
      "<h1>编写p5.js脚本</h1>" +
      "<p>输入标题和p5.js代码，上传图片（可选）点击提交脚本</p>" +
      '<div class="form-group">' +
      '  <label for="title">标题</label>' +
      '  <input type="text" id="title" placeholder="例如：我的创意绘图">' +
      "</div>" +
      '<div class="form-group">' +
      '  <label for="script">p5.js脚本代码</label>' +
      '  <textarea id="script"></textarea>' +
      "</div>" +
      '<div class="form-group">' +
      '  <label for="image">上传图片（可选，脚本可通过 <code>imageUrl</code> 加载）</label>' +
      '  <input type="file" id="image" accept="image/*">' +
      '  <div id="image-preview"></div>' +
      "</div>" +
      '<button id="buildBtn" type="button">提交脚本</button>' +
      '<div id="result" class="result" style="display:none;"></div>';
    return wrap;
  }

  function bindGenerator() {
    var titleInput = $("#title");
    var textarea = $("#script");
    var fileInput = $("#image");
    var previewEl = $("#image-preview");
    var resultEl = $("#result");
    var buildBtn = $("#buildBtn");

    uploadedImageDataUrl = null;

    destroyEditor();
    if (window.CodeMirror) {
      /* ⭐ 初始主题名从主题配置读取，不再写死 light→default */
      var initThemeConf = themeConf(currentTheme()) || THEMES[0];
      editor = window.CodeMirror.fromTextArea(textarea, {
        mode: "javascript",
        lineNumbers: true,
        theme: initThemeConf.cmTheme,
        tabSize: 2,
        indentUnit: 2,
        autofocus: true,
      });
      editor.setSize(null, "100%");

      var cmWrapper = editor.getWrapperElement();
      if (getComputedStyle(cmWrapper).position === "static") {
        cmWrapper.style.position = "relative";
      }

      var cmPlaceholderEl = document.createElement("div");
      cmPlaceholderEl.className = "cm-placeholder-overlay";
      cmPlaceholderEl.textContent = SCRIPT_PLACEHOLDER;
      cmWrapper.appendChild(cmPlaceholderEl);

      var gutters = cmWrapper.querySelector(".CodeMirror-gutters");
      var leftOffset = gutters ? gutters.offsetWidth + 8 : 44;
      cmPlaceholderEl.style.left = leftOffset + "px";

      function updateCmPlaceholder() {
        cmPlaceholderEl.style.display =
          editor.getValue().length === 0 ? "block" : "none";
      }
      editor.on("change", updateCmPlaceholder);
      editor.on("optionChange", function () {
        var g = cmWrapper.querySelector(".CodeMirror-gutters");
        if (g) cmPlaceholderEl.style.left = g.offsetWidth + 8 + "px";
      });
      updateCmPlaceholder();
    }

    fileInput.addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        showAlert("文件类型不支持", "请选择图片文件。", true);
        this.value = "";
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        showAlert(
          "图片太大",
          "单张图片请小于 1.5MB，以免本地存储空间耗尽。",
          true,
        );
        this.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        uploadedImageDataUrl = e.target.result;
        var tip = document.createElement("p");
        tip.textContent = "✅ 图片上传成功";
        var img = document.createElement("img");
        img.src = e.target.result;
        img.className = "preview-img";
        img.alt = "上传预览";
        previewEl.replaceChildren(tip, img);
      };
      reader.onerror = function () {
        showAlert("读取失败", "无法读取该图片，请重试。", true);
      };
      reader.readAsDataURL(file);
    });

    buildBtn.addEventListener("click", function () {
      var title = titleInput.value.trim() || "未命名脚本";
      var script = (editor ? editor.getValue() : textarea.value).trim();
      if (!script) {
        showAlert("缺少脚本", "请填写 p5.js 脚本代码。", true);
        return;
      }
      var imageDataUrl = uploadedImageDataUrl || "";
      var htmlContent = generatePageHtml(title, script, imageDataUrl);

      var newId = Date.now() + Math.floor(Math.random() * 1000);
      var pages = getPages();
      pages.push({
        id: newId,
        title: title,
        html: htmlContent,
        timestamp: new Date().toISOString(),
      });
      if (!savePages(pages)) return;

      updateSidebarPages();

      resultEl.style.display = "block";
      var msg = document.createElement("p");
      msg.textContent = "✅ 页面生成成功！已保存到本地存储。";

      var btnContainer = document.createElement("div");
      btnContainer.className = "action-buttons";

      var previewBtn = document.createElement("button");
      previewBtn.className = "preview";
      previewBtn.textContent = "▶️ 预览";
      previewBtn.addEventListener("click", function () {
        runPage(newId);
      });

      var downloadBtn = document.createElement("button");
      downloadBtn.className = "download";
      downloadBtn.textContent = "⬇️ 下载HTML";
      downloadBtn.addEventListener("click", function () {
        downloadSingleHtml(
          "p5_" + safeFileName(title) + "_" + newId + ".html",
          htmlContent,
        );
      });

      btnContainer.appendChild(previewBtn);
      btnContainer.appendChild(downloadBtn);
      resultEl.replaceChildren(msg, btnContainer);

      titleInput.value = "";
      if (editor) editor.setValue("");
      uploadedImageDataUrl = "";
      previewEl.replaceChildren();
      fileInput.value = "";
    });
  }

  /* AI助手 — 页面渲染 */
  function renderAIAssistant() {
    var wrap = document.createElement("div");
    wrap.className = "ai-page";
    wrap.innerHTML =
      '<button class="ai-clear-btn" id="aiClearBtn" type="button" title="清除当前模型的对话内容">−</button>' +
      '<div class="ai-messages" id="aiMessages"></div>' +
      '<div class="ai-input-wrap">' +
      '  <div class="ai-input-bar">' +
      '    <div class="ai-model-picker">' +
      '      <button class="ai-model-btn" id="aiModelBtn" type="button" title="选择模型">+</button>' +
      '      <div class="ai-model-menu" id="aiModelMenu"></div>' +
      "    </div>" +
      '    <textarea id="aiInput" rows="1" placeholder="输入消息回车发送，Shift+回车换行"></textarea>' +
      '    <button class="ai-send-btn" id="aiSendBtn" type="button" title="发送">↑</button>' +
      "  </div>" +
      "</div>";
    return wrap;
  }

  function buildAIModelMenu() {
    var menu = $("#aiModelMenu");
    if (!menu) return;
    var frag = document.createDocumentFragment();
    AI_MODELS.forEach(function (m) {
      var item = document.createElement("div");
      item.className = "ai-model-item";
      if (aiState.currentModel === m.id) item.classList.add("active");
      item.dataset.model = m.id;

      var check = document.createElement("span");
      check.className = "ai-check";
      check.textContent = "✓";

      var name = document.createElement("span");
      name.className = "ai-model-name";
      name.textContent = m.name;

      /* 系统提示词按钮 */
      var promptBtn = document.createElement("button");
      promptBtn.className = "ai-prompt";
      promptBtn.type = "button";
      promptBtn.title = "设置系统提示词";
      promptBtn.textContent = "🎭";
      promptBtn.dataset.prompt = m.id;
      if (aiState.prompts[m.id] && aiState.prompts[m.id].trim()) {
        promptBtn.classList.add("has-prompt");
      }

      /* API Key按钮 */
      var keyBtn = document.createElement("button");
      keyBtn.className = "ai-key";
      keyBtn.type = "button";
      keyBtn.title = "设置 / 更新 API Key";
      keyBtn.textContent = "🔑";
      keyBtn.dataset.key = m.id;

      /* 下载按钮 */
      var dl = document.createElement("button");
      dl.className = "ai-dl";
      dl.type = "button";
      dl.title = "下载该模型的对话 (Markdown)";
      dl.textContent = "⬇";
      dl.dataset.dl = m.id;

      item.appendChild(check);
      item.appendChild(name);
      item.appendChild(promptBtn);
      item.appendChild(keyBtn);
      item.appendChild(dl);
      frag.appendChild(item);
    });
    menu.replaceChildren(frag);
  }

  function refreshAIModelUI() {
    var items = $$(".ai-model-item");
    items.forEach(function (el) {
      if (aiState.currentModel && el.dataset.model === aiState.currentModel) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
    var btn = $("#aiModelBtn");
    if (btn) {
      if (aiState.currentModel) {
        btn.classList.add("has-model");
        btn.textContent = aiModelName(aiState.currentModel).charAt(0);
      } else {
        btn.classList.remove("has-model");
        btn.textContent = "+";
      }
    }
  }

  function closeAIModelMenu() {
    var menu = $("#aiModelMenu");
    if (menu) menu.classList.remove("show");
  }
  function toggleAIModelMenu() {
    var menu = $("#aiModelMenu");
    if (!menu) return;
    menu.classList.toggle("show");
  }

  function renderAIMessages() {
    var box = $("#aiMessages");
    if (!box) return;
    var model = aiState.currentModel;

    if (!model) {
      var empty = document.createElement("div");
      empty.className = "ai-empty";
      empty.textContent =
        "还没有选择模型\n\n点击左下角的 + 选择一个模型\n并输入API Key后开始对话";
      box.replaceChildren(empty);
      return;
    }

    var chat = aiState.chats[model] || [];
    if (!chat.length) {
      var empty2 = document.createElement("div");
      empty2.className = "ai-empty";
      empty2.textContent = "开始与 " + aiModelName(model) + " 对话吧";
      box.replaceChildren(empty2);
      return;
    }

    var frag = document.createDocumentFragment();
    chat.forEach(function (m) {
      var row = document.createElement("div");
      row.className =
        "ai-msg " + (m.role === "assistant" ? "assistant" : "user");
      var b = document.createElement("div");
      b.className = "bubble";
      if (m.role === "assistant" && !m.content) {
        b.textContent = "正在思考…";
        b.classList.add("pending");
      } else {
        b.textContent = m.content;
      }
      row.appendChild(b);
      frag.appendChild(row);
    });
    box.replaceChildren(frag);
    box.scrollTop = box.scrollHeight;
  }

  function updateAISendBtn() {
    var btn = $("#aiSendBtn");
    if (!btn) return;
    btn.disabled = !!aiState.busy;
  }

  function getLastAssistantBubble() {
    var box = $("#aiMessages");
    if (!box) return null;
    var rows = box.querySelectorAll(".ai-msg.assistant");
    if (!rows.length) return null;
    var last = rows[rows.length - 1];
    return last.querySelector(".bubble");
  }

  /* AI 助手 — 流式请求 */

  function streamAI(model, key, messages, systemPrompt, onDelta) {
    var conf = aiModelConf(model);
    var url, options;

    if (model === "gemini") {
      url =
        conf.endpoint.replace(":generateContent", ":streamGenerateContent") +
        "?alt=sse&key=" +
        encodeURIComponent(key);
      var contents = messages.map(function (m) {
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        };
      });
      var body = { contents: contents };
      if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
      }
      options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
    } else {
      var msgs = [];
      if (systemPrompt) {
        msgs.push({ role: "system", content: systemPrompt });
      }
      messages.forEach(function (m) {
        msgs.push({ role: m.role, content: m.content });
      });
      url = conf.endpoint;
      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify({
          model: conf.apiModel,
          messages: msgs,
          stream: true,
        }),
      };
    }

    return fetch(url, options).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var msg = "HTTP " + res.status;
          try {
            var d = JSON.parse(t);
            msg =
              (d.error && d.error.message) ||
              d.message ||
              (d.error && d.error.status) ||
              msg;
          } catch (e) {}
          throw new Error(msg);
        });
      }
      if (!res.body || !res.body.getReader) {
        throw new Error("当前浏览器不支持流式响应");
      }

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";

      function dispatchData(data) {
        if (!data) return;
        if (data === "[DONE]") return;
        try {
          onDelta(JSON.parse(data));
        } catch (e) {}
      }

      function processBuffer(flush) {
        var sepIndex;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          var evt = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          var lines = evt.split("\n");
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.indexOf("data:") === 0) {
              dispatchData(line.slice(5).trim());
            }
          }
        }
        if (flush && buffer.trim()) {
          var tail = buffer.trim();
          if (tail.indexOf("data:") === 0) {
            dispatchData(tail.slice(5).trim());
          }
          buffer = "";
        }
      }

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) {
            processBuffer(true);
            return;
          }
          buffer += decoder.decode(result.value, { stream: true });
          processBuffer(false);
          return pump();
        });
      }

      return pump();
    });
  }

  /* 弹出APIKey输入框（密码输入加密显示） */
  function promptAPIKey(model, onSaved) {
    showPrompt(
      "设置 " + aiModelName(model) + " API Key",
      aiState.keys[model] || "",
      function (v) {
        aiState.keys[model] = v;
        saveAIKeys();
        if (onSaved) onSaved();
      },
      "password",
    );
  }

  /* 弹出系统提示词输入框（多行文本） */
  function promptSystemPrompt(model) {
    var existing = aiState.prompts[model] || "";
    showPromptArea({
      title: "设置 " + aiModelName(model) + " 系统提示词",
      hint:
        "这段提示词会作为system 消息在每次对话时发送给模型，用于设定角色、语气或规则。" +
        "留空则不发送。Ctrl+Enter 可快速保存。",
      value: existing,
      placeholder:
        "例如：你是一位擅长p5.js生成艺术的助手，回答简洁专业，代码附注释。",
      onOk: function (v) {
        aiState.prompts[model] = v.trim();
        saveAIPrompts();
        buildAIModelMenu();
        refreshAIModelUI();
      },
      onClear: function () {
        aiState.prompts[model] = "";
        saveAIPrompts();
        buildAIModelMenu();
        refreshAIModelUI();
      },
    });
  }

  /* 选择和切换模型：无Key时先要求输入Key */
  function selectAIModel(model) {
    if (!aiModelConf(model)) return;
    if (!aiState.keys[model]) {
      promptAPIKey(model, function () {
        aiState.currentModel = model;
        refreshAIModelUI();
        renderAIMessages();
        updateAISendBtn();
      });
      return;
    }
    aiState.currentModel = model;
    refreshAIModelUI();
    renderAIMessages();
    updateAISendBtn();
  }

  function downloadAIChat(model) {
    var chat = aiState.chats[model] || [];
    if (!chat.length) {
      showAlert("无法下载", "「" + aiModelName(model) + "」还没有对话内容。");
      return;
    }
    var lines = ["# " + aiModelName(model) + " 对话记录", ""];
    var sys = aiState.prompts[model];
    if (sys && sys.trim()) {
      lines.push("## 🎭 系统提示词");
      lines.push("");
      lines.push(sys);
      lines.push("");
    }
    chat.forEach(function (m) {
      lines.push(
        m.role === "user" ? "## 🧑 我" : "## 🤖 " + aiModelName(model),
      );
      lines.push("");
      lines.push(m.content);
      lines.push("");
    });
    var md = lines.join("\n");
    var blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "ai_chat_" + model + "_" + Date.now() + ".md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function aiSend() {
    if (aiState.busy) return;
    var model = aiState.currentModel;
    if (!model) {
      showAlert(
        "请先选择模型",
        "点击左下角的 + 按钮选择一个模型并设置Key。",
        true,
      );
      return;
    }
    var key = aiState.keys[model];
    if (!key) {
      promptAPIKey(model, function () {
        aiSend();
      });
      return;
    }

    var inputEl = $("#aiInput");
    if (!inputEl) return;
    var text = (inputEl.value || "").trim();
    if (!text) return;

    var chat = aiState.chats[model];
    if (!Array.isArray(chat)) chat = aiState.chats[model] = [];

    chat.push({ role: "user", content: text });
    chat.push({ role: "assistant", content: "" }); /* 占位 */
    saveAIChats();

    inputEl.value = "";
    inputEl.style.height = "auto";

    aiState.busy = true;
    updateAISendBtn();
    renderAIMessages();

    var bubble = getLastAssistantBubble();
    var accumulated = "";
    var isGemini = model === "gemini";
    var box = $("#aiMessages");

    function pushDelta(text2) {
      if (!text2) return;
      accumulated += text2;
      if (bubble) {
        bubble.classList.remove("pending");
        bubble.textContent = accumulated;
      }
      if (box) box.scrollTop = box.scrollHeight;
    }

    var onDelta = function (obj) {
      if (isGemini) {
        var cand = obj.candidates && obj.candidates[0];
        if (cand && cand.content && cand.content.parts) {
          var t = "";
          for (var i = 0; i < cand.content.parts.length; i++) {
            t += cand.content.parts[i].text || "";
          }
          pushDelta(t);
        }
      } else {
        var d = obj.choices && obj.choices[0] && obj.choices[0].delta;
        if (d && d.content) pushDelta(d.content);
      }
    };

    /* 发送给API的 messages不含最后那个占位assistant */
    var payload = chat.slice(0, -1);
    /* 取该模型的系统提示词 */
    var systemPrompt = aiState.prompts[model] || "";

    streamAI(model, key, payload, systemPrompt, onDelta)
      .then(function () {
        chat[chat.length - 1].content = accumulated || "(空回复)";
        saveAIChats();
        aiState.busy = false;
        updateAISendBtn();
        renderAIMessages();
      })
      .catch(function (err) {
        aiState.busy = false;
        updateAISendBtn();
        if (accumulated) {
          chat[chat.length - 1].content = accumulated;
        } else {
          chat.pop();
        }
        saveAIChats();
        renderAIMessages();
        showAlert(
          "请求失败",
          String((err && err.message) || err) ||
            "网络错误，请检查 API Key 或稍后重试。",
          true,
        );
      });
  }

  function clearAIChat() {
    var model = aiState.currentModel;
    if (!model) {
      showAlert("无需清除", "还没有选择模型，请点击左下角的 + 选择一个模型。");
      return;
    }
    var chat = aiState.chats[model] || [];
    if (!chat.length) {
      showAlert("无需清除", "「" + aiModelName(model) + "」当前没有对话内容。");
      return;
    }
    showConfirm(
      "清除对话",
      "确定要清除与「" + aiModelName(model) + "」的全部对话内容吗？",
      function () {
        aiState.chats[model] = [];
        saveAIChats();
        renderAIMessages();
      },
      true,
    );
  }

  function bindAIAssistant() {
    buildAIModelMenu();
    refreshAIModelUI();
    renderAIMessages();
    updateAISendBtn();

    var modelBtn = $("#aiModelBtn");
    var modelMenu = $("#aiModelMenu");
    var inputEl = $("#aiInput");
    var sendBtn = $("#aiSendBtn");
    var clearBtn = $("#aiClearBtn");

    if (modelBtn) {
      modelBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleAIModelMenu();
      });
    }

    if (modelMenu) {
      modelMenu.addEventListener("click", function (e) {
        /* 点击 🎭：设置系统提示词 */
        var promptBtn = e.target.closest("[data-prompt]");
        if (promptBtn) {
          e.stopPropagation();
          closeAIModelMenu();
          promptSystemPrompt(promptBtn.dataset.prompt);
          return;
        }
        /* 点击 🔑：设置 / 更新 Key */
        var keyBtn = e.target.closest("[data-key]");
        if (keyBtn) {
          e.stopPropagation();
          promptAPIKey(keyBtn.dataset.key);
          return;
        }
        /* 点击 ⬇：下载该模型对话 */
        var dl = e.target.closest("[data-dl]");
        if (dl) {
          e.stopPropagation();
          downloadAIChat(dl.dataset.dl);
          return;
        }
        /* 点击模型项：选择模型 */
        var item = e.target.closest(".ai-model-item");
        if (item) {
          e.stopPropagation();
          closeAIModelMenu();
          selectAIModel(item.dataset.model);
        }
      });
    }

    if (inputEl) {
      inputEl.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 140) + "px";
      });
      inputEl.addEventListener("keydown", function (e) {
        if (
          e.key === "Enter" &&
          !e.shiftKey &&
          !e.isComposing &&
          e.keyCode !== 229
        ) {
          e.preventDefault();
          aiSend();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener("click", function () {
        aiSend();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        clearAIChat();
      });
    }
  }

  /* 路由渲染 */

  function render() {
    var path = getRoute();

    /* 离开首页时，若当前是运行指定脚本状态，则重置为随机状态 */
    if (path !== "/" && path !== "" && path !== "/index.html") {
      if (runner.mode === "page") {
        runner.mode = "random";
        runner.pageId = null;
      }
    }

    /* 首页全屏p5运行器 */
    if (path === "/" || path === "" || path === "/index.html") {
      renderRunner();
      return;
    }

    /* 离开首页：解除全屏锁定，移除AI模式 */
    if (appEl.classList.contains("preview-mode")) {
      appEl.classList.remove("preview-mode");
    }
    appEl.classList.remove("ai-mode");
    delete appEl.dataset.currentPageId;
    unlockAppSize();

    destroyEditor();
    appEl.replaceChildren();
    setActiveNav(path);

    if (path === "/ai") {
      appEl.classList.add("ai-mode");
      appEl.appendChild(renderAIAssistant());
      bindAIAssistant();
      return;
    }

    if (path === "/about") {
      appEl.appendChild(renderAbout());
    } else if (path === "/generator") {
      appEl.appendChild(renderGenerator());
      bindGenerator();
    } else {
      var wrap = document.createElement("div");
      var h = document.createElement("h1");
      h.textContent = "页面 " + path;
      var p = document.createElement("p");
      p.textContent = "内容未定义。";
      wrap.appendChild(h);
      wrap.appendChild(p);
      appEl.appendChild(wrap);
    }
  }

  /* 初始化 */
  function init() {
    modalBackdrop = $("#modalBackdrop");
    modalBox = $("#modalBox");
    sidebarPagesEl = $("#sidebar-pages");
    sidebarEl = $("#sidebar");
    overlayEl = $("#overlay");
    hamburgerBtn = $("#hamburgerBtn");
    appEl = $("#app");
    sidebarSearchEl = $("#sidebarSearch");

    initAIState();

    /* ⭐ 读取保存的主题；如果旧数据里存的是未知 id，
         applyTheme 会自动 fallback 到 THEMES[0]（light） */
    var savedTheme = THEMES[0].id;
    try {
      savedTheme = localStorage.getItem(THEME_KEY) || THEMES[0].id;
    } catch (e) {}
    applyTheme(savedTheme);

    /* 全局禁止缩放 */
    ["gesturestart", "gesturechange", "gestureend"].forEach(function (type) {
      document.addEventListener(
        type,
        function (e) {
          e.preventDefault();
        },
        { passive: false },
      );
    });
    document.addEventListener(
      "touchmove",
      function (e) {
        if (e.touches && e.touches.length > 1) {
          e.preventDefault();
        }
      },
      { passive: false },
    );
    var lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      function (e) {
        var now = Date.now();
        if (now - lastTouchEnd <= 300) {
          var t = e.target;
          var tag = t && t.tagName ? t.tagName.toLowerCase() : "";
          if (
            tag !== "input" &&
            tag !== "textarea" &&
            tag !== "button" &&
            tag !== "select" &&
            tag !== "a"
          ) {
            e.preventDefault();
          }
        }
        lastTouchEnd = now;
      },
      { passive: false },
    );

    /* 点击页面空白处关闭AI模型菜单 */
    document.addEventListener("click", function (e) {
      var menu = $("#aiModelMenu");
      if (!menu || !menu.classList.contains("show")) return;
      var picker = menu.parentNode;
      if (picker && !picker.contains(e.target)) {
        menu.classList.remove("show");
      }
    });

    /* 搜索框 */
    if (sidebarSearchEl) {
      sidebarSearchEl.addEventListener("input", function () {
        sidebarSearchKeyword = this.value || "";
        updateSidebarPages();
      });
      sidebarSearchEl.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          if (this.value) {
            this.value = "";
            sidebarSearchKeyword = "";
            updateSidebarPages();
          }
          e.stopPropagation();
        } else {
          e.stopPropagation();
        }
      });
      sidebarSearchEl.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    hamburgerBtn.addEventListener("click", openSidebar);
    overlayEl.addEventListener("click", closeSidebar);
    modalBackdrop.addEventListener("click", function (e) {
      if (e.target === modalBackdrop) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (modalBackdrop.classList.contains("show")) {
          closeModal();
        } else if (sidebarEl.classList.contains("open")) {
          closeSidebar();
        } else if (runner.mode === "page" && getRoute() === "/") {
          setRandom();
        }
      }
    });

    /* 侧边栏底部 */
    var exportZipBtn = $("#exportZipSidebar");
    if (exportZipBtn) {
      var runExport = function () {
        closeSidebar();
        exportZip();
      };
      exportZipBtn.addEventListener("click", runExport);
      exportZipBtn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          runExport();
        }
      });
    }

    var themeBtn = $("#themeToggleSidebar");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

    /* 顶部导航 */
    $$(".sidebar .nav-item[data-path]").forEach(function (el) {
      var go = function () {
        var path = el.getAttribute("data-path");
        closeSidebar();
        if (path === "#/") {
          setRandom();
          return;
        }
        if (location.hash === path) render();
        else location.hash = path;
      };
      el.addEventListener("click", go);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    });

    /* 侧边栏脚本名 */
    sidebarPagesEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var id = Number(btn.dataset.id);
      var action = btn.dataset.action;
      if (action === "open") {
        closeSidebar();
        runPage(id);
      } else if (action === "rename") {
        renamePage(id);
      } else if (action === "delete") {
        deletePage(id);
      }
    });

    window.addEventListener("hashchange", function () {
      render();
      closeSidebar();
    });

    window.addEventListener("orientationchange", function () {
      if (editor) editor.refresh();
    });

    window.addEventListener("resize", function () {
      if (appEl.classList.contains("preview-mode")) {
        appEl.style.width = window.innerWidth + "px";
        appEl.style.height = window.innerHeight + "px";
      }
      if (editor) editor.refresh();
    });

    updateSidebarPages();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
