(function () {
  "use strict";

  var STORAGE_KEY = "p5_pages";
  var THEME_KEY = "p5_theme";
  var MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

  /* p5脚本文件夹配置 */
  var P5_DIR = "p5/";
  var P5_CDN =
    "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js";
  var P5_FILES = ["sketch1.js", "sketch2.js", "sketch3.js"];

  /* AI助手配置 */
  var AI_KEY_STORAGE = "p5_ai_keys";
  var AI_CHAT_STORAGE = "p5_ai_chats";
  var AI_PROMPT_STORAGE = "p5_ai_prompts";
  var CONTENT_URL = "data/content.json";

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

  /* 内容（由 json 填充） */
  var C = {};

  function t(key) {
    var parts = String(key).split(".");
    var cur = C;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return "";
      cur = cur[parts[i]];
    }
    return cur == null ? "" : cur;
  }

  function tpl(key, vars) {
    var s = String(t(key) || "");
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split("{" + k + "}").join(vars[k]);
      });
    }
    return s;
  }

  function loadContent() {
    return fetch(CONTENT_URL).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  /* 将 data-i18n / data-i18n-placeholder / data-i18n-title / data-i18n-aria-label 填充 */
  function applyI18n(root) {
    var r = root || document;
    $$("[data-i18n]", r).forEach(function (el) {
      var v = t(el.getAttribute("data-i18n"));
      if (v !== "") el.innerHTML = v;
    });
    $$("[data-i18n-placeholder]", r).forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-placeholder"));
      if (v !== "") el.placeholder = v;
    });
    $$("[data-i18n-title]", r).forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-title"));
      if (v !== "") el.title = v;
    });
    $$("[data-i18n-aria-label]", r).forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-aria-label"));
      if (v !== "") el.setAttribute("aria-label", v);
    });
  }

  /*  通用工具   */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(sel),
    );
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

  /* 本地存储 */
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
          t("alerts.storageFullTitle"),
          t("alerts.storageFullDesc"),
          true,
        );
      } else {
        showAlert(t("alerts.saveFailedTitle"), String((e && e.message) || e), true);
      }
      return false;
    }
  }

  /* 弹窗 */
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
      ok.textContent = t("modal.ok");
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
      cancel.textContent = t("modal.cancel");
      cancel.addEventListener("click", closeModal);
      var ok = document.createElement("button");
      ok.textContent = t("modal.confirm");
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
      cancel.textContent = t("modal.cancel");
      cancel.addEventListener("click", closeModal);
      var ok = document.createElement("button");
      ok.textContent = t("modal.save");
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

  /* 多行文本输入弹窗（系统提示词） */
  function showPromptArea(opts) {
    openModal(function (box) {
      var h = document.createElement("h3");
      h.textContent = opts.title;

      var hint = document.createElement("div");
      hint.className = "modal-hint";
      hint.textContent = opts.hint || "";

      var ta = document.createElement("textarea");
      ta.value = opts.value || "";
      ta.placeholder = opts.placeholder || "";
      ta.rows = 7;
      ta.spellcheck = false;

      var a = document.createElement("div");
      a.className = "modal-actions";

      var leftWrap = document.createElement("div");
      if (opts.value && opts.value.trim()) {
        var clearBtn = document.createElement("button");
        clearBtn.className = "link-btn";
        clearBtn.textContent = t("modal.clearPrompt");
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
      cancel.textContent = t("modal.cancel");
      cancel.addEventListener("click", closeModal);

      var ok = document.createElement("button");
      ok.textContent = t("modal.save");
      ok.addEventListener("click", function () {
        var v = ta.value;
        closeModal();
        opts.onOk(v);
      });
      ta.addEventListener("keydown", function (e) {
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

  /* 生成单个HTML */
  function generatePageHtml(title, script, imageDataUrl) {
    var safeTitle = escapeHtml(title || t("generator.defaultPageTitle"));
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
      showAlert(t("alerts.downloadFailedTitle"), String((err && err.message) || err), true);
    }
  }

  function exportZip() {
    var pages = getPages();
    if (!pages.length) {
      showAlert(t("alerts.cannotExportTitle"), t("alerts.cannotExportDesc"));
      return;
    }
    var zip = new JSZip();
    var prefix = t("generator.filePrefix") || "p5_";
    pages.forEach(function (page, idx) {
      var base = (page.title || "untitled").replace(/[\\/:*?"<>|]/g, "_");
      zip.file(prefix + base + "_" + (idx + 1) + ".html", page.html);
    });
    zip
      .generateAsync({ type: "blob" })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = t("generator.zipName") || "p5_works.zip";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
      })
      .catch(function (err) {
        showAlert(t("alerts.exportFailedTitle"), String((err && err.message) || err), true);
      });
  }

  /* AI 状态 */
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
    aiState.currentModel = null;
  }

  /* 全局 DOM 引用 */
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
      "    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; touch-action: none; }\n" +
      "    canvas { display: block; touch-action: none; }\n" +
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
      empty.textContent = kw
        ? t("sidebar.noSearchResult")
        : t("sidebar.emptyPages");
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

  /* iframe 事件代理 */
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
    var TOUCH_TYPES = [
      "touchstart",
      "touchmove",
      "touchend",
      "touchcancel",
    ];

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
        var h1 = document.createElement("h1");
        h1.textContent = t("home.noScriptsTitle");
        var p = document.createElement("p");
        p.textContent = t("home.noScriptsDesc");
        wrap.appendChild(h1);
        wrap.appendChild(p);
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
    iframe.setAttribute("title", t("runner.iframeTitle") || "p5 运行");
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
      t("alerts.deleteTitle"),
      tpl("alerts.deleteConfirm", { title: page.title }),
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
    showPrompt(t("alerts.renameTitle"), page.title, function (newTitle) {
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

  function applyTheme(theme) {
    var lightTheme = $("#cm-theme-light");
    var darkTheme = $("#cm-theme-dark");
    if (theme === "dark") {
      document.body.classList.add("dark-mode");
      if (lightTheme) lightTheme.disabled = true;
      if (darkTheme) darkTheme.disabled = false;
    } else {
      document.body.classList.remove("dark-mode");
      if (lightTheme) lightTheme.disabled = false;
      if (darkTheme) darkTheme.disabled = true;
    }
    if (editor)
      editor.setOption("theme", theme === "dark" ? "dracula" : "default");
  }
  function currentTheme() {
    return document.body.classList.contains("dark-mode") ? "dark" : "light";
  }
  function toggleTheme() {
    var next = currentTheme() === "dark" ? "light" : "dark";
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

  /* 关于页 */
  function renderAbout() {
    var wrap = document.createElement("div");
    var h = document.createElement("h1");
    h.textContent = t("about.title");
    wrap.appendChild(h);
    var paras = t("about.paragraphs");
    if (Array.isArray(paras)) {
      paras.forEach(function (text) {
        var p = document.createElement("p");
        p.textContent = text;
        wrap.appendChild(p);
      });
    }
    return wrap;
  }

  /* 编写脚本页 */
  function renderGenerator() {
    var wrap = document.createElement("div");
    wrap.className = "generator-page";
    wrap.innerHTML =
      '<h1 data-i18n="generator.title"></h1>' +
      '<p data-i18n="generator.subtitle"></p>' +
      '<div class="form-group">' +
      '  <label for="title" data-i18n="generator.labelTitle"></label>' +
      '  <input type="text" id="title" data-i18n-placeholder="generator.placeholderTitle">' +
      "</div>" +
      '<div class="form-group">' +
      '  <label for="script" data-i18n="generator.labelScript"></label>' +
      '  <textarea id="script"></textarea>' +
      "</div>" +
      '<div class="form-group">' +
      '  <label data-i18n="generator.labelImage"></label>' +
      '  <input type="file" id="image" accept="image/*">' +
      '  <div id="image-preview"></div>' +
      "</div>" +
      '<button id="buildBtn" type="button" data-i18n="generator.buildBtn"></button>' +
      '<div id="result" class="result" style="display:none;"></div>';
    applyI18n(wrap);
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
      var themeName = currentTheme() === "dark" ? "dracula" : "default";
      editor = window.CodeMirror.fromTextArea(textarea, {
        mode: "javascript",
        lineNumbers: true,
        theme: themeName,
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
      cmPlaceholderEl.textContent = t("generator.scriptPlaceholder") || "";
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
        showAlert(
          t("alerts.invalidFileTypeTitle"),
          t("alerts.invalidFileTypeDesc"),
          true,
        );
        this.value = "";
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        showAlert(
          t("alerts.imageTooLargeTitle"),
          t("alerts.imageTooLargeDesc"),
          true,
        );
        this.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        uploadedImageDataUrl = e.target.result;
        var tip = document.createElement("p");
        tip.textContent = t("generator.imageSuccess");
        var img = document.createElement("img");
        img.src = e.target.result;
        img.className = "preview-img";
        img.alt = t("generator.imageAlt");
        previewEl.replaceChildren(tip, img);
      };
      reader.onerror = function () {
        showAlert(
          t("alerts.readFailedTitle"),
          t("alerts.readFailedDesc"),
          true,
        );
      };
      reader.readAsDataURL(file);
    });

    buildBtn.addEventListener("click", function () {
      var title = titleInput.value.trim() || t("generator.defaultTitle");
      var script = (editor ? editor.getValue() : textarea.value).trim();
      if (!script) {
        showAlert(
          t("alerts.missingScriptTitle"),
          t("alerts.missingScriptDesc"),
          true,
        );
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
      msg.textContent = t("generator.resultSuccess");

      var btnContainer = document.createElement("div");
      btnContainer.className = "action-buttons";

      var previewBtn = document.createElement("button");
      previewBtn.className = "preview";
      previewBtn.textContent = t("generator.previewBtn");
      previewBtn.addEventListener("click", function () {
        runPage(newId);
      });

      var downloadBtn = document.createElement("button");
      downloadBtn.className = "download";
      downloadBtn.textContent = t("generator.downloadBtn");
      downloadBtn.addEventListener("click", function () {
        downloadSingleHtml(
          (t("generator.filePrefix") || "p5_") +
            safeFileName(title) +
            "_" +
            newId +
            ".html",
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

  /* AI 助手 — 页面渲染 */
  function renderAIAssistant() {
    var wrap = document.createElement("div");
    wrap.className = "ai-page";
    wrap.innerHTML =
      '<button class="ai-clear-btn" id="aiClearBtn" type="button" data-i18n-title="ai.clearBtnTitle">−</button>' +
      '<div class="ai-messages" id="aiMessages"></div>' +
      '<div class="ai-input-wrap">' +
      '  <div class="ai-input-bar">' +
      '    <div class="ai-model-picker">' +
      '      <button class="ai-model-btn" id="aiModelBtn" type="button" data-i18n-title="ai.modelBtnTitle">+</button>' +
      '      <div class="ai-model-menu" id="aiModelMenu"></div>' +
      "    </div>" +
      '    <textarea id="aiInput" rows="1" data-i18n-placeholder="ai.inputPlaceholder"></textarea>' +
      '    <button class="ai-send-btn" id="aiSendBtn" type="button" data-i18n-title="ai.sendBtnTitle">↑</button>' +
      "  </div>" +
      "</div>";
    applyI18n(wrap);
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

      var promptBtn = document.createElement("button");
      promptBtn.className = "ai-prompt";
      promptBtn.type = "button";
      promptBtn.title = t("ai.modelPromptTitle");
      promptBtn.textContent = "🎭";
      promptBtn.dataset.prompt = m.id;
      if (aiState.prompts[m.id] && aiState.prompts[m.id].trim()) {
        promptBtn.classList.add("has-prompt");
      }

      var keyBtn = document.createElement("button");
      keyBtn.className = "ai-key";
      keyBtn.type = "button";
      keyBtn.title = t("ai.modelKeyTitle");
      keyBtn.textContent = "🔑";
      keyBtn.dataset.key = m.id;

      var dl = document.createElement("button");
      dl.className = "ai-dl";
      dl.type = "button";
      dl.title = t("ai.modelDownloadTitle");
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
      empty.textContent = t("ai.emptyNoModel");
      box.replaceChildren(empty);
      return;
    }

    var chat = aiState.chats[model] || [];
    if (!chat.length) {
      var empty2 = document.createElement("div");
      empty2.className = "ai-empty";
      empty2.textContent = tpl("ai.emptyStart", { model: aiModelName(model) });
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
        b.textContent = t("ai.thinking");
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
        return res.text().then(function (txt) {
          var msg = "HTTP " + res.status;
          try {
            var d = JSON.parse(txt);
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

  function promptAPIKey(model, onSaved) {
    showPrompt(
      tpl("ai.promptKeyTitle", { model: aiModelName(model) }),
      aiState.keys[model] || "",
      function (v) {
        aiState.keys[model] = v;
        saveAIKeys();
        if (onSaved) onSaved();
      },
      "password",
    );
  }

  function promptSystemPrompt(model) {
    var existing = aiState.prompts[model] || "";
    showPromptArea({
      title: tpl("ai.promptSystemTitle", { model: aiModelName(model) }),
      hint: t("ai.promptSystemHint"),
      value: existing,
      placeholder: t("ai.promptSystemPlaceholder"),
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
      showAlert(
        t("alerts.cannotDownloadTitle"),
        tpl("alerts.cannotDownloadDesc", { model: aiModelName(model) }),
      );
      return;
    }
    var lines = [
      tpl("ai.downloadHeader", { model: aiModelName(model) }),
      "",
    ];
    var sys = aiState.prompts[model];
    if (sys && sys.trim()) {
      lines.push(t("ai.downloadSysSection"));
      lines.push("");
      lines.push(sys);
      lines.push("");
    }
    chat.forEach(function (m) {
      lines.push(
        m.role === "user"
          ? t("ai.downloadUserSection")
          : tpl("ai.downloadAssistantSection", { model: aiModelName(model) }),
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
    a.download =
      (t("ai.filePrefix") || "ai_chat_") + model + "_" + Date.now() + ".md";
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
      showAlert(t("alerts.needModelTitle"), t("alerts.needModelDesc"), true);
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
    chat.push({ role: "assistant", content: "" });
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
          var s = "";
          for (var i = 0; i < cand.content.parts.length; i++) {
            s += cand.content.parts[i].text || "";
          }
          pushDelta(s);
        }
      } else {
        var d = obj.choices && obj.choices[0] && obj.choices[0].delta;
        if (d && d.content) pushDelta(d.content);
      }
    };

    var payload = chat.slice(0, -1);
    var systemPrompt = aiState.prompts[model] || "";

    streamAI(model, key, payload, systemPrompt, onDelta)
      .then(function () {
        chat[chat.length - 1].content = accumulated || t("ai.emptyReply");
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
          t("alerts.requestFailedTitle"),
          String((err && err.message) || err) || t("alerts.requestFailedDesc"),
          true,
        );
      });
  }

  function clearAIChat() {
    var model = aiState.currentModel;
    if (!model) {
      showAlert(
        t("alerts.noNeedClearTitle"),
        t("alerts.noNeedClearModelDesc"),
      );
      return;
    }
    var chat = aiState.chats[model] || [];
    if (!chat.length) {
      showAlert(
        t("alerts.noNeedClearTitle"),
        tpl("alerts.noNeedClearChatDesc", { model: aiModelName(model) }),
      );
      return;
    }
    showConfirm(
      t("alerts.clearChatTitle"),
      tpl("alerts.clearChatConfirm", { model: aiModelName(model) }),
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
        var promptBtn = e.target.closest("[data-prompt]");
        if (promptBtn) {
          e.stopPropagation();
          closeAIModelMenu();
          promptSystemPrompt(promptBtn.dataset.prompt);
          return;
        }
        var keyBtn = e.target.closest("[data-key]");
        if (keyBtn) {
          e.stopPropagation();
          promptAPIKey(keyBtn.dataset.key);
          return;
        }
        var dl = e.target.closest("[data-dl]");
        if (dl) {
          e.stopPropagation();
          downloadAIChat(dl.dataset.dl);
          return;
        }
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

    if (path !== "/" && path !== "" && path !== "/index.html") {
      if (runner.mode === "page") {
        runner.mode = "random";
        runner.pageId = null;
      }
    }

    if (path === "/" || path === "" || path === "/index.html") {
      renderRunner();
      return;
    }

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
      h.textContent = t("unknown.titlePrefix") + path;
      var p = document.createElement("p");
      p.textContent = t("unknown.desc");
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

    // 填充页面标题与静态文本
    document.title = t("meta.title") || document.title;
    applyI18n(document);
    if (!appEl.textContent.trim()) appEl.textContent = t("meta.loading");

    initAIState();

    var savedTheme = "light";
    try {
      savedTheme = localStorage.getItem(THEME_KEY) || "light";
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
          var tgt = e.target;
          var tag = tgt && tgt.tagName ? tgt.tagName.toLowerCase() : "";
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

  /* 启动：先加载json */
  loadContent()
    .then(function (data) {
      C = data || {};
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    })
    .catch(function (err) {
      console.error("加载 content.json 失败：", err);
      var app = document.getElementById("app");
      if (app) {
        app.textContent = tpl("meta.contentLoadFailed", {
          msg: (err && err.message) || String(err),
        });
      }
    });
})();