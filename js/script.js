(function () {
  "use strict";
  /* J1 常量声明 */
  var STORAGE_KEY = "p5_pages";
  var THEME_KEY = "p5_theme";
  var LANG_KEY = "p5_lang";
  var DRAFT_KEY = "p5_gen_draft";
  var MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
  var MAX_SESSION_IMAGES = 10;
  var P5_DIR = "p5/";
  var P5_CDN =
    "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js";
  var P5_FILES = ["sketch1.js", "sketch2.js", "sketch3.js"];
  var AI_KEY_STORAGE = "p5_ai_keys";
  var AI_CHAT_STORAGE = "p5_ai_chats";
  var AI_PROMPT_STORAGE = "p5_ai_prompts";
  var AI_CUSTOM_MODELS_STORAGE = "p5_ai_custom_models";
  var AI_CURRENT_MODEL_STORAGE = "p5_ai_current_model";
  var MAX_CONTEXT_MESSAGES = 30;
  var MAX_TOOL_LOOP = 5;
  var REQUEST_TIMEOUT_MS = 60000;
  var TEST_TIMEOUT_MS = 15000;
  var MAX_TITLE_LEN = 60;
  var CONTENT_URL = "data/content.json";
  var LONG_PRESS_MS = 500;
  var FLASH_TIP_MS = 1200;
  var NEAR_BOTTOM_PX = 80;
  var SEARCH_DEBOUNCE_MS = 150;
  var STORAGE_KB_MULTIPLIER = 2;

  var TOOL_SPECS = [
    {
      name: "insert_code",
      description:
        "用新代码完全替换编辑器中的内容。适用于：从零开始写、要求重写、修改较大时。",
      params: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "完整的 p5.js 代码（含 setup / draw 等），不要加 markdown 代码块标记",
          },
        },
        required: ["code"],
      },
    },
    {
      name: "append_code",
      description:
        "在编辑器现有内容末尾追加代码。适用于：用户明确说“追加”“再加一段”“在末尾添加”时。",
      params: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "要追加的 p5.js 代码片段，不要加 markdown 代码块标记",
          },
        },
        required: ["code"],
      },
    },
    {
      name: "get_current_code",
      description:
        "读取编辑器当前内容。适用于：需要在已有代码基础上修改时，先读取再决定怎么改。",
      params: { type: "object", properties: {} },
    },
    {
      name: "replace_selection",
      description:
        "替换编辑器当前选中的文本。适用于：用户要求只改某段代码，且已选中时。",
      params: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "替换选中内容的 p5.js 代码片段",
          },
        },
        required: ["code"],
      },
    },
    {
      name: "get_canvas_size",
      description:
        "获取当前画布尺寸（宽 × 高）。适用于：需要根据画布尺寸生成代码时。",
      params: { type: "object", properties: {} },
    },
    {
      name: "set_color_palette",
      description:
        "设置配色方案。适用于：用户要求换一组配色，或需要统一色彩风格时。",
      params: {
        type: "object",
        properties: {
          colors: {
            type: "array",
            description: "颜色数组，RGB 十六进制字符串，如 #FF0000",
            items: { type: "string" },
          },
        },
        required: ["colors"],
      },
    },
    {
      name: "save_page",
      description:
        "保存当前编辑器内容为作品。适用于：用户明确说“保存”且希望直接保存时。",
      params: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "作品标题，可选，默认使用编辑器标题栏的内容",
          },
        },
      },
    },
    {
      name: "open_preview",
      description:
        "打开当前编辑器内容的预览。适用于：用户说“看一下效果”“预览”时。",
      params: { type: "object", properties: {} },
    },
  ];

  function _toGeminiType(t) {
    return String(t || "").toUpperCase();
  }
  function _toGeminiSchema(schema) {
    if (!schema || typeof schema !== "object") return schema;
    var out = { type: _toGeminiType(schema.type) };
    if (schema.description) out.description = schema.description;
    if (schema.properties) {
      out.properties = {};
      Object.keys(schema.properties).forEach(function (k) {
        out.properties[k] = _toGeminiSchema(schema.properties[k]);
      });
    }
    if (schema.items) out.items = _toGeminiSchema(schema.items);
    if (schema.required) out.required = schema.required.slice();
    return out;
  }
  function buildOpenAITools() {
    return TOOL_SPECS.map(function (t) {
      return {
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.params,
        },
      };
    });
  }
  function buildGeminiTools() {
    return [
      {
        functionDeclarations: TOOL_SPECS.map(function (t) {
          return {
            name: t.name,
            description: t.description,
            parameters: _toGeminiSchema(t.params),
          };
        }),
      },
    ];
  }

  var AI_MODELS = [];
  var I18N = {};
  var LANG = "zh";
  var CONTENT = null;

  /* J2 全局状态 */
  var aiState = {
    currentModel: null,
    keys: {},
    chats: {},
    prompts: {},
    customModels: [],
    busy: false,
    abortController: null,
    streamToken: 0,
  };
  var genState = {
    messages: [],
    busy: false,
    abortController: null,
    streamToken: 0,
    menuOpen: false,
    palette: null,
  };
  var modalBackdrop, modalBox, lastFocused;
  var sidebarPagesEl, sidebarEl, overlayEl, hamburgerBtn;
  var sidebarSearchEl;
  var sidebarSearchKeyword = "";
  var sidebarSearchTimer = null;
  var appEl;
  var runner = { mode: "random", pageId: null, tempHtml: null };
  var currentRandomFile = null;
  var editor = null;
  var uploadedImageDataUrl = null;
  var uploadedImageInfo = null;
  var sessionImages = {};
  var generatorDraft = { title: "", script: "" };
  var renderedMsgCount = 0;
  var renderedModelId = null;

  /* J3 i18n */
  function T(key, params) {
    var pack = I18N[LANG] || I18N.zh || {};
    var text = pack[key];
    if (text == null) text = (I18N.zh && I18N.zh[key]) || key;
    if (params) {
      text = String(text).replace(/\{(\w+)\}/g, function (m, k) {
        return params[k] != null ? String(params[k]) : m;
      });
    }
    return text;
  }
  function detectLang() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved && I18N[saved]) return saved;
    } catch (e) {}
    var nav = (navigator.language || "zh").toLowerCase();
    if (nav.indexOf("zh") === 0) return "zh";
    if (nav.indexOf("en") === 0) return "en";
    if (CONTENT && CONTENT.defaultLang && I18N[CONTENT.defaultLang]) {
      return CONTENT.defaultLang;
    }
    return "en";
  }
  var _i18nCache = null;
  function _collectI18nNodes() {
    _i18nCache = {
      text: $$("[data-i18n]"),
      placeholder: $$("[data-i18n-placeholder]"),
      title: $$("[data-i18n-title]"),
      aria: $$("[data-i18n-aria]"),
    };
  }
  function applyI18nToStatic() {
    if (!_i18nCache) _collectI18nNodes();
    _i18nCache.text.forEach(function (el) {
      var text = T(el.getAttribute("data-i18n"));
      var span = el.querySelector("span");
      if (span) {
        span.textContent = text;
      } else {
        el.textContent = text;
      }
    });
    _i18nCache.placeholder.forEach(function (el) {
      var k = el.getAttribute("data-i18n-placeholder");
      el.setAttribute("placeholder", T(k));
      el.setAttribute("aria-label", T(k));
    });
    _i18nCache.title.forEach(function (el) {
      el.setAttribute("title", T(el.getAttribute("data-i18n-title")));
    });
    _i18nCache.aria.forEach(function (el) {
      el.setAttribute("aria-label", T(el.getAttribute("data-i18n-aria")));
    });
    try {
      document.title = T("site.title");
      document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
    } catch (e) {}
  }

  /* J4 模型查询 */
  function getAllModels() {
    return AI_MODELS.concat(aiState.customModels || []);
  }
  function getToolModels() {
    return getAllModels().filter(function (m) {
      return m.supportsTools === true;
    });
  }
  function aiModelConf(id) {
    var all = getAllModels();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null;
  }
  function aiModelName(id) {
    var c = aiModelConf(id);
    return c ? c.name : id;
  }

  /* J5 AI存储 */
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
      return true;
    } catch (e) {
      handleStorageQuotaError(e, "storage.ctxKeys");
      return false;
    }
  }
  function loadCurrentModel() {
    try {
      return localStorage.getItem(AI_CURRENT_MODEL_STORAGE) || null;
    } catch (e) {
      return null;
    }
  }
  function saveCurrentModel(id) {
    try {
      if (id) localStorage.setItem(AI_CURRENT_MODEL_STORAGE, id);
      else localStorage.removeItem(AI_CURRENT_MODEL_STORAGE);
    } catch (e) {}
  }
  function loadAIChats() {
    var result = {};
    getAllModels().forEach(function (m) {
      try {
        var raw = localStorage.getItem(AI_CHAT_STORAGE + "_" + m.id);
        var v = raw ? JSON.parse(raw) : [];
        result[m.id] = Array.isArray(v) ? v : [];
      } catch (e) {
        result[m.id] = [];
      }
    });
    return result;
  }
  function saveAIChats(modelId) {
    if (!modelId) return true;
    try {
      localStorage.setItem(
        AI_CHAT_STORAGE + "_" + modelId,
        JSON.stringify(aiState.chats[modelId] || []),
      );
      return true;
    } catch (e) {
      handleStorageQuotaError(e, "storage.ctxChats");
      return false;
    }
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
      localStorage.setItem(
        AI_PROMPT_STORAGE,
        JSON.stringify(aiState.prompts),
      );
      return true;
    } catch (e) {
      handleStorageQuotaError(e, "storage.ctxPrompts");
      return false;
    }
  }
  function loadCustomModels() {
    try {
      var raw = localStorage.getItem(AI_CUSTOM_MODELS_STORAGE);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }
  function saveCustomModels() {
    try {
      localStorage.setItem(
        AI_CUSTOM_MODELS_STORAGE,
        JSON.stringify(aiState.customModels || []),
      );
      return true;
    } catch (e) {
      handleStorageQuotaError(e, "storage.ctxCustomModels");
      return false;
    }
  }
  function initAIState() {
    aiState.keys = loadAIKeys();
    aiState.customModels = loadCustomModels();
    aiState.chats = loadAIChats();
    aiState.prompts = loadAIPrompts();
    getAllModels().forEach(function (m) {
      if (!Array.isArray(aiState.chats[m.id])) aiState.chats[m.id] = [];
      if (typeof aiState.prompts[m.id] !== "string") aiState.prompts[m.id] = "";
    });
    /* 【新增】A1: 恢复上次模型 */
    var saved = loadCurrentModel();
    aiState.currentModel = saved && aiModelConf(saved) ? saved : null;
  }

  /* J6 页面与草稿存储 */
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
      handleStorageQuotaError(e, "storage.ctxPages");
      return false;
    }
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (o && typeof o === "object") {
        return {
          title: typeof o.title === "string" ? o.title : "",
          script: typeof o.script === "string" ? o.script : "",
        };
      }
    } catch (e) {}
    return { title: "", script: "" };
  }
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(generatorDraft));
    } catch (e) {}
  }
  function clearDraft() {
    generatorDraft = { title: "", script: "" };
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }

  /* J7 存储配额 */
  function isQuotaError(e) {
    if (!e) return false;
    if (e.name === "QuotaExceededError") return true;
    if (e.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
    if (e.code === 22 || e.code === 1014) return true;
    return false;
  }
  function estimateLocalStorageKB() {
    var total = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var v = localStorage.getItem(k) || "";
        total += k.length + v.length;
      }
    } catch (e) {
      return -1;
    }
    return Math.round((total * STORAGE_KB_MULTIPLIER) / 1024);
  }
  function handleStorageQuotaError(e, contextKey) {
    if (!isQuotaError(e)) {
      showAlert(
        T("storage.saveFailTitle"),
        String((e && e.message) || e || "?"),
        true,
      );
      return;
    }
    var usedKB = estimateLocalStorageKB();
    var usedText = usedKB >= 0 ? T("storage.used", { kb: usedKB }) : "";
    showAlert(
      T("storage.fullTitle"),
      T("storage.fullBody", {
        context: contextKey ? T(contextKey) : "?",
        used: usedText,
      }),
      true,
    );
  }

  /* J8 DOM工具 */
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
    var LT = "\x3C";
    return String(str)
      .replace(new RegExp(LT + "/script", "gi"), LT + "\\/script")
      .replace(new RegExp(LT + "!--", "g"), LT + "\\!--")
      .replace(new RegExp(LT + "script", "gi"), LT + "\\script");
  }
  function safeFileName(name) {
    var n = String(name || "")
      .replace(/[\\/:*?"<>|~#%&{}]/g, "_")
      .replace(/\s+/g, "_")
      .trim();
    if (n.length > MAX_TITLE_LEN) n = n.slice(0, MAX_TITLE_LEN);
    return n || "untitled";
  }
  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }
  function rightGroup() {
    return el("div", "right-group");
  }

  /* J9 模态框系统 */
  var _modalFocusHandler = null;
  function _installFocusTrap(box) {
    _removeFocusTrap();
    _modalFocusHandler = function (e) {
      if (e.key !== "Tab") return;
      var focusables = box.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    box.addEventListener("keydown", _modalFocusHandler);
  }
  function _removeFocusTrap() {
    if (_modalFocusHandler && modalBox) {
      modalBox.removeEventListener("keydown", _modalFocusHandler);
    }
    _modalFocusHandler = null;
  }
  function openModal(builder) {
    lastFocused = document.activeElement;
    modalBox.innerHTML = "";
    modalBox.removeAttribute("aria-labelledby");
    builder(modalBox);
    var h3 = modalBox.querySelector("h3");
    if (h3) {
      if (!h3.id) h3.id = "modalTitle_" + Date.now();
      modalBox.setAttribute("aria-labelledby", h3.id);
    }
    modalBackdrop.classList.add("show");
    _installFocusTrap(modalBox);
    var f = $("input, textarea, button", modalBox);
    if (f && f.focus) f.focus();
  }
  function closeModal() {
    _removeFocusTrap();
    modalBackdrop.classList.remove("show");
    modalBox.innerHTML = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  function showAlert(title, message, isError) {
    openModal(function (box) {
      box.appendChild(el("h3", null, title));
      if (message) box.appendChild(el("p", null, message));
      var a = el("div", "modal-actions");
      var rg = rightGroup();
      var ok = el("button", isError ? "danger" : null, T("common.know"));
      ok.addEventListener("click", closeModal);
      rg.appendChild(ok);
      a.appendChild(rg);
      box.appendChild(a);
    });
  }
  function showConfirm(title, message, onConfirm, danger) {
    openModal(function (box) {
      box.appendChild(el("h3", null, title));
      if (message) box.appendChild(el("p", null, message));
      var a = el("div", "modal-actions");
      var rg = rightGroup();
      var cancel = el("button", "cancel", T("common.cancel"));
      cancel.addEventListener("click", closeModal);
      var ok = el("button", danger ? "danger" : null, T("common.ok"));
      ok.addEventListener("click", function () {
        closeModal();
        onConfirm();
      });
      rg.appendChild(cancel);
      rg.appendChild(ok);
      a.appendChild(rg);
      box.appendChild(a);
    });
  }
  
function showPrompt(title, defaultValue, onOk, inputType, hint, opts) {
  openModal(function (box) {
    box.appendChild(el("h3", null, title));
    if (hint) box.appendChild(el("div", "modal-hint", hint));
    var input = document.createElement("input");
    input.type = inputType || "text";
    input.value = defaultValue || "";
    input.autocomplete = "off";
    input.spellcheck = false;
    var a = el("div", "modal-actions");
    /* 【新增】F1+: 可选左侧清除按钮 */
    var leftWrap = document.createElement("div");
    if (opts && opts.onClear) {
      var clearBtn = el(
        "button",
        "link-btn",
        opts.clearText || T("common.delete"),
      );
      clearBtn.type = "button";
      clearBtn.addEventListener("click", function () {
        closeModal();
        opts.onClear();
      });
      leftWrap.appendChild(clearBtn);
    }
    var rg = rightGroup();
    var cancel = el("button", "cancel", T("common.cancel"));
    cancel.addEventListener("click", closeModal);
    var ok = el("button", null, T("common.save"));
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
    rg.appendChild(cancel);
    rg.appendChild(ok);
    a.appendChild(leftWrap);
    a.appendChild(rg);
    box.appendChild(input);
    box.appendChild(a);
  });
}
  /*
  function showPrompt(title, defaultValue, onOk, inputType) {
    openModal(function (box) {
      box.appendChild(el("h3", null, title));
      var input = document.createElement("input");
      input.type = inputType || "text";
      input.value = defaultValue || "";
      input.autocomplete = "off";
      input.spellcheck = false;
      var a = el("div", "modal-actions");
      var rg = rightGroup();
      var cancel = el("button", "cancel", T("common.cancel"));
      cancel.addEventListener("click", closeModal);
      var ok = el("button", null, T("common.save"));
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
      rg.appendChild(cancel);
      rg.appendChild(ok);
      a.appendChild(rg);
      box.appendChild(input);
      box.appendChild(a);
    });
  }
  */
  function showPromptArea(opts) {
    openModal(function (box) {
      box.appendChild(el("h3", null, opts.title));
      box.appendChild(
        el("div", "modal-hint", opts.hint || T("ai.setPromptHint")),
      );
      var ta = document.createElement("textarea");
      ta.value = opts.value || "";
      ta.placeholder = opts.placeholder || "";
      ta.rows = 7;
      ta.spellcheck = false;
      var a = el("div", "modal-actions");
      var leftWrap = document.createElement("div");
      if (opts.value && opts.value.trim()) {
        var clearBtn = el("button", "link-btn", T("ai.clearPrompt"));
        clearBtn.addEventListener("click", function () {
          closeModal();
          if (opts.onClear) opts.onClear();
        });
        leftWrap.appendChild(clearBtn);
      }
      var rg = rightGroup();
      var cancel = el("button", "cancel", T("common.cancel"));
      cancel.addEventListener("click", closeModal);
      var ok = el("button", null, T("common.save"));
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
      rg.appendChild(cancel);
      rg.appendChild(ok);
      a.appendChild(leftWrap);
      a.appendChild(rg);
      box.appendChild(ta);
      box.appendChild(a);
    });
  }
  function showIntentChoice(title, message, onOverwrite, onModify) {
    openModal(function (box) {
      box.appendChild(el("h3", null, title));
      box.appendChild(el("p", null, message));
      var a = el("div", "modal-actions");
      var leftWrap = document.createElement("div");
      var cancel = el("button", "link-btn", T("common.cancel"));
      cancel.addEventListener("click", closeModal);
      leftWrap.appendChild(cancel);
      var rg = rightGroup();
      var modifyBtn = el("button", "cancel", T("gen.intentModify"));
      modifyBtn.addEventListener("click", function () {
        closeModal();
        onModify();
      });
      var overwriteBtn = el("button", "danger", T("gen.intentOverwrite"));
      overwriteBtn.addEventListener("click", function () {
        closeModal();
        onOverwrite();
      });
      rg.appendChild(modifyBtn);
      rg.appendChild(overwriteBtn);
      a.appendChild(leftWrap);
      a.appendChild(rg);
      box.appendChild(a);
    });
  }
  
  /* J10 页面生成与导出 */
  function generatePageHtml(title, script, imageDataUrl, hasImage) {
    var safeTitle = escapeHtml(
      (title || T("generator.untitledPage")).slice(0, MAX_TITLE_LEN),
    );
    var imgVar;
    if (imageDataUrl) {
      imgVar = 'var imageUrl = "' + imageDataUrl + '";';
    } else if (hasImage) {
      imgVar =
        "/* 原作品含用户上传的图片，因存储优化未嵌入此文件。\n" +
        "   预览时可在本工具中查看图片效果；\n" +
        "   若要在下载的文件里使用图片，请在工具中重新上传后再导出。 */\n" +
        "    var imageUrl = null;";
    } else {
      imgVar = "var imageUrl = null;";
    }
    var safeImgVar = escapeScriptClose(imgVar);
    var safeScript = escapeScriptClose(script);

    return (
      "<!DOCTYPE html>\n" +
      '<html lang="zh-CN">\n' +
      "<head>\n" +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">\n' +
      "  <title>" +
      safeTitle +
      "</title>\n" +
      "  <style>\n" +
      "    html, body { margin: 0; padding: 0; touch-action: none; }\n" +
      "    canvas { display: block; touch-action: none; }\n" +
      "  </style>\n" +
      '  \x3Cscript src="' +
      P5_CDN +
      '">\x3C/script>\n' +
      "</head>\n" +
      "<body>\n" +
      "  \x3Cscript>\n" +
      "    " +
      safeImgVar +
      "\n" +
      "    " +
      safeScript +
      "\n" +
      "  \x3C/script>\n" +
      "</body>\n" +
      "</html>"
    );
  }
  function injectSessionImage(html, dataUrl) {
    if (!html || !dataUrl) return html;
    var escaped = String(dataUrl)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
    return html.replace(
      /var imageUrl = (?:null|"[^"]*");/,
      'var imageUrl = "' + escaped + '";',
    );
  }
  function downloadSingleHtml(filename, html) {
    try {
      var encoded = btoa(unescape(encodeURIComponent(html)));
      var url = "data:text/html;charset=utf-8;base64," + encoded;
      var link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      try {
        var blob = new Blob([html], { type: "text/html;charset=utf-8" });
        var burl = URL.createObjectURL(blob);
        var b = document.createElement("a");
        b.href = burl;
        b.download = filename;
        b.style.display = "none";
        document.body.appendChild(b);
        b.click();
        document.body.removeChild(b);
        setTimeout(function () {
          URL.revokeObjectURL(burl);
        }, 1000);
      } catch (err2) {
        showAlert(
          T("page.downloadFailTitle"),
          String((err2 && err2.message) || err2),
          true,
        );
      }
    }
  }
  function exportZip() {
    var pages = getPages();
    if (!pages.length) {
      showAlert(T("page.exportEmptyTitle"), T("page.exportEmptyBody"));
      return;
    }
    var zip = new JSZip();
    pages.forEach(function (page, idx) {
      var base = safeFileName(page.title);
      zip.file("p5_" + base + "_" + (idx + 1) + ".html", page.html);
    });
    zip
      .generateAsync({ type: "base64" })
      .then(function (base64) {
        try {
          var url = "data:application/zip;base64," + base64;
          var link = document.createElement("a");
          link.href = url;
          link.download = "p5_works.zip";
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (e) {
          zip
            .generateAsync({ type: "blob" })
            .then(function (blob) {
              var burl = URL.createObjectURL(blob);
              var b = document.createElement("a");
              b.href = burl;
              b.download = "p5_works.zip";
              b.style.display = "none";
              document.body.appendChild(b);
              b.click();
              document.body.removeChild(b);
              setTimeout(function () {
                URL.revokeObjectURL(burl);
              }, 1000);
            })
            .catch(function (err2) {
              showAlert(
                T("page.exportFailTitle"),
                String((err2 && err2.message) || err2),
                true,
              );
            });
        }
      })
      .catch(function (err) {
        showAlert(
          T("page.exportFailTitle"),
          String((err && err.message) || err),
          true,
        );
      });
  }
  /* J10 页面生成与导出 /
  function generatePageHtml(title, script, imageDataUrl, hasImage) {
    var safeTitle = escapeHtml(
      (title || T("generator.untitledPage")).slice(0, MAX_TITLE_LEN),
    );
    var imgVar;
    if (imageDataUrl) {
      imgVar = 'var imageUrl = "' + imageDataUrl + '";';
    } else if (hasImage) {
      imgVar =
        "/* 原作品含用户上传的图片，因存储优化未嵌入此文件。\n" +
        "   预览时可在本工具中查看图片效果；\n" +
        "   若要在下载的文件里使用图片，请在工具中重新上传后再导出。 /\n" +
        "    var imageUrl = null;";
    } else {
      imgVar = "var imageUrl = null;";
    }
    var safeImgVar = escapeScriptClose(imgVar);
    var safeScript = escapeScriptClose(script);

    return (
      "<!DOCTYPE html>\n" +
      '<html lang="zh-CN">\n' +
      "<head>\n" +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">\n' +
      "  <title>" +
      safeTitle +
      "</title>\n" +
      "  <style>\n" +
      "    html, body { margin: 0; padding: 0; touch-action: none; }\n" +
      "    canvas { display: block; touch-action: none; }\n" +
      "  </style>\n" +
      '  \x3Cscript src="' +
      P5_CDN +
      '">\x3C/script>\n' +
      "</head>\n" +
      "<body>\n" +
      "  \x3Cscript>\n" +
      "    " +
      safeImgVar +
      "\n" +
      "    " +
      safeScript +
      "\n" +
      "  \x3C/script>\n" +
      "</body>\n" +
      "</html>"
    );
  }
  function injectSessionImage(html, dataUrl) {
    if (!html || !dataUrl) return html;
    var escaped = String(dataUrl)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
    return html.replace(
      /var imageUrl = (?:null|"[^"]*");/,
      'var imageUrl = "' + escaped + '";',
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
      showAlert(
        T("page.downloadFailTitle"),
        String((err && err.message) || err),
        true,
      );
    }
  }
  function exportZip() {
    var pages = getPages();
    if (!pages.length) {
      showAlert(T("page.exportEmptyTitle"), T("page.exportEmptyBody"));
      return;
    }
    var zip = new JSZip();
    pages.forEach(function (page, idx) {
      var base = safeFileName(page.title);
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
        showAlert(
          T("page.exportFailTitle"),
          String((err && err.message) || err),
          true,
        );
      });
  }
  */

  /* J11 随机p5与srcdoc */
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
      '  \x3Cscript src="' +
      P5_CDN +
      '">\x3C/script>\n' +
      '  \x3Cscript src="' +
      src +
      '">\x3C/script>\n' +
      "</head>\n" +
      "<body></body>\n" +
      "</html>"
    );
  }

  /* J12 侧边栏页面列表 */
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
      var empty = el("div", "no-pages");
      empty.textContent = kw ? T("nav.noMatch") : T("nav.noScripts");
      sidebarPagesEl.replaceChildren(empty);
      return;
    }
    var frag = document.createDocumentFragment();
    filtered.forEach(function (page) {
      var item = el("div", "page-item");
      var title = el("span", "page-title", page.title);
      title.dataset.action = "open";
      title.dataset.id = String(page.id);
      var actions = el("div", "actions");
      var renameBtn = el("button", "rename", "✎ ");
      renameBtn.title = T("common.rename");
      renameBtn.dataset.action = "rename";
      renameBtn.dataset.id = String(page.id);
      var delBtn = el("button", "del", " ✕");
      delBtn.title = T("common.delete");
      delBtn.dataset.action = "delete";
      delBtn.dataset.id = String(page.id);
      actions.appendChild(renameBtn);
      actions.appendChild(delBtn);
      item.appendChild(title);
      item.appendChild(actions);
      frag.appendChild(item);
    });
    sidebarPagesEl.replaceChildren(frag);
  }


  /* J13 iframe代理 */
  function bindIframeProxy(iframe) {
    var iwin, idoc;
    try {
      iwin = iframe.contentWindow;
      idoc = iframe.contentDocument;
    } catch (e) {
      console.warn("Cannot access iframe document:", e);
      return;
    }
    if (!iwin || !idoc) return;

    function tryAttach() {
      var canvas = idoc.querySelector("canvas");
      if (canvas) {
        attachProxy(canvas, iwin, idoc);
        return true;
      }
      return false;
    }
    if (tryAttach()) return;
    var observer = new MutationObserver(function () {
      if (tryAttach()) observer.disconnect();
    });
    observer.observe(idoc.documentElement || idoc, {
      childList: true,
      subtree: true,
    });
    setTimeout(function () {
      try {
        observer.disconnect();
      } catch (e) {}
    }, 15000);
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

  /* J14 预览锁定与截图 */
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
  function buildScreenshotButton(iframe) {
    var btn = el("button", "preview-screenshot-btn", "📷");
    btn.id = "screenshotBtn";
    btn.type = "button";
    btn.title = T("preview.screenshot");
    btn.addEventListener("click", function () {
      try {
        var doc = iframe.contentDocument;
        if (!doc) throw new Error("no doc");
        var canvas = doc.querySelector("canvas");
        if (!canvas) {
          showAlert(T("preview.screenshot"), T("preview.noCanvas"), true);
          return;
        }
        var dataUrl = canvas.toDataURL("image/png");
        var a = document.createElement("a");
        a.href = dataUrl;
        a.download = "canvas_" + Date.now() + ".png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) {
        showAlert(
          T("preview.screenshot"),
          T("preview.screenshotFail"),
          true,
        );
      }
    });
    return btn;
  }

  /* J15 首页运行器 */
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
        if (sessionImages[page.id]) {
          html = injectSessionImage(html, sessionImages[page.id]);
        }
        appEl.dataset.currentPageId = String(page.id);
      } else {
        runner.mode = "random";
        runner.pageId = null;
      }
    }
    if (runner.mode === "temp") {
      html = runner.tempHtml || null;
      runner.mode = "random";
      runner.tempHtml = null;
      delete appEl.dataset.currentPageId;
    }
    if (html === null) {
      var file = pickRandomP5File();
      if (!file) {
        unlockAppSize();
        delete appEl.dataset.currentPageId;
        var wrap = document.createElement("div");
        wrap.appendChild(el("h1", null, T("runner.noScriptTitle")));
        wrap.appendChild(el("p", null, T("runner.noScriptBody")));
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
    iframe.setAttribute("title", "p5");
    iframe.setAttribute("scrolling", "no");
    iframe.srcdoc = html;
    iframe.addEventListener("load", function () {
      bindIframeProxy(iframe);
    });
    appEl.appendChild(iframe);
    if (runner.mode === "page") {
      appEl.appendChild(buildScreenshotButton(iframe));
    }
  }
  function setRandom() {
    runner.mode = "random";
    runner.pageId = null;
    runner.tempHtml = null;
    if (getRoute() === "/") render();
    else location.hash = "#/";
  }
  function runPage(id) {
    runner.mode = "page";
    runner.pageId = id;
    runner.tempHtml = null;
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
      T("page.deleteTitle"),
      T("page.deleteBody", { title: page.title }),
      function () {
        var list = getPages().filter(function (p) {
          return p.id !== id;
        });
        savePages(list);
        updateSidebarPages();
        if (sessionImages[id]) delete sessionImages[id];
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
    showPrompt(T("page.renameTitle"), page.title, function (newTitle) {
      page.title = newTitle;
      savePages(pages);
      updateSidebarPages();
      render();
    });
  }

  /* J16 侧边栏与主题 */
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
    if (editor) {
      try {
        editor.setOption("theme", theme === "dark" ? "dracula" : "default");
      } catch (e) {}
    }
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


  /* J17 路由与静态页 */
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
    wrap.appendChild(el("h1", null, T("about.title")));
    ["p1", "p2", "p3", "p4", "p5", "p6", "p7"].forEach(function (k) {
      var text = T("about." + k);
      if (text && text !== "about." + k) {
        wrap.appendChild(el("p", null, text));
      }
    });
    return wrap;
  }
  function renderGenerator() {
    var wrap = el("div", "generator-page");
    wrap.appendChild(el("h1", null, T("generator.title")));
    wrap.appendChild(el("p", null, T("generator.subtitle")));
    var g2 = el("div", "form-group");
    var ta = document.createElement("textarea");
    ta.id = "script";
    g2.appendChild(ta);
    wrap.appendChild(g2);
    wrap.appendChild(buildGeneratorAIPanel());
    var g3 = el("div", "form-group");
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "image";
    fileInput.accept = "image/*";
    var l3 = el("label", "image-label-below");
    l3.textContent = T("generator.labelImage");
    var previewBox = el("div");
    previewBox.id = "image-preview";
    g3.appendChild(fileInput);
    g3.appendChild(l3);
    g3.appendChild(previewBox);
    wrap.appendChild(g3);
    var row = el("div", "gen-inline-row");
    var titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.id = "title";
    titleInput.placeholder = T("generator.titlePlaceholder");
    titleInput.maxLength = MAX_TITLE_LEN;
    var submit = el("button", null, T("generator.submit"));
    submit.id = "buildBtn";
    submit.type = "button";
    row.appendChild(titleInput);
    row.appendChild(submit);
    wrap.appendChild(row);
    var result = el("div", "result");
    result.id = "result";
    result.style.display = "none";
    wrap.appendChild(result);
    return wrap;
  }
  function buildGeneratorAIPanel() {
    var frag = document.createDocumentFragment();
    var bar = el("div", "gen-ai-bar gen-ai-bar-bare");
    var picker = el("div", "ai-model-picker");
    var modelBtn = el("button", "ai-model-btn", "+");
    modelBtn.id = "genModelBtn";
    modelBtn.type = "button";
    modelBtn.title = T("gen.modelPickerTitle");
    var menu = el("div", "ai-model-menu");
    menu.id = "genModelMenu";
    picker.appendChild(modelBtn);
    picker.appendChild(menu);
    var input = document.createElement("textarea");
    input.id = "genInput";
    input.rows = 1;
    input.placeholder = T("gen.placeholder");
    var sendBtn = el("button", "ai-send-btn", "↑");
    sendBtn.id = "genSendBtn";
    sendBtn.type = "button";
    sendBtn.title = T("gen.sendTitle");
    bar.appendChild(picker);
    bar.appendChild(input);
    bar.appendChild(sendBtn);
    var status = el("div", "gen-status");
    status.id = "genStatus";
    frag.appendChild(status);
    frag.appendChild(bar);
    return frag;
  }

  /* J18 生成器模型菜单 */
  function refreshGenModelBtn() {
    var btn = $("#genModelBtn");
    if (!btn) return;
    var cur = aiState.currentModel;
    var conf = cur ? aiModelConf(cur) : null;
    if (cur && conf && conf.supportsTools) {
      btn.classList.add("has-model");
      btn.textContent = conf.name.charAt(0);
    } else {
      btn.classList.remove("has-model");
      btn.textContent = "+";
    }
  }
  function buildGenModelMenu() {
    var menu = $("#genModelMenu");
    if (!menu) return;
    var frag = document.createDocumentFragment();
    var models = getToolModels();
    if (!models.length) {
      var empty = el("div", "ai-model-item");
      empty.style.cursor = "default";
      empty.style.color = "var(--text-muted)";
      empty.textContent = T("gen.menuNoToolsModels");
      frag.appendChild(empty);
      menu.replaceChildren(frag);
      return;
    }
    models.forEach(function (m) {
      var item = el("div", "ai-model-item");
      if (aiState.currentModel === m.id) item.classList.add("active");
      item.dataset.model = m.id;
      item.appendChild(el("span", "ai-check", "✓"));
      item.appendChild(el("span", "ai-model-name-text", m.name));
      frag.appendChild(item);
    });
    menu.replaceChildren(frag);
  }
  function closeGenMenu() {
    var menu = $("#genModelMenu");
    if (menu) menu.classList.remove("show");
    genState.menuOpen = false;
  }
  function toggleGenMenu() {
    var menu = $("#genModelMenu");
    if (!menu) return;
    var willShow = !menu.classList.contains("show");
    menu.classList.toggle("show");
    genState.menuOpen = willShow;
    if (willShow) buildGenModelMenu();
  }

  /* J19 生成器AI状态与工具 */
  function genStatusClear() {
    var box = $("#genStatus");
    if (box) box.replaceChildren();
  }
  function genStatusLine(text, kind) {
    var box = $("#genStatus");
    if (!box) return;
    box.appendChild(
      el("div", "gen-status-line" + (kind ? " " + kind : ""), text),
    );
    while (box.children.length > 12) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }
  function genSetBusy(busy) {
    genState.busy = busy;
    var btn = $("#genSendBtn");
    if (btn) btn.disabled = !!busy;
  }
  function executeToolCall(toolName, args) {
    try {
      if (toolName === "insert_code") {
        var code = args && typeof args.code === "string" ? args.code : "";
        if (!editor) throw new Error("editor not found");
        editor.setValue(code);
        generatorDraft.script = code;
        saveDraft();
        return { ok: true, text: T("gen.toolInsert", { n: code.length }) };
      }
      if (toolName === "append_code") {
        var code2 = args && typeof args.code === "string" ? args.code : "";
        if (!editor) throw new Error("editor not found");
        var cur = editor.getValue() || "";
        var next = cur.trim().length === 0 ? code2 : cur + "\n\n" + code2;
        editor.setValue(next);
        generatorDraft.script = next;
        saveDraft();
        return { ok: true, text: T("gen.toolAppend", { n: code2.length }) };
      }
      if (toolName === "get_current_code") {
        if (!editor) throw new Error("editor not found");
        var v = editor.getValue() || "";
        return {
          ok: true,
          text: v.length ? v : "(empty)",
          displayText: T("gen.toolRead", { n: v.length }),
        };
      }
      if (toolName === "replace_selection") {
        if (!editor) throw new Error("editor not found");
        var code3 =
          args && typeof args.code === "string" ? args.code : "";
        var sel = editor.getSelection();
        if (!sel) {
          editor.setValue(code3);
        } else {
          editor.replaceSelection(code3);
        }
        generatorDraft.script = editor.getValue();
        saveDraft();
        return {
          ok: true,
          text: T("gen.toolReplace", { n: code3.length }),
        };
      }
      if (toolName === "get_canvas_size") {
        var W = window.innerWidth;
        var H = window.innerHeight;
        if (editor) {
          var src = editor.getValue() || "";
          var cm = src.match(
            /createCanvas\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/,
          );
          if (cm) {
            W = parseInt(cm[1], 10);
            H = parseInt(cm[2], 10);
          }
        }
        return {
          ok: true,
          text: JSON.stringify({ width: W, height: H }),
          displayText: T("gen.toolCanvasSize", { w: W, h: H }),
        };
      }
      if (toolName === "set_color_palette") {
        var colors =
          args && Array.isArray(args.colors) ? args.colors : [];
        if (!colors.length) {
          return { ok: false, text: T("gen.toolUnknown", { name: toolName }) };
        }
        genState.palette = colors;
        return {
          ok: true,
          text: "已记录配色：" + colors.join(", "),
          displayText: T("gen.toolPalette", { n: colors.length }),
        };
      }
      if (toolName === "save_page") {
        var t2 =
          args && typeof args.title === "string" && args.title.trim()
            ? args.title.trim()
            : ($("#title") ? $("#title").value.trim() : "") ||
              T("generator.untitled");
        if (!editor) throw new Error("editor not found");
        var script = editor.getValue().trim();
        if (!script) {
          return { ok: false, text: "编辑器为空，无法保存" };
        }
        var html = generatePageHtml(
          t2,
          script,
          "",
          !!uploadedImageDataUrl,
        );
        var newId = Date.now() + Math.floor(Math.random() * 1000);
        var pages = getPages();
        pages.push({
          id: newId,
          title: t2,
          html: html,
          timestamp: new Date().toISOString(),
        });
        if (savePages(pages)) {
          if (uploadedImageDataUrl) {
            sessionImages[newId] = uploadedImageDataUrl;
            var ids2 = Object.keys(sessionImages);
            if (ids2.length > MAX_SESSION_IMAGES) {
              delete sessionImages[ids2[0]];
            }
          }
          updateSidebarPages();
          return { ok: true, text: T("gen.toolSaved", { title: t2 }) };
        }
        return { ok: false, text: "保存失败" };
      }
      if (toolName === "open_preview") {
        if (!editor) throw new Error("editor not found");
        var s2 = editor.getValue().trim();
        if (!s2) return { ok: false, text: "编辑器为空，无法预览" };
        var t3 =
          ($("#title") ? $("#title").value.trim() : "") ||
          T("generator.untitled");
        var h2 = generatePageHtml(t3, s2, uploadedImageDataUrl || "");
        /* 【改】A4 */
        runner.mode = "temp";
        runner.tempHtml = h2;
        runner.pageId = null;
        destroyEditor();
        if (getRoute() === "/") render();
        else location.hash = "#/";
        return { ok: true, text: "已打开预览" };
      }
      return { ok: false, text: T("gen.toolUnknown", { name: toolName }) };
    } catch (e) {
      return {
        ok: false,
        text: T("gen.toolError", { msg: String((e && e.message) || e) }),
      };
    }
  }
  function extractCodeFromText(text) {
    if (!text) return null;
    var t = String(text);
    var jsBlocks = [];
    var reJs = /```(?:js|javascript)\s*\n([\s\S]*?)```/gi;
    var m;
    while ((m = reJs.exec(t))) {
      if (m[1]) jsBlocks.push(m[1].replace(/\s+$/, ""));
    }
    if (jsBlocks.length) return jsBlocks.join("\n\n");
    var blocks = [];
    var re = /```\s*\n([\s\S]*?)```/g;
    while ((m = re.exec(t))) {
      if (m[1]) blocks.push(m[1].replace(/\s+$/, ""));
    }
    if (blocks.length) return blocks.join("\n\n");
    if (/function\s+setup\s*\(/.test(t) || /function\s+draw\s*\(/.test(t)) {
      return t.trim();
    }
    return null;
  }

  /* J20 AI流式请求核心 */
  function findToolCallName(msgs, toolCallId) {
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (m.role === "assistant" && m.tool_calls) {
        for (var j = 0; j < m.tool_calls.length; j++) {
          if (m.tool_calls[j].id === toolCallId) {
            return m.tool_calls[j].function.name;
          }
        }
      }
    }
    return "unknown";
  }
  function convertToGeminiMessages(internalMsgs) {
    var systemInstruction = null;
    var contents = [];
    for (var i = 0; i < internalMsgs.length; i++) {
      var m = internalMsgs[i];
      if (m.role === "system") {
        systemInstruction = { parts: [{ text: m.content || "" }] };
      } else if (m.role === "user") {
        contents.push({ role: "user", parts: [{ text: m.content || "" }] });
      } else if (m.role === "assistant") {
        if (m.tool_calls && m.tool_calls.length) {
          var parts = [];
          m.tool_calls.forEach(function (tc) {
            var argsObj = {};
            try {
              argsObj =
                typeof tc.function.arguments === "string"
                  ? JSON.parse(tc.function.arguments)
                  : tc.function.arguments || {};
            } catch (e) {
              argsObj = {};
            }
            parts.push({
              functionCall: { name: tc.function.name, args: argsObj },
            });
          });
          contents.push({ role: "model", parts: parts });
        } else {
          contents.push({ role: "model", parts: [{ text: m.content || "" }] });
        }
      } else if (m.role === "tool") {
        var tcName = findToolCallName(internalMsgs, m.tool_call_id);
        contents.push({
          role: "function",
          parts: [
            {
              functionResponse: {
                name: tcName,
                response: { result: m.content || "" },
              },
            },
          ],
        });
      }
    }
    return { systemInstruction: systemInstruction, contents: contents };
  }
  function streamAI(opts) {
    var model = opts.model;
    var key = opts.key;
    var messages = opts.messages;
    var systemPrompt = opts.systemPrompt;
    var onDelta = opts.onDelta;
    var onRaw = opts.onRaw;
    var enableTools = !!opts.tools;
    var extSignal = opts.signal || null;

    var conf = aiModelConf(model);
    var url, options;
    if (conf.protocol === "gemini") {
      var conv = convertToGeminiMessages(messages);
      var body = { contents: conv.contents };
      if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
      } else if (conv.systemInstruction) {
        body.systemInstruction = conv.systemInstruction;
      }
      if (enableTools) body.tools = buildGeminiTools();
      url =
        conf.endpoint.replace(":generateContent", ":streamGenerateContent") +
        "?alt=sse&key=" +
        encodeURIComponent(key);
      options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
    } else {
      var msgs = [];
      if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
      messages.forEach(function (m) {
        msgs.push(m);
      });
      url = conf.endpoint;
      var reqBody = {
        model: conf.apiModel,
        messages: msgs,
        stream: true,
        stream_options: { include_usage: true },
      };
      if (enableTools) reqBody.tools = buildOpenAITools();
      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify(reqBody),
      };
    }
    var timeoutCtl = new AbortController();
    var timeoutId = setTimeout(function () {
      try {
        timeoutCtl.abort();
      } catch (e) {}
    }, REQUEST_TIMEOUT_MS);

    var baseSignal = extSignal;
    if (!baseSignal && aiState.abortController) {
      baseSignal = aiState.abortController.signal;
    }
    if (baseSignal) {
      var combined = new AbortController();
      var onAbort = function () {
        try {
          combined.abort();
        } catch (e) {}
      };
      baseSignal.addEventListener("abort", onAbort);
      timeoutCtl.signal.addEventListener("abort", onAbort);
      options.signal = combined.signal;
    } else {
      options.signal = timeoutCtl.signal;
    }
    return fetch(url, options)
      .then(function (res) {
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
          throw new Error(T("chat.errStreamUnsupported"));
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        function dispatchData(data) {
          if (!data) return;
          if (data === "[DONE]") {
            if (onRaw) onRaw("[DONE]");
            return;
          }
          try {
            var obj = JSON.parse(data);
            if (onRaw) onRaw(obj);
            onDelta(obj);
          } catch (e) {}
        }
        function processBuffer(flush) {
          if (buffer.indexOf("\r") !== -1) {
            buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
          }
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
      })
      .finally(function () {
        clearTimeout(timeoutId);
      });
  }
  function createStructuredAccumulator() {
    var meta = {
      id: null,
      model: null,
      created: null,
      finish_reason: null,
      usage: null,
      tool_calls: null,
    };
    var tcBuf = {};
    var hasToolCall = false;
    function consume(obj) {
      if (!obj || obj === "[DONE]") return;
      if (obj.id && !meta.id) meta.id = obj.id;
      if (obj.model && !meta.model) meta.model = obj.model;
      if (obj.created && !meta.created) meta.created = obj.created;
      if (obj.usage) meta.usage = obj.usage;
      var ch = obj.choices && obj.choices[0];
      if (ch) {
        if (ch.finish_reason) meta.finish_reason = ch.finish_reason;
        var delta = ch.delta || {};
        var tcs = delta.tool_calls;
        if (tcs && tcs.length) {
          hasToolCall = true;
          tcs.forEach(function (t) {
            var idx = t.index != null ? t.index : 0;
            if (!tcBuf[idx]) {
              tcBuf[idx] = {
                id: "",
                type: "function",
                function: { name: "", arguments: "" },
              };
            }
            var buf = tcBuf[idx];
            if (t.id) buf.id = t.id;
            if (t.type) buf.type = t.type;
            if (t.function) {
              if (t.function.name) buf.function.name += t.function.name;
              if (t.function.arguments)
                buf.function.arguments += t.function.arguments;
            }
          });
        }
      }
      var cand = obj.candidates && obj.candidates[0];
      if (cand) {
        if (cand.finishReason && !meta.finish_reason) {
          meta.finish_reason = cand.finishReason;
        }
        if (cand.content && cand.content.parts) {
          cand.content.parts.forEach(function (p) {
            if (p.functionCall) {
              hasToolCall = true;
              var idx = Object.keys(tcBuf).length;
              tcBuf[idx] = {
                id: "call_" + Date.now() + "_" + idx,
                type: "function",
                function: {
                  name: p.functionCall.name || "",
                  arguments: JSON.stringify(p.functionCall.args || {}),
                },
              };
            }
          });
        }
      }
      if (obj.usageMetadata) {
        meta.usage = {
          prompt_tokens: obj.usageMetadata.promptTokenCount,
          completion_tokens: obj.usageMetadata.candidatesTokenCount,
          total_tokens: obj.usageMetadata.totalTokenCount,
        };
      }
    }
    function finalize() {
      if (hasToolCall) {
        var arr = [];
        Object.keys(tcBuf)
          .sort(function (a, b) {
            return a - b;
          })
          .forEach(function (k) {
            var t = tcBuf[k];
            if (t.function && t.function.name) arr.push(t);
          });
        if (arr.length) meta.tool_calls = arr;
      }
      return meta;
    }
    return { consume: consume, finalize: finalize };
  }

  /* J21 生成器AI循环 */
  function genApplyCode(code, intent) {
    if (!editor || !code) return;
    if (intent === "append") {
      var cur = editor.getValue() || "";
      editor.setValue(cur.trim() ? cur + "\n\n" + code : code);
    } else {
      editor.setValue(code);
    }
    generatorDraft.script = editor.getValue();
    saveDraft();
  }
  function userTextHasCode(text) {
    if (!text) return false;
    if (/```/.test(text)) return true;
    if (/function\s+setup\s*\(/.test(text)) return true;
    if (/function\s+draw\s*\(/.test(text)) return true;
    return false;
  }
  function genRunLoop(userIntent, userText) {
    var model = aiState.currentModel;
    var key = aiState.keys[model];
    var conf = aiModelConf(model);
    if (!conf || !conf.supportsTools) {
      genStatusLine(T("gen.statusModelNoTools"), "error");
      genSetBusy(false);
      return;
    }
    genState.messages = [];
    genState.messages.push({
      role: "system",
      content: T("gen.systemPrompt"),
    });
    var userContent = "[intent: " + userIntent + "]\n";
    if (uploadedImageDataUrl) {
      var info = uploadedImageInfo;
      var w = info && info.width ? info.width : "?";
      var h = info && info.height ? info.height : "?";
      userContent += "[图片已上传 | 尺寸: " + w + "×" + h + "]\n";
    }
    if (userIntent === "modify" && editor && !userTextHasCode(userText)) {
      var currentCode = editor.getValue() || "";
      if (currentCode.trim()) {
        userContent += "\n当前代码：\n```js\n" + currentCode + "\n```\n";
      }
    }
    userContent += "\n用户要求：" + userText;
    genState.messages.push({ role: "user", content: userContent });
    genStatusClear();
    genStatusLine(T("gen.statusRequest", { model: aiModelName(model) }));
    genState.streamToken += 1;
    var myToken = genState.streamToken;
    if (genState.abortController) {
      try {
        genState.abortController.abort();
      } catch (e) {}
    }
    genState.abortController = new AbortController();
    var mySignal = genState.abortController.signal;
    var loopCount = 0;
    function runOne() {
      loopCount += 1;
      if (loopCount > MAX_TOOL_LOOP) {
        genStatusLine(T("gen.statusMaxLoop"), "warn");
        genSetBusy(false);
        return;
      }
      var accumulated = "";
      var acc = createStructuredAccumulator();
      var onDelta = function (obj) {
        if (conf.protocol === "gemini") {
          var cand = obj.candidates && obj.candidates[0];
          if (cand && cand.content && cand.content.parts) {
            for (var i = 0; i < cand.content.parts.length; i++) {
              var p = cand.content.parts[i];
              if (p && typeof p.text === "string") accumulated += p.text;
            }
          }
        } else {
          var ch = obj.choices && obj.choices[0];
          if (ch && ch.delta && typeof ch.delta.content === "string") {
            accumulated += ch.delta.content;
          }
        }
      };
      streamAI({
        model: model,
        key: key,
        messages: genState.messages.slice(),
        systemPrompt: null,
        onDelta: onDelta,
        onRaw: function (obj) {
          acc.consume(obj);
        },
        tools: true,
        signal: mySignal,
      })
        .then(function () {
          if (genState.streamToken !== myToken) return;
          var meta = acc.finalize();
          if (meta.tool_calls && meta.tool_calls.length) {
            genState.messages.push({
              role: "assistant",
              content: accumulated || null,
              tool_calls: meta.tool_calls,
            });
            meta.tool_calls.forEach(function (tc) {
              var name = tc.function.name;
              var args = {};
              try {
                args =
                  typeof tc.function.arguments === "string"
                    ? JSON.parse(tc.function.arguments)
                    : tc.function.arguments || {};
              } catch (e) {
                args = {};
              }
              genStatusLine(T("gen.statusToolCall", { name: name }));
              var res = executeToolCall(name, args);
              var display = res.displayText ? res.displayText : res.text;
              genStatusLine(
                T("gen.statusToolDone", { result: display }),
                res.ok ? "ok" : "error",
              );
              genState.messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: res.text,
              });
            });
            genStatusLine(T("gen.statusSummary"));
            runOne();
            return;
          }
          if (accumulated && accumulated.trim()) {
            var code = extractCodeFromText(accumulated);
            if (code) {
              genStatusLine(T("gen.statusDegrade"), "warn");
              genApplyCode(code, userIntent);
              genStatusLine(T("gen.statusDone"), "ok");
            } else {
              genStatusLine(accumulated.trim(), "ok");
              genStatusLine(T("gen.statusNoCode"), "warn");
            }
          } else {
            genStatusLine(T("gen.statusNoCode"), "warn");
          }
          genSetBusy(false);
        })
        .catch(function (err) {
          if (genState.streamToken !== myToken) return;
          var msg = String((err && err.message) || err);
          if (err && err.name === "AbortError") {
            genStatusLine(T("gen.statusTimeout"), "error");
            genSetBusy(false);
            return;
          }
          genStatusLine(T("gen.statusError", { msg: msg }), "error");
          genSetBusy(false);
        });
    }
    runOne();
  }
  function genSend() {
    if (genState.busy) return;
    var model = aiState.currentModel;
    if (!model || !aiModelConf(model)) {
      showAlert(T("gen.statusNoModel"), "", true);
      return;
    }
    var conf = aiModelConf(model);
    if (!conf.supportsTools) {
      showAlert(T("gen.statusModelNoTools"), "", true);
      return;
    }
    var key = aiState.keys[model];
    if (!key) {
      promptAPIKey(model, function () {
        if (aiState.keys[model]) genSend();
      });
      return;
    }
    var input = $("#genInput");
    if (!input) return;
    var userText = (input.value || "").trim();
    if (!userText) {
      genStatusClear();
      genStatusLine(T("gen.statusEmptyInput"), "warn");
      return;
    }
    var currentCode = editor ? editor.getValue() || "" : "";
    var hasContent = currentCode.trim().length > 0;
    var doSend = function (intent) {
      input.value = "";
      input.style.height = "auto";
      genSetBusy(true);
      genRunLoop(intent, userText);
    };
    if (!hasContent) {
      if (userTextHasCode(userText)) {
        doSend("modify");
      } else {
        doSend("overwrite");
      }
    } else {
      showIntentChoice(
        T("gen.editorNotEmptyTitle"),
        T("gen.editorNotEmptyBody"),
        function () {
          doSend("overwrite");
        },
        function () {
          doSend("modify");
        },
      );
    }
  }
  function bindGeneratorAIPanel() {
    var modelBtn = $("#genModelBtn");
    var menu = $("#genModelMenu");
    var input = $("#genInput");
    var sendBtn = $("#genSendBtn");
    if (modelBtn) {
      modelBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleGenMenu();
      });
    }
    if (menu) {
      menu.addEventListener("click", function (e) {
        var item = e.target.closest(".ai-model-item");
        if (!item || !item.dataset.model) return;
        e.stopPropagation();
        closeGenMenu();
        aiState.currentModel = item.dataset.model;
        /* 【新增】A1 */
        saveCurrentModel(aiState.currentModel);
        refreshGenModelBtn();
        refreshAIModelUI();
      });
    }
    if (input) {
      input.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 120) + "px";
      });
      input.addEventListener("keydown", function (e) {
        if (
          e.key === "Enter" &&
          !e.shiftKey &&
          !e.isComposing &&
          e.keyCode !== 229
        ) {
          e.preventDefault();
          genSend();
        }
      });
    }
    if (sendBtn) {
      sendBtn.addEventListener("click", function () {
        genSend();
      });
    }
    refreshGenModelBtn();
  }


  /* J22 生成器主体 */
  function bindGenerator() {
    var titleInput = $("#title");
    var textarea = $("#script");
    var fileInput = $("#image");
    var previewEl = $("#image-preview");
    var resultEl = $("#result");
    var buildBtn = $("#buildBtn");
    uploadedImageDataUrl = null;
    uploadedImageInfo = null;
    generatorDraft = loadDraft();
    titleInput.value = generatorDraft.title || "";
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
      if (generatorDraft.script) editor.setValue(generatorDraft.script);
      var cmWrapper = editor.getWrapperElement();
      if (getComputedStyle(cmWrapper).position === "static") {
        cmWrapper.style.position = "relative";
      }
      var cmPlaceholderEl = el("div", "cm-placeholder-overlay");
      cmPlaceholderEl.textContent = T("generator.scriptPlaceholder");
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
      editor.on("change", function () {
        generatorDraft.script = editor.getValue();
        saveDraft();
      });
    }
    titleInput.addEventListener("input", function () {
      generatorDraft.title = this.value;
      saveDraft();
    });
    fileInput.addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        showAlert(T("page.badImageTitle"), T("page.badImageBody"), true);
        this.value = "";
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        showAlert(
          T("page.imageTooLargeTitle"),
          T("page.imageTooLargeBody"),
          true,
        );
        this.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        uploadedImageDataUrl = e.target.result;
        var tip = el("p", null, T("generator.imageOk"));
        var img = document.createElement("img");
        img.src = e.target.result;
        img.className = "preview-img";
        img.alt = T("generator.imageAlt");
        previewEl.replaceChildren(tip, img);
        uploadedImageInfo = null;
        var probe = new Image();
        probe.onload = function () {
          uploadedImageInfo = {
            width: probe.naturalWidth,
            height: probe.naturalHeight,
          };
        };
        probe.onerror = function () {
          uploadedImageInfo = null;
        };
        probe.src = e.target.result;
      };
      reader.onerror = function () {
        showAlert(
          T("page.imageReadFailTitle"),
          T("page.imageReadFailBody"),
          true,
        );
      };
      reader.readAsDataURL(file);
    });
    buildBtn.addEventListener("click", function () {
      var title =
        titleInput.value.trim().slice(0, MAX_TITLE_LEN) ||
        T("generator.untitled");
      var script = (editor ? editor.getValue() : textarea.value).trim();
      if (!script) {
        showAlert(T("page.noScriptTitle"), T("page.noScriptBody"), true);
        return;
      }
      var imageDataUrl = uploadedImageDataUrl || "";
      var htmlContent = generatePageHtml(
        title,
        script,
        "",
        !!imageDataUrl,
      );
      var newId = Date.now() + Math.floor(Math.random() * 1000);
      var pages = getPages();
      pages.push({
        id: newId,
        title: title,
        html: htmlContent,
        timestamp: new Date().toISOString(),
      });
      if (!savePages(pages)) return;

      if (imageDataUrl) {
        sessionImages[newId] = imageDataUrl;
        var ids = Object.keys(sessionImages);
        if (ids.length > MAX_SESSION_IMAGES) {
          delete sessionImages[ids[0]];
        }
      }
      updateSidebarPages();
      openModal(function (box) {
        box.appendChild(el("h3", null, T("generator.buildOk")));
        var actions = el("div", "modal-actions");
        var leftWrap = document.createElement("div");
        var closeBtn = el("button", "link-btn", T("common.cancel"));
        closeBtn.addEventListener("click", closeModal);
        leftWrap.appendChild(closeBtn);
        var rg = rightGroup();
        var previewBtn = el("button", null, T("generator.preview"));
        previewBtn.addEventListener("click", function () {
          closeModal();
          runPage(newId);
        });
        var downloadBtn = el("button", "cancel", T("generator.download"));
        downloadBtn.addEventListener("click", function () {
          downloadSingleHtml(
            "p5_" + safeFileName(title) + "_" + newId + ".html",
            htmlContent,
          );
        });
        rg.appendChild(previewBtn);
        rg.appendChild(downloadBtn);
        actions.appendChild(leftWrap);
        actions.appendChild(rg);
        box.appendChild(actions);
      });
      titleInput.value = "";
      if (editor) editor.setValue("");
      clearDraft();
      uploadedImageDataUrl = "";
      uploadedImageInfo = null;
      previewEl.replaceChildren();
      fileInput.value = "";
    });
    bindGeneratorAIPanel();
  }

  /* J23 AI页面骨架 */
  function renderAIAssistant() {
    var page = el("div", "ai-page");
    var clearBtn = el("button", "ai-clear-btn", "−");
    clearBtn.id = "aiClearBtn";
    clearBtn.type = "button";
    clearBtn.title = T("ai.clearTitle");
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "aiImportFile";
    fileInput.accept = ".json,application/json";
    fileInput.style.display = "none";
    var messages = el("div", "ai-messages");
    messages.id = "aiMessages";
    messages.setAttribute("role", "log");
    messages.setAttribute("aria-live", "polite");
    messages.setAttribute("aria-relevant", "additions");
    var statsBar = el("div", "ai-stats");
    statsBar.id = "aiStats";
    statsBar.style.display = "none";
    var inputWrap = el("div", "ai-input-wrap");
    var bar = el("div", "ai-input-bar");
    var picker = el("div", "ai-model-picker");
    var modelBtn = el("button", "ai-model-btn", "+");
    modelBtn.id = "aiModelBtn";
    modelBtn.type = "button";
    modelBtn.title = T("ai.modelPickerTitle");
    var menu = el("div", "ai-model-menu");
    menu.id = "aiModelMenu";
    picker.appendChild(modelBtn);
    picker.appendChild(menu);
    var input = document.createElement("textarea");
    input.id = "aiInput";
    input.rows = 1;
    input.placeholder = T("ai.inputPlaceholder");
    var sendBtn = el("button", "ai-send-btn", "↑");
    sendBtn.id = "aiSendBtn";
    sendBtn.type = "button";
    sendBtn.title = T("ai.sendTitle");
    bar.appendChild(picker);
    bar.appendChild(input);
    bar.appendChild(sendBtn);
    inputWrap.appendChild(bar);
    page.appendChild(clearBtn);
    page.appendChild(fileInput);
    page.appendChild(messages);
    page.appendChild(statsBar);
    page.appendChild(inputWrap);
    return page;
  }

  /* J24 AI模型菜单 */
  function buildAIModelMenu() {
    var menu = $("#aiModelMenu");
    if (!menu) return;
    var frag = document.createDocumentFragment();
    var topRow = el("div", "ai-model-toprow");
    var addBtn = el("div", "ai-model-topbtn ai-model-add", T("ai.topRowAdd"));
    addBtn.dataset.add = "1";
    var importBtn = el("div", "ai-model-topbtn", T("ai.topRowImport"));
    importBtn.dataset.import = "1";
    topRow.appendChild(addBtn);
    topRow.appendChild(importBtn);
    frag.appendChild(topRow);
    getAllModels().forEach(function (m) {
      var item = el("div", "ai-model-item");
      if (aiState.currentModel === m.id) item.classList.add("active");
      item.dataset.model = m.id;
      item.appendChild(el("span", "ai-check", "✓"));
      var name = el("span", "ai-model-name");
      var nameText = el("span", "ai-model-name-text", m.name);
      name.appendChild(nameText);
      if (!m.builtin) {
        var editBtn = el("button", "ai-model-edit", "✎");
        editBtn.type = "button";
        editBtn.title = T("ai.editModelTitle");
        editBtn.dataset.edit = m.id;
        name.appendChild(editBtn);
      }
      item.appendChild(name);
      var testBtn = el("button", "ai-dl", "T");
      testBtn.type = "button";
      testBtn.title = T("ai.menuTest");
      testBtn.dataset.test = m.id;
      var keyBtn = el("button", "ai-key", "K");
      keyBtn.type = "button";
      keyBtn.title = T("ai.menuKey");
      keyBtn.dataset.key = m.id;
      var promptBtn = el("button", "ai-prompt", "P");
      promptBtn.type = "button";
      promptBtn.title = T("ai.menuPrompt");
      promptBtn.dataset.prompt = m.id;
      if (aiState.prompts[m.id] && aiState.prompts[m.id].trim()) {
        promptBtn.classList.add("has-prompt");
      }
      var jsonBtn = el("button", "ai-dl", "J");
      jsonBtn.type = "button";
      jsonBtn.title = T("ai.menuDownloadJson");
      jsonBtn.dataset.json = m.id;
      var mdBtn = el("button", "ai-dl", "M");
      mdBtn.type = "button";
      mdBtn.title = T("ai.menuDownloadMd");
      mdBtn.dataset.md = m.id;
      item.appendChild(testBtn);
      item.appendChild(keyBtn);
      item.appendChild(promptBtn);
      item.appendChild(jsonBtn);
      item.appendChild(mdBtn);
      frag.appendChild(item);
    });
    menu.replaceChildren(frag);
  }
  function refreshAIModelUI() {
    $$(".ai-model-item").forEach(function (el) {
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
    refreshGenModelBtn();
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

  /* J25 剪贴板与提示 */
  function copyToClipboard(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text);
      });
      return;
    }
    fallbackCopy(text);
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText =
        "position:fixed;left:-9999px;top:-9999px;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
  }
  function flashTip(anchorEl, text) {
    if (!anchorEl) return;
    var tip = el("div", "msg-flash-tip", text);
    anchorEl.appendChild(tip);
    setTimeout(function () {
      if (tip.parentNode) tip.parentNode.removeChild(tip);
    }, FLASH_TIP_MS);
  }

  /* J26 消息工具栏与节点 */
  function buildAssistantToolbar(m, index) {
    var toolbar = el("div", "assistant-toolbar");
    var left = el("div", "toolbar-left");
    var chat = aiState.chats[aiState.currentModel] || [];
    var isLastAssistant =
      m.role === "assistant" && index === chat.length - 1 && index > 0;
    if (isLastAssistant) {
      var regenBtn = el(
        "button",
        "assistant-tool-btn",
        "↻ " + T("msg.regen"),
      );
      regenBtn.type = "button";
      regenBtn.title = T("msg.regen");
      regenBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        regenerateMessage(index);
      });
      left.appendChild(regenBtn);
    }
    var delBtn = el("button", "assistant-tool-btn", "✕ " + T("msg.delete"));
    delBtn.type = "button";
    delBtn.title = T("msg.delete");
    delBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      deleteMessageFrom(index);
    });
    left.appendChild(delBtn);
    if (m.usage) {
      var up = m.usage.prompt_tokens || 0;
      var down = m.usage.completion_tokens || 0;
      var total = m.usage.total_tokens || up + down;
      var tok = el("span", "assistant-token", "↑" + up + " ↓" + down);
      tok.title = total + " tokens";
      left.appendChild(tok);
    }
    toolbar.appendChild(left);
    var right = el("div", "toolbar-right");
    var copyBtn = el("button", "assistant-tool-btn", "⧉ " + T("msg.copy"));
    copyBtn.type = "button";
    copyBtn.title = T("msg.copy");
    copyBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      copyToClipboard(m.content || "");
      flashTip(toolbar, T("msg.copied"));
    });
    right.appendChild(copyBtn);
    toolbar.appendChild(right);
    return toolbar;
  }
  function bindRowToggleActions(row) {
    var pressTimer = null;
    var longPressed = false;
    function show() {
      $$(".ai-msg.actions-visible").forEach(function (el) {
        if (el !== row) el.classList.remove("actions-visible");
      });
      row.classList.add("actions-visible");
    }
    function toggle() {
      if (row.classList.contains("actions-visible")) {
        row.classList.remove("actions-visible");
      } else {
        show();
      }
    }
    function startPress() {
      longPressed = false;
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(function () {
        pressTimer = null;
        longPressed = true;
        show();
      }, LONG_PRESS_MS);
    }
    function cancelPress() {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    }
    row.addEventListener("pointerdown", startPress);
    row.addEventListener("pointerup", cancelPress);
    row.addEventListener("pointercancel", cancelPress);
    row.addEventListener("pointerleave", cancelPress);
    row.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;
      if (longPressed) {
        longPressed = false;
        return;
      }
      toggle();
    });
  }
  function buildMsgNode(m, index) {
    var row = el(
      "div",
      "ai-msg " + (m.role === "assistant" ? "assistant" : "user"),
    );
    row.dataset.index = String(index);
    if (m.role === "assistant") {
      var body = el("div", "assistant-body");
      if (!m.content) {
        body.textContent = T("ai.thinking");
        body.classList.add("pending");
      } else {
        body.textContent = m.content;
      }
      row.appendChild(body);
      var toolbar = buildAssistantToolbar(m, index);
      row.appendChild(toolbar);
      bindRowToggleActions(row);
    } else {
      var b = el("div", "bubble");
      b.textContent = m.content;
      row.appendChild(b);
    }
    return row;
  }
  function buildEmptyNode(text) {
    return el("div", "ai-empty", text);
  }


  /* J27 AI消息渲染 */
  function renderAIMessages() {
    var box = $("#aiMessages");
    if (!box) return;
    var model = aiState.currentModel;
    if (!model) {
      if (!box.firstChild || !box.querySelector(".ai-empty")) {
        box.replaceChildren(buildEmptyNode(T("ai.emptyNoModel")));
      }
      renderedModelId = null;
      renderedMsgCount = 0;
      updateStatsBar();
      return;
    }
    if (renderedModelId !== model) {
      renderedModelId = model;
      renderedMsgCount = 0;
      box.replaceChildren();
    }
    var chat = aiState.chats[model] || [];
    if (!chat.length) {
      if (!box.firstChild || !box.querySelector(".ai-empty")) {
        box.replaceChildren(
          buildEmptyNode(T("ai.emptyStart", { model: aiModelName(model) })),
        );
      }
      renderedMsgCount = 0;
      updateStatsBar();
      return;
    }
    if (renderedMsgCount > chat.length) renderedMsgCount = 0;
    if (renderedMsgCount === 0) {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < chat.length; i++) {
        frag.appendChild(buildMsgNode(chat[i], i));
      }
      box.replaceChildren(frag);
      renderedMsgCount = chat.length;
      box.scrollTop = box.scrollHeight;
      updateStatsBar();
      return;
    }
    if (renderedMsgCount < chat.length) {
      var emptyEl = box.querySelector(".ai-empty");
      if (emptyEl && box.children.length === 1) {
        box.replaceChildren();
        renderedMsgCount = 0;
        var frag2 = document.createDocumentFragment();
        for (var k = 0; k < chat.length; k++) {
          frag2.appendChild(buildMsgNode(chat[k], k));
        }
        box.replaceChildren(frag2);
        renderedMsgCount = chat.length;
        box.scrollTop = box.scrollHeight;
        updateStatsBar();
        return;
      }
      for (var j = renderedMsgCount; j < chat.length; j++) {
        box.appendChild(buildMsgNode(chat[j], j));
      }
      renderedMsgCount = chat.length;
      box.scrollTop = box.scrollHeight;
    }
    updateStatsBar();
  }
  function updateStatsBar() {
    var bar = $("#aiStats");
    if (!bar) return;
    var model = aiState.currentModel;
    if (!model) {
      bar.style.display = "none";
      return;
    }
    var chat = aiState.chats[model] || [];
    var totalPrompt = 0;
    var totalCompletion = 0;
    var turns = 0;
    chat.forEach(function (m) {
      if (m.role === "assistant" && m.usage) {
        totalPrompt += m.usage.prompt_tokens || 0;
        totalCompletion += m.usage.completion_tokens || 0;
        turns += 1;
      }
    });
    if (!turns) {
      bar.style.display = "none";
      return;
    }
    var total = totalPrompt + totalCompletion;
    bar.style.display = "block";
    bar.textContent = T("ai.stats", {
      turns: turns,
      total: total.toLocaleString(),
    });
  }
  function updateAISendBtn() {
    var btn = $("#aiSendBtn");
    if (!btn) return;
    btn.disabled = !!aiState.busy;
  }
  function getLastAssistantBubble() {
    var box = $("#aiMessages");
    if (!box) return null;
    var kids = box.children;
    for (var i = kids.length - 1; i >= 0; i--) {
      if (kids[i].classList.contains("assistant")) {
        return kids[i].querySelector(".assistant-body");
      }
    }
    return null;
  }
  function isNearBottom(box) {
    if (!box) return true;
    return box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_BOTTOM_PX;
  }

  /* J28 消息操作 */
  function deleteMessageFrom(index) {
    var model = aiState.currentModel;
    if (!model) return;
    var chat = aiState.chats[model] || [];
    if (index < 0 || index >= chat.length) return;
    var after = chat.length - index - 1;
    var msgText = after > 0
      ? T("msg.deleteConfirmBody", { n: after })
      : T("msg.deleteConfirmBodyShort");
    showConfirm(
      T("msg.deleteConfirmTitle"),
      msgText,
      function () {
        chat.splice(index);
        saveAIChats(model);
        renderedMsgCount = 0;
        renderAIMessages();
      },
      true,
    );
  }
  function regenerateMessage(index) {
    var model = aiState.currentModel;
    if (!model) return;
    var chat = aiState.chats[model] || [];
    if (index < 1) return;
    var userMsg = chat[index - 1];
    if (!userMsg || userMsg.role !== "user") return;
    chat.splice(index);
    saveAIChats(model);
    renderedMsgCount = 0;
    renderAIMessages();
    var text = userMsg.content || "";
    if (!text.trim()) return;
    aiSendWithText(text);
  }
  function aiSendWithText(text) {
    var model = aiState.currentModel;
    if (!model) return;
    var key = aiState.keys[model];
    if (!key) {
      promptAPIKey(model, function () {
        if (aiState.keys[model]) aiSendWithText(text);
      });
      return;
    }
    var chat = aiState.chats[model];
    if (!Array.isArray(chat)) chat = aiState.chats[model] = [];
    var lastMsg = chat[chat.length - 1];
    if (!(lastMsg && lastMsg.role === "user" && lastMsg.content === text)) {
      chat.push({ role: "user", content: text });
    }
    chat.push({ role: "assistant", content: "" });
    saveAIChats(model);
    if (aiState.abortController) {
      try {
        aiState.abortController.abort();
      } catch (e) {}
    }
    aiState.streamToken += 1;
    var myToken = aiState.streamToken;
    aiState.abortController = new AbortController();
    aiState.busy = true;
    updateAISendBtn();
    renderAIMessages();
    var bubble = getLastAssistantBubble();
    if (bubble) {
      bubble.textContent = "";
      bubble.classList.remove("pending");
    }
    var accumulated = "";
    var conf = aiModelConf(model);
    var isGemini = conf && conf.protocol === "gemini";
    var box = $("#aiMessages");
    var acc = createStructuredAccumulator();
    function pushDelta(t2) {
      if (aiState.streamToken !== myToken) return;
      if (!t2) return;
      accumulated += t2;
      if (bubble) bubble.appendChild(document.createTextNode(t2));
      if (box && isNearBottom(box)) box.scrollTop = box.scrollHeight;
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
    var payload = chat
      .slice(0, -1)
      .filter(function (m) {
        return m.role === "user" || m.role === "assistant";
      })
      .map(function (m) {
        return { role: m.role, content: m.content || "" };
      });
    if (payload.length > MAX_CONTEXT_MESSAGES) {
      payload = payload.slice(-MAX_CONTEXT_MESSAGES);
      /* 【新增】A2: 裁剪后确保首条为 user */
      while (payload.length && payload[0].role !== "user") {
        payload.shift();
      }
    }
    var systemPrompt = aiState.prompts[model] || "";
    streamAI({
      model: model,
      key: key,
      messages: payload,
      systemPrompt: systemPrompt,
      onDelta: onDelta,
      onRaw: function (raw) {
        acc.consume(raw);
      },
    })
      .then(function () {
        if (aiState.streamToken !== myToken) return;
        var meta = acc.finalize();
        var msg = chat[chat.length - 1];
        msg.content = accumulated || T("ai.emptyReply");
        if (meta.id) msg.id = meta.id;
        if (meta.model) msg.model = meta.model;
        if (meta.created) msg.created = meta.created;
        if (meta.finish_reason) msg.finish_reason = meta.finish_reason;
        if (meta.usage) msg.usage = meta.usage;
        if (meta.tool_calls) msg.tool_calls = meta.tool_calls;
        saveAIChats(model);
        aiState.busy = false;
        updateAISendBtn();
        renderAIMessages();
      })
      .catch(function (err) {
        if (aiState.streamToken !== myToken) return;
        aiState.busy = false;
        updateAISendBtn();
        var meta = acc.finalize();
        var isAbort = err && (err.name === "AbortError" || err.code === 20);
        if (accumulated) {
          var msg = chat[chat.length - 1];
          msg.content = accumulated;
          if (meta.id) msg.id = meta.id;
          if (meta.model) msg.model = meta.model;
          if (meta.created) msg.created = meta.created;
          if (meta.finish_reason) msg.finish_reason = meta.finish_reason;
          if (meta.usage) msg.usage = meta.usage;
          if (meta.tool_calls) msg.tool_calls = meta.tool_calls;
        } else {
          chat.pop();
        }
        saveAIChats(model);
        renderAIMessages();
        if (!isAbort) {
          showAlert(
            T("chat.errRequestTitle"),
            String((err && err.message) || err) || T("chat.errRequestBody"),
            true,
          );
        }
      });
  }

  /* J29 模型编辑与选择 */
  function showModelEditor(modelId) {
    var isEdit = !!modelId;
    var existing = isEdit ? aiModelConf(modelId) : null;
    if (isEdit && (!existing || existing.builtin)) return;
    openModal(function (box) {
      box.appendChild(
        el("h3", null, isEdit ? T("ai.editModelTitle") : T("model.addTitle")),
      );
      box.appendChild(
        el("div", "modal-hint", T("model.hint", { endpoint: "{endpoint}" })),
      );
      var l1 = el("label", null, T("model.labelName"));
      l1.style.cssText =
        "display:block;font-weight:bold;font-size:0.9rem;margin:8px 0 4px;";
      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = T("model.placeholderName");
      nameInput.value = isEdit ? existing.name : "";
      nameInput.autocomplete = "off";
      nameInput.spellcheck = false;
      var l2 = el("label", null, T("model.labelEndpoint"));
      l2.style.cssText = l1.style.cssText;
      var epInput = document.createElement("input");
      epInput.type = "text";
      epInput.placeholder = T("model.placeholderEndpoint");
      epInput.value = isEdit ? existing.endpoint : "";
      epInput.autocomplete = "off";
      epInput.spellcheck = false;
      var l3 = el("label", null, T("model.labelApiModel"));
      l3.style.cssText = l1.style.cssText;
      var apiInput = document.createElement("input");
      apiInput.type = "text";
      apiInput.placeholder = T("model.placeholderApiModel");
      apiInput.value = isEdit ? existing.apiModel : "";
      apiInput.autocomplete = "off";
      apiInput.spellcheck = false;
      var toolsRow = document.createElement("label");
      toolsRow.style.cssText =
        "display:flex;align-items:center;gap:8px;margin:8px 0 4px;font-weight:bold;font-size:0.9rem;cursor:pointer;";
      var toolsCb = document.createElement("input");
      toolsCb.type = "checkbox";
      toolsCb.style.cssText = "width:auto;margin:0;";
      toolsCb.checked = isEdit ? !!existing.supportsTools : false;
      toolsRow.appendChild(toolsCb);
      toolsRow.appendChild(document.createTextNode("支持函数调用（Tools）"));
      var actions = el("div", "modal-actions");
      var leftWrap = document.createElement("div");
      if (isEdit) {
        var delBtn = el("button", "link-btn", T("model.deleteBtn"));
        delBtn.type = "button";
        delBtn.addEventListener("click", function () {
          closeModal();
          deleteCustomModel(modelId);
        });
        leftWrap.appendChild(delBtn);
      }
      var rg = rightGroup();
      var cancel = el("button", "cancel", T("common.cancel"));
      cancel.addEventListener("click", closeModal);
      var ok = el("button", null, isEdit ? T("common.save") : T("common.ok"));
      ok.addEventListener("click", function () {
        var name = nameInput.value.trim();
        var ep = epInput.value.trim();
        var apiModel = apiInput.value.trim();
        if (!name) {
          nameInput.focus();
          return;
        }
        if (!ep) {
          epInput.focus();
          return;
        }
        if (!/^https?:\/\//i.test(ep)) {
          showAlert(T("model.errFormat"), T("model.errFormatBody"), true);
          return;
        }
        if (!apiModel) {
          apiInput.focus();
          return;
        }
        var supportsTools = !!toolsCb.checked;
        if (isEdit) {
          existing.name = name;
          existing.endpoint = ep;
          existing.apiModel = apiModel;
          existing.supportsTools = supportsTools;
          saveCustomModels();
          closeModal();
          buildAIModelMenu();
          refreshAIModelUI();
          showAlert(T("model.editOk"), T("model.editOkBody", { name: name }));
        } else {
          var newId = "custom_" + Date.now();
          aiState.customModels.push({
            id: newId,
            name: name,
            endpoint: ep,
            apiModel: apiModel,
            protocol: "openai",
            builtin: false,
            supportsTools: supportsTools,
          });
          aiState.chats[newId] = [];
          aiState.prompts[newId] = "";
          saveCustomModels();
          saveAIPrompts();
          closeModal();
          buildAIModelMenu();
          refreshAIModelUI();
          showAlert(T("model.addOk"), T("model.addOkBody", { name: name }));
        }
      });
      rg.appendChild(cancel);
      rg.appendChild(ok);
      actions.appendChild(leftWrap);
      actions.appendChild(rg);
      box.appendChild(l1);
      box.appendChild(nameInput);
      box.appendChild(l2);
      box.appendChild(epInput);
      box.appendChild(l3);
      box.appendChild(apiInput);
      box.appendChild(toolsRow);
      box.appendChild(actions);
    });
  }
  function deleteCustomModel(modelId) {
    var conf = aiModelConf(modelId);
    if (!conf || conf.builtin) return;
    showConfirm(
      T("model.deleteConfirmTitle"),
      T("model.deleteConfirmBody", { name: conf.name }),
      function () {
        delete aiState.keys[modelId];
        delete aiState.chats[modelId];
        delete aiState.prompts[modelId];
        saveAIKeys();
        saveAIPrompts();
        try {
          localStorage.removeItem(AI_CHAT_STORAGE + "_" + modelId);
        } catch (e) {}
        aiState.customModels = aiState.customModels.filter(function (m) {
          return m.id !== modelId;
        });
        saveCustomModels();
        if (aiState.currentModel === modelId) {
          aiState.currentModel = null;
          saveCurrentModel(null);
          renderedModelId = null;
          renderedMsgCount = 0;
        }
        buildAIModelMenu();
        refreshAIModelUI();
        renderAIMessages();
        updateAISendBtn();
        showAlert(
          T("model.deleteOk"),
          T("model.deleteOkBody", { name: conf.name }),
        );
      },
      true,
    );
  }
  function testAIModelConnection(model) {
    var conf = aiModelConf(model);
    if (!conf) return;
    var key = aiState.keys[model];
    if (!key) {
      showAlert(
        T("test.noKeyTitle"),
        T("test.noKeyBody", { model: aiModelName(model) }),
        true,
      );
      return;
    }
    var url, body, headers;
    if (conf.protocol === "gemini") {
      url = conf.endpoint + "?key=" + encodeURIComponent(key);
      body = { contents: [{ role: "user", parts: [{ text: "hi" }] }] };
      headers = { "Content-Type": "application/json" };
    } else {
      url = conf.endpoint;
      body = {
        model: conf.apiModel,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      };
      headers = {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      };
    }
    showAlert(T("test.title"), T("test.body", { model: aiModelName(model) }));
    var testAbort = new AbortController();
    var timeoutId = setTimeout(function () {
      try {
        testAbort.abort();
      } catch (e) {}
    }, TEST_TIMEOUT_MS);
    fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
      signal: testAbort.signal,
    })
      .then(function (res) {
        clearTimeout(timeoutId);
        return res.text().then(function (t) {
          if (res.ok) {
            showAlert(
              T("test.okTitle"),
              T("test.okBody", { model: aiModelName(model) }),
            );
          } else {
            var msg = "HTTP " + res.status;
            try {
              var d = JSON.parse(t);
              msg =
                (d.error && d.error.message) ||
                d.message ||
                (d.error && d.error.status) ||
                msg;
            } catch (e) {}
            showAlert(T("test.failTitle"), msg, true);
          }
        });
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        var msg = String((err && err.message) || err);
        if (err && err.name === "AbortError") msg = T("test.timeout");
        showAlert(T("test.failTitle"), msg, true);
      });
  }
  
  function promptAPIKey(model, onSaved) {
  var hasKey = !!aiState.keys[model];
  showPrompt(
    T("ai.setKeyTitle", { model: aiModelName(model) }),
    aiState.keys[model] || "",
    function (v) {
      aiState.keys[model] = v;
      saveAIKeys();
      if (onSaved) onSaved();
    },
    "password",
    T("ai.keySecurityHint"),
    hasKey
      ? {
          clearText: T("ai.clearKey"),
          onClear: function () {
            delete aiState.keys[model];
            saveAIKeys();
          },
        }
      : null,
      );
  }
  
  /*
  function promptAPIKey(model, onSaved) {
    showPrompt(
      T("ai.setKeyTitle", { model: aiModelName(model) }),
      aiState.keys[model] || "",
      function (v) {
        aiState.keys[model] = v;
        saveAIKeys();
        if (onSaved) onSaved();
      },
      "password",
    );
  }
  */
  function promptSystemPrompt(model) {
    var existing = aiState.prompts[model] || "";
    showPromptArea({
      title: T("ai.setPromptTitle", { model: aiModelName(model) }),
      hint: T("ai.setPromptHint"),
      value: existing,
      placeholder: T("ai.setPromptPlaceholder"),
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
    if (aiState.busy) {
      if (aiState.abortController) {
        try {
          aiState.abortController.abort();
        } catch (e) {}
      }
      aiState.streamToken += 1;
      aiState.busy = false;
      updateAISendBtn();
    }
    if (!aiState.keys[model]) {
      promptAPIKey(model, function () {
        aiState.currentModel = model;
        /* 【新增】A1 */
        saveCurrentModel(model);
        refreshAIModelUI();
        renderAIMessages();
        updateAISendBtn();
      });
      return;
    }
    aiState.currentModel = model;
    /* 【新增】A1 */
    saveCurrentModel(model);
    refreshAIModelUI();
    renderAIMessages();
    updateAISendBtn();
  }

  /* J30 对话导入导出 */
  /*
  function triggerDownload(content, mime, filename) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  */
  function triggerDownload(content, mime, filename) {
  /* iOS Safari 中 blob URL 只预览不下载，改用 data URL */
  try {
    var encoded = btoa(unescape(encodeURIComponent(content)));
    var url = "data:" + mime + ";base64," + encoded;
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    /* 极端情况（超大内容 / btoa 失败）回退到 blob */
    var blob = new Blob([content], { type: mime });
    var burl = URL.createObjectURL(blob);
    var b = document.createElement("a");
    b.href = burl;
    b.download = filename;
    b.style.display = "none";
    document.body.appendChild(b);
    b.click();
    document.body.removeChild(b);
    setTimeout(function () {
      URL.revokeObjectURL(burl);
    }, 1000);
  }
}

  function downloadAIChatMd(model) {
    var chat = aiState.chats[model] || [];
    if (!chat.length) {
      showAlert(
        T("chat.errNoDownloadTitle"),
        T("chat.errNoDownloadBody", { model: aiModelName(model) }),
      );
      return;
    }
    var lines = ["# " + aiModelName(model), ""];
    var sys = aiState.prompts[model];
    if (sys && sys.trim()) {
      lines.push("## system");
      lines.push("");
      lines.push(sys);
      lines.push("");
    }
    chat.forEach(function (m) {
      lines.push("## " + m.role);
      lines.push("");
      lines.push(m.content || "");
      lines.push("");
    });
    triggerDownload(
      lines.join("\n"),
      "text/markdown;charset=utf-8",
      "ai_chat_" + model + "_" + Date.now() + ".md",
    );
  }
  function downloadAIChatJson(model) {
    var chat = aiState.chats[model] || [];
    if (!chat.length) {
      showAlert(
        T("chat.errNoDownloadTitle"),
        T("chat.errNoDownloadBody", { model: aiModelName(model) }),
      );
      return;
    }
    var sys = aiState.prompts[model];
    var data = {
      schemaVersion: 1,
      model: model,
      modelName: aiModelName(model),
      exportedAt: new Date().toISOString(),
      systemPrompt: sys && sys.trim() ? sys : null,
      messages: chat.map(function (m) {
        var out = { role: m.role, content: m.content };
        if (m.id) out.id = m.id;
        if (m.model) out.model = m.model;
        if (m.created) out.created = m.created;
        if (m.finish_reason) out.finish_reason = m.finish_reason;
        if (m.usage) out.usage = m.usage;
        if (m.tool_calls && m.tool_calls.length) out.tool_calls = m.tool_calls;
        return out;
      }),
    };
    triggerDownload(
      JSON.stringify(data, null, 2),
      "application/json;charset=utf-8",
      "ai_chat_" + model + "_" + Date.now() + ".json",
    );
  }
  function importAIChatFromFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var data;
      try {
        data = JSON.parse(e.target.result);
      } catch (err) {
        showAlert(T("import.failTitle"), T("import.badJson"), true);
        return;
      }
      if (!data || !Array.isArray(data.messages)) {
        showAlert(T("import.failTitle"), T("import.badShape"), true);
        return;
      }
      var targetModel = data.model;
      if (!targetModel || !aiModelConf(targetModel)) {
        var name = String(data.modelName || "").toLowerCase();
        var allModels = getAllModels();
        for (var i = 0; i < allModels.length; i++) {
          if (allModels[i].name.toLowerCase() === name) {
            targetModel = allModels[i].id;
            break;
          }
        }
      }
      if (!targetModel || !aiModelConf(targetModel)) {
        showAlert(
          T("import.failTitle"),
          T("import.unknownModel", { model: data.model || "?" }),
          true,
        );
        return;
      }
      var cleaned = data.messages
        .filter(function (m) {
          return m && typeof m.role === "string";
        })
        .map(function (m) {
          var out = {
            role: m.role,
            content: typeof m.content === "string" ? m.content : "",
          };
          if (m.id) out.id = m.id;
          if (m.model) out.model = m.model;
          if (m.created) out.created = m.created;
          if (m.finish_reason) out.finish_reason = m.finish_reason;
          if (m.usage) out.usage = m.usage;
          if (m.tool_calls && m.tool_calls.length) out.tool_calls = m.tool_calls;
          return out;
        });
      if (!cleaned.length) {
        showAlert(T("import.failTitle"), T("import.noMessages"), true);
        return;
      }
      var applyImport = function (mode) {
        var existing = aiState.chats[targetModel] || [];
        if (mode === "replace") aiState.chats[targetModel] = cleaned;
        else aiState.chats[targetModel] = existing.concat(cleaned);
        if (
          data.systemPrompt &&
          String(data.systemPrompt).trim() &&
          !(aiState.prompts[targetModel] || "").trim()
        ) {
          aiState.prompts[targetModel] = String(data.systemPrompt).trim();
          saveAIPrompts();
        }
        saveAIChats(targetModel);
        if (aiState.currentModel === targetModel) {
          renderedMsgCount = 0;
          renderAIMessages();
          showAlert(
            T("import.okTitle"),
            T("import.okBody", {
              n: cleaned.length,
              model: aiModelName(targetModel),
            }),
          );
        } else {
          showConfirm(
            T("import.okTitle"),
            T("import.askSwitch", {
              n: cleaned.length,
              model: aiModelName(targetModel),
            }),
            function () {
              selectAIModel(targetModel);
            },
          );
        }
      };
      var existing = aiState.chats[targetModel] || [];
      if (!existing.length) {
        applyImport("replace");
        return;
      }
      openModal(function (box) {
        box.appendChild(el("h3", null, T("import.conflictTitle")));
        box.appendChild(
          el(
            "p",
            null,
            T("import.conflictBody", {
              model: aiModelName(targetModel),
              existing: existing.length,
              incoming: cleaned.length,
            }),
          ),
        );
        var actions = el("div", "modal-actions");
        var leftWrap = document.createElement("div");
        var cancelBtn = el("button", "link-btn", T("common.cancel"));
        cancelBtn.addEventListener("click", closeModal);
        leftWrap.appendChild(cancelBtn);
        var rg = rightGroup();
        var appendBtn = el("button", "cancel", T("common.append"));
        appendBtn.addEventListener("click", function () {
          closeModal();
          applyImport("append");
        });
        var replaceBtn = el("button", "danger", T("common.replace"));
        replaceBtn.addEventListener("click", function () {
          closeModal();
          applyImport("replace");
        });
        rg.appendChild(appendBtn);
        rg.appendChild(replaceBtn);
        actions.appendChild(leftWrap);
        actions.appendChild(rg);
        box.appendChild(actions);
      });
    };
    reader.onerror = function () {
      showAlert(T("import.failTitle"), T("import.readFail"), true);
    };
    reader.readAsText(file);
  }
  
  /* J31 AI发送与清空 */
  function aiSend() {
    if (aiState.busy) return;
    var model = aiState.currentModel;
    if (!model) {
      showAlert(T("chat.errNoModelTitle"), T("chat.errNoModelBody"), true);
      return;
    }
    var inputEl = $("#aiInput");
    if (!inputEl) return;
    var text = (inputEl.value || "").trim();
    if (!text) return;
    inputEl.value = "";
    inputEl.style.height = "auto";
    aiSendWithText(text);
  }
  function clearAIChat() {
    var model = aiState.currentModel;
    if (!model) {
      showAlert(T("chat.errNoClearTitle"), T("chat.errNoClearNoModel"));
      return;
    }
    var chat = aiState.chats[model] || [];
    if (!chat.length) {
      showAlert(
        T("chat.errNoClearTitle"),
        T("chat.errNoClearNoChat", { model: aiModelName(model) }),
      );
      return;
    }
    showConfirm(
      T("chat.clearConfirmTitle"),
      T("chat.clearConfirmBody", { model: aiModelName(model) }),
      function () {
        if (aiState.busy) {
          if (aiState.abortController) {
            try {
              aiState.abortController.abort();
            } catch (e) {}
          }
          aiState.streamToken += 1;
          aiState.busy = false;
          updateAISendBtn();
        }
        aiState.chats[model] = [];
        saveAIChats(model);
        renderedMsgCount = 0;
        renderAIMessages();
      },
      true,
    );
  }


  /* J32 AI助手绑定  */
  function bindAIAssistant() {
    renderedModelId = null;
    renderedMsgCount = 0;
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
        var importItem = e.target.closest("[data-import]");
        if (importItem) {
          e.stopPropagation();
          closeAIModelMenu();
          var importFile = $("#aiImportFile");
          if (importFile) {
            importFile.value = "";
            importFile.click();
          }
          return;
        }
        var addBtn = e.target.closest("[data-add]");
        if (addBtn) {
          e.stopPropagation();
          closeAIModelMenu();
          showModelEditor();
          return;
        }
        var editBtn = e.target.closest("[data-edit]");
        if (editBtn) {
          e.stopPropagation();
          e.preventDefault();
          closeAIModelMenu();
          showModelEditor(editBtn.dataset.edit);
          return;
        }
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
        var testBtn = e.target.closest("[data-test]");
        if (testBtn) {
          e.stopPropagation();
          closeAIModelMenu();
          testAIModelConnection(testBtn.dataset.test);
          return;
        }
        var mdBtn = e.target.closest("[data-md]");
        if (mdBtn) {
          e.stopPropagation();
          downloadAIChatMd(mdBtn.dataset.md);
          return;
        }
        var jsonBtn = e.target.closest("[data-json]");
        if (jsonBtn) {
          e.stopPropagation();
          downloadAIChatJson(jsonBtn.dataset.json);
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
    var importFile = $("#aiImportFile");
    if (importFile) {
      importFile.addEventListener("change", function () {
        var f = this.files && this.files[0];
        if (!f) return;
        importAIChatFromFile(f);
        this.value = "";
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        clearAIChat();
      });
    }
  }

  /* J33 主路由渲染 */
  function render() {
    var path = getRoute();

    if (genState.busy) {
      if (genState.abortController) {
        try {
          genState.abortController.abort();
        } catch (e) {}
      }
      genState.streamToken += 1;
      genSetBusy(false);
    }
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
      wrap.appendChild(el("h1", null, T("page.notFoundTitle", { path: path })));
      wrap.appendChild(el("p", null, T("page.notFoundBody")));
      appEl.appendChild(wrap);
    }
  }

  /* J34 初始化 */
  function initStatic() {
    modalBackdrop = $("#modalBackdrop");
    modalBox = $("#modalBox");
    sidebarPagesEl = $("#sidebar-pages");
    sidebarEl = $("#sidebar");
    overlayEl = $("#overlay");
    hamburgerBtn = $("#hamburgerBtn");
    appEl = $("#app");
    sidebarSearchEl = $("#sidebarSearch");
    var savedTheme = "light";
    try {
      savedTheme = localStorage.getItem(THEME_KEY) || "light";
    } catch (e) {}
    applyTheme(savedTheme);
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
      "touchstart",
      function (e) {
        if (e.touches && e.touches.length > 1) e.preventDefault();
      },
      { passive: false },
    );
    document.addEventListener(
      "touchmove",
      function (e) {
        if (e.touches && e.touches.length > 1) e.preventDefault();
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
    document.addEventListener("click", function (e) {
      var aiMenu = $("#aiModelMenu");
      if (aiMenu && aiMenu.classList.contains("show")) {
        var picker = aiMenu.parentNode;
        if (picker && !picker.contains(e.target)) {
          aiMenu.classList.remove("show");
        }
      }
      var genMenu = $("#genModelMenu");
      if (genMenu && genMenu.classList.contains("show")) {
        var gPicker = genMenu.parentNode;
        if (gPicker && !gPicker.contains(e.target)) {
          closeGenMenu();
        }
      }
      if (!e.target.closest(".ai-msg")) {
        $$(".ai-msg.actions-visible").forEach(function (el) {
          el.classList.remove("actions-visible");
        });
      }
    });
    if (sidebarSearchEl) {
      sidebarSearchEl.addEventListener("input", function () {
        var v = this.value || "";
        sidebarSearchKeyword = v;
        if (sidebarSearchTimer) clearTimeout(sidebarSearchTimer);
        sidebarSearchTimer = setTimeout(function () {
          sidebarSearchTimer = null;
          updateSidebarPages();
        }, SEARCH_DEBOUNCE_MS);
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
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (appEl.classList.contains("preview-mode")) {
        appEl.style.width = window.innerWidth + "px";
        appEl.style.height = window.innerHeight + "px";
      }
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (editor) editor.refresh();
      }, 100);
    });
  }

  /* J35 启动 */
  function loadContent() {
    return fetch(CONTENT_URL, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        CONTENT = json || {};
        I18N = CONTENT.i18n || {};
        AI_MODELS = (CONTENT.models || []).slice();
        LANG = detectLang();
      });
  }
  function boot() {
    initStatic();
    initAIState();
    applyI18nToStatic();
    updateSidebarPages();
    render();
  }
  loadContent()
    .then(function () {
      boot();
    })
    .catch(function (e) {
      console.warn("[content.json] 加载失败，使用默认文案：", e);
      boot();
    });
})();