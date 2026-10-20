window.App = window.App || {};

(function (App) {
  "use strict";


  /* ============================================================
     J1 常量声明
     作用：全模块共享常量+工具声明单一数据源
     机制：TOOL_SPECS为唯一源；OpenAI/Gemini双协议派生
     ============================================================ */
  /* 存储键 */
  App.STORAGE_KEY = "p5_pages";
  App.THEME_KEY = "p5_theme";
  App.LANG_KEY = "p5_lang";
  App.DRAFT_KEY = "p5_gen_draft";
  App.AI_KEY_STORAGE = "p5_ai_keys";
  App.AI_CHAT_STORAGE = "p5_ai_chats";
  App.AI_PROMPT_STORAGE = "p5_ai_prompts";
  App.AI_CUSTOM_MODELS_STORAGE = "p5_ai_custom_models";
  App.AI_CURRENT_MODEL_STORAGE = "p5_ai_current_model";
  App.SETTINGS_KEY = "p5_settings";

  /* 默认参数（图片上限 1.5MB） */
  App.DEFAULT_SETTINGS = {
    maxImageMB: 1.5,
    maxToolLoop: 5,
    maxContext: 30,
    requestTimeoutSec: 60,
    maxTitleLen: 60,
  };

  /* UI常量 */
  App.TEST_TIMEOUT_MS = 15000;
  App.CONTENT_URL = "data/content.json";
  App.LONG_PRESS_MS = 500;
  App.FLASH_TIP_MS = 1200;
  App.NEAR_BOTTOM_PX = 80;
  App.SEARCH_DEBOUNCE_MS = 150;
  App.STORAGE_KB_MULTIPLIER = 2;
  App.MAX_SESSION_IMAGES = 10;

  /* 运行时常量：首页随机脚本 */
  App.P5_DIR = "p5/";
  App.P5_CDN = "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js";
  App.P5_FILES = ["sketch1.js", "sketch2.js", "sketch3.js"];

  /* 工具声明单一数据源 */
  App.TOOL_SPECS = [
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
            description: "要追加的 p5.js 代码片段，不要加 markdown 代码块标记",
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
          code: { type: "string", description: "替换选中内容的 p5.js 代码片段" },
        },
        required: ["code"],
      },
    },
    {
      name: "get_canvas_size",
      description:
        "获取当前编辑器代码中的画布尺寸。若编辑器无数字画布，返回响应式语义值。",
      params: { type: "object", properties: {} },
    },
    {
      name: "set_color_palette",
      description: "设置配色方案。适用于：用户要求换一组配色，或需要统一色彩风格时。",
      params: {
        type: "object",
        properties: {
          colors: {
            type: "array",
            description: "颜色数组，RGB 十六进制字符串",
            items: { type: "string" },
          },
        },
        required: ["colors"],
      },
    },
    {
      name: "save_page",
      description: "保存当前编辑器内容为作品。",
      params: {
        type: "object",
        properties: {
          title: { type: "string", description: "作品标题，可选" },
        },
      },
    },
    {
      name: "open_preview",
      description: "打开当前编辑器内容的预览。",
      params: { type: "object", properties: {} },
    },
  ];

  /* 派生：类型大写化 */
  App._toGeminiType = function (t) {
    return String(t || "").toUpperCase();
  };
  /* 派生：递归转换schema为Gemini风格 */
  App._toGeminiSchema = function (schema) {
    if (!schema || typeof schema !== "object") return schema;
    var out = { type: App._toGeminiType(schema.type) };
    if (schema.description) out.description = schema.description;
    if (schema.properties) {
      out.properties = {};
      Object.keys(schema.properties).forEach(function (k) {
        out.properties[k] = App._toGeminiSchema(schema.properties[k]);
      });
    }
    if (schema.items) out.items = App._toGeminiSchema(schema.items);
    if (schema.required) out.required = schema.required.slice();
    return out;
  };
  /* 派生：OpenAI格式声明 */
  App.buildOpenAITools = function () {
    return App.TOOL_SPECS.map(function (t) {
      return {
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.params,
        },
      };
    });
  };
  /* 派生：Gemini格式声明 */
  App.buildGeminiTools = function () {
    return [
      {
        functionDeclarations: App.TOOL_SPECS.map(function (t) {
          return {
            name: t.name,
            description: t.description,
            parameters: App._toGeminiSchema(t.params),
          };
        }),
      },
    ];
  };

  /* 运行时数据（由loadContent填充） */
  App.AI_MODELS = [];
  App.I18N = {};
  App.LANG = "zh";
  App.CONTENT = null;


  /* ============================================================
     J2 全局状态
     作用：全模块共享的可变状态+DOM引用
     机制：挂到App.state单点管理
     ============================================================ */
  /* AI状态 */
  App.aiState = {
    currentModel: null,
    keys: {},
    chats: {},
    prompts: {},
    customModels: [],
    busy: false,
    abortController: null,
    streamToken: 0,
  };
  /* 生成器状态 */
  App.genState = {
    messages: [],
    busy: false,
    abortController: null,
    streamToken: 0,
    menuOpen: false,
    palette: null,
  };
  /* 运行时可配参数（启动由loadSettings覆盖） */
  App.settings = {
    MAX_IMAGE_BYTES: App.DEFAULT_SETTINGS.maxImageMB * 1024 * 1024,
    MAX_TOOL_LOOP: App.DEFAULT_SETTINGS.maxToolLoop,
    MAX_CONTEXT_MESSAGES: App.DEFAULT_SETTINGS.maxContext,
    REQUEST_TIMEOUT_MS: App.DEFAULT_SETTINGS.requestTimeoutSec * 1000,
    MAX_TITLE_LEN: App.DEFAULT_SETTINGS.maxTitleLen,
  };
  /*  DOM引用 */
  App.dom = {
    modalBackdrop: null,
    modalBox: null,
    lastFocused: null,
    sidebarPagesEl: null,
    sidebarEl: null,
    overlayEl: null,
    hamburgerBtn: null,
    sidebarSearchEl: null,
    sidebarSearchKeyword: "",
    sidebarSearchTimer: null,
    appEl: null,
  };
  /*  运行状态（sessionImages） */
  App.state = {
    editor: null,
    uploadedImageDataUrl: null,
    uploadedImageInfo: null,
    sessionImages: {},          /* 内存图片映射（供预览用） */
    generatorDraft: { title: "", script: "" },
    renderedMsgCount: 0,
    renderedModelId: null,
    runner: { mode: "random", pageId: null, tempHtml: null },
    currentRandomFile: null,
  };


  /* ============================================================
     J3 i18n
     作用：文案国际化，支持中英文切换
     机制：T() 取文案；静态节点一次性填充；节点列表首次收集后缓存
     ============================================================ */
  App.T = function (key, params) {
    var pack = App.I18N[App.LANG] || App.I18N.zh || {};
    var text = pack[key];
    if (text == null) text = (App.I18N.zh && App.I18N.zh[key]) || key;
    if (params) {
      text = String(text).replace(/\{(\w+)\}/g, function (m, k) {
        return params[k] != null ? String(params[k]) : m;
      });
    }
    return text;
  };
  /* 语言检测：保存值 > 浏览器语言 > defaultLang > en */
  App.detectLang = function () {
    var saved = App.storageGet(App.LANG_KEY, null);
    if (saved && App.I18N[saved]) return saved;
    var nav = (navigator.language || "zh").toLowerCase();
    if (nav.indexOf("zh") === 0) return "zh";
    if (nav.indexOf("en") === 0) return "en";
    if (
      App.CONTENT &&
      App.CONTENT.defaultLang &&
      App.I18N[App.CONTENT.defaultLang]
    ) {
      return App.CONTENT.defaultLang;
    }
    return "en";
  };
  /* i18n节点缓存 */
  App._i18nCache = null;
  App._collectI18nNodes = function () {
    App._i18nCache = {
      text: App.$$("[data-i18n]"),
      placeholder: App.$$("[data-i18n-placeholder]"),
      title: App.$$("[data-i18n-title]"),
      aria: App.$$("[data-i18n-aria]"),
    };
  };
  /* 静态节点填充 */
  App.applyI18nToStatic = function () {
    if (!App._i18nCache) App._collectI18nNodes();
    App._i18nCache.text.forEach(function (el) {
      var text = App.T(el.getAttribute("data-i18n"));
      var span = el.querySelector("span");
      if (span) span.textContent = text;
      else el.textContent = text;
    });
    App._i18nCache.placeholder.forEach(function (el) {
      var k = el.getAttribute("data-i18n-placeholder");
      el.setAttribute("placeholder", App.T(k));
      el.setAttribute("aria-label", App.T(k));
    });
    App._i18nCache.title.forEach(function (el) {
      el.setAttribute("title", App.T(el.getAttribute("data-i18n-title")));
    });
    App._i18nCache.aria.forEach(function (el) {
      el.setAttribute("aria-label", App.T(el.getAttribute("data-i18n-aria")));
    });
    try {
      document.title = App.T("site.title");
      document.documentElement.lang = App.LANG === "zh" ? "zh-CN" : "en";
    } catch (e) {}
  };


  /* ============================================================
     J4 模型查询
     作用：模型配置的只读查询
     机制：内置AI_MODELS + 自定义customModels合并遍历
     ============================================================ */
  App.getAllModels = function () {
    return App.AI_MODELS.concat(App.aiState.customModels || []);
  };
  App.getToolModels = function () {
    return App.getAllModels().filter(function (m) {
      return m.supportsTools === true;
    });
  };
  App.aiModelConf = function (id) {
    var all = App.getAllModels();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null;
  };
  App.aiModelName = function (id) {
    var c = App.aiModelConf(id);
    return c ? c.name : id;
  };


  /* ============================================================
     J8 DOM工具
     作用：DOM查询/创建+字符串转义工具
     ============================================================ */
  App.$ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  App.$$ = function (sel, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(sel),
    );
  };
  /* HTML转义：五字符替换 */
  App.escapeHtml = function (text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };
  /* 脚本闭合转义：防止用户脚本提前关闭script */
  App.escapeScriptClose = function (str) {
    var LT = "\x3C";
    return String(str)
      .replace(new RegExp(LT + "/script", "gi"), LT + "\\/script")
      .replace(new RegExp(LT + "!--", "g"), LT + "\\!--")
      .replace(new RegExp(LT + "script", "gi"), LT + "\\script");
  };
  /* 文件名安全化 */
  App.safeFileName = function (name) {
    var n = String(name || "")
      .replace(/[\\/:*?"<>|~#%&{}]/g, "_")
      .replace(/\s+/g, "_")
      .trim();
    if (n.length > App.settings.MAX_TITLE_LEN)
      n = n.slice(0, App.settings.MAX_TITLE_LEN);
    return n || "untitled";
  };
  /* 快速建元素 */
  App.el = function (tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  };
  /* 弹窗右侧按钮组容器 */
  App.rightGroup = function () {
    return App.el("div", "right-group");
  };


  /* ============================================================
     J9 模态框系统
     作用：全站弹窗统一封装
     机制：backdrop显示+modalBox注入；focus trap循环Tab
     ============================================================ */
  App._modalFocusHandler = null;
  /* 焦点陷阱：Tab在弹窗内循环 */
  App._installFocusTrap = function (box) {
    App._removeFocusTrap();
    App._modalFocusHandler = function (e) {
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
    box.addEventListener("keydown", App._modalFocusHandler);
  };
  App._removeFocusTrap = function () {
    if (App._modalFocusHandler && App.dom.modalBox) {
      App.dom.modalBox.removeEventListener("keydown", App._modalFocusHandler);
    }
    App._modalFocusHandler = null;
  };
  /* 打开弹窗 */
  App.openModal = function (builder) {
    App.dom.lastFocused = document.activeElement;
    var box = App.dom.modalBox;
    box.innerHTML = "";
    box.removeAttribute("aria-labelledby");
    builder(box);
    var h3 = box.querySelector("h3");
    if (h3) {
      if (!h3.id) h3.id = "modalTitle_" + Date.now();
      box.setAttribute("aria-labelledby", h3.id);
    }
    App.dom.modalBackdrop.classList.add("show");
    App._installFocusTrap(box);
    var f = App.$("input, textarea, button", box);
    if (f && f.focus) f.focus();
  };
  App.closeModal = function () {
    App._removeFocusTrap();
    App.dom.modalBackdrop.classList.remove("show");
    App.dom.modalBox.innerHTML = "";
    if (App.dom.lastFocused && App.dom.lastFocused.focus)
      App.dom.lastFocused.focus();
  };
  /* 提示弹窗 */
  App.showAlert = function (title, message, isError) {
    App.openModal(function (box) {
      box.appendChild(App.el("h3", null, title));
      if (message) box.appendChild(App.el("p", null, message));
      var a = App.el("div", "modal-actions");
      var rg = App.rightGroup();
      var ok = App.el("button", isError ? "danger" : null, App.T("common.know"));
      ok.addEventListener("click", App.closeModal);
      rg.appendChild(ok);
      a.appendChild(rg);
      box.appendChild(a);
    });
  };
  /* 确认弹窗 */
  App.showConfirm = function (title, message, onConfirm, danger) {
    App.openModal(function (box) {
      box.appendChild(App.el("h3", null, title));
      if (message) box.appendChild(App.el("p", null, message));
      var a = App.el("div", "modal-actions");
      var rg = App.rightGroup();
      var cancel = App.el("button", "cancel", App.T("common.cancel"));
      cancel.addEventListener("click", App.closeModal);
      var ok = App.el("button", danger ? "danger" : null, App.T("common.ok"));
      ok.addEventListener("click", function () {
        App.closeModal();
        onConfirm();
      });
      rg.appendChild(cancel);
      rg.appendChild(ok);
      a.appendChild(rg);
      box.appendChild(a);
    });
  };
  /* 单行输入弹窗 */
  App.showPrompt = function (title, defaultValue, onOk, inputType, hint, opts) {
    App.openModal(function (box) {
      box.appendChild(App.el("h3", null, title));
      if (hint) box.appendChild(App.el("div", "modal-hint", hint));
      var input = document.createElement("input");
      input.type = inputType || "text";
      input.value = defaultValue || "";
      input.autocomplete = "off";
      input.spellcheck = false;
      var a = App.el("div", "modal-actions");
      var leftWrap = document.createElement("div");
      if (opts && opts.onClear) {
        var clearBtn = App.el(
          "button",
          "link-btn",
          opts.clearText || App.T("common.delete"),
        );
        clearBtn.type = "button";
        clearBtn.addEventListener("click", function () {
          App.closeModal();
          opts.onClear();
        });
        leftWrap.appendChild(clearBtn);
      }
      var rg = App.rightGroup();
      var cancel = App.el("button", "cancel", App.T("common.cancel"));
      cancel.addEventListener("click", App.closeModal);
      var ok = App.el("button", null, App.T("common.save"));
      ok.addEventListener("click", function () {
        var v = input.value.trim();
        if (!v) {
          input.focus();
          return;
        }
        App.closeModal();
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
  };
  /* 多行文本编辑弹窗 */
  App.showPromptArea = function (opts) {
    App.openModal(function (box) {
      box.appendChild(App.el("h3", null, opts.title));
      box.appendChild(
        App.el("div", "modal-hint", opts.hint || App.T("ai.setPromptHint")),
      );
      var ta = document.createElement("textarea");
      ta.value = opts.value || "";
      ta.placeholder = opts.placeholder || "";
      ta.rows = 7;
      ta.spellcheck = false;
      var a = App.el("div", "modal-actions");
      var leftWrap = document.createElement("div");
      if (opts.value && opts.value.trim()) {
        var clearBtn = App.el("button", "link-btn", App.T("ai.clearPrompt"));
        clearBtn.addEventListener("click", function () {
          App.closeModal();
          if (opts.onClear) opts.onClear();
        });
        leftWrap.appendChild(clearBtn);
      }
      var rg = App.rightGroup();
      var cancel = App.el("button", "cancel", App.T("common.cancel"));
      cancel.addEventListener("click", App.closeModal);
      var ok = App.el("button", null, App.T("common.save"));
      ok.addEventListener("click", function () {
        var v = ta.value;
        App.closeModal();
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
  };
  /* 意图选择弹窗：覆盖/修改 */
  App.showIntentChoice = function (title, message, onOverwrite, onModify) {
    App.openModal(function (box) {
      box.appendChild(App.el("h3", null, title));
      box.appendChild(App.el("p", null, message));
      var a = App.el("div", "modal-actions");
      var leftWrap = document.createElement("div");
      var cancel = App.el("button", "link-btn", App.T("common.cancel"));
      cancel.addEventListener("click", App.closeModal);
      leftWrap.appendChild(cancel);
      var rg = App.rightGroup();
      var modifyBtn = App.el("button", "cancel", App.T("gen.intentModify"));
      modifyBtn.addEventListener("click", function () {
        App.closeModal();
        onModify();
      });
      var overwriteBtn = App.el(
        "button",
        "danger",
        App.T("gen.intentOverwrite"),
      );
      overwriteBtn.addEventListener("click", function () {
        App.closeModal();
        onOverwrite();
      });
      rg.appendChild(modifyBtn);
      rg.appendChild(overwriteBtn);
      a.appendChild(leftWrap);
      a.appendChild(rg);
      box.appendChild(a);
    });
  };


  /* ============================================================
     剪贴板与浮动提示（供多模块复用）
     作用：复制文本+短暂视觉反馈
     ============================================================ */
  App.copyToClipboard = function (text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        App.fallbackCopy(text);
      });
      return;
    }
    App.fallbackCopy(text);
  };
  App.fallbackCopy = function (text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
  };
  App.flashTip = function (anchorEl, text) {
    if (!anchorEl) return;
    try {
      if (window.getComputedStyle(anchorEl).position === "static") {
        anchorEl.style.position = "relative";
      }
    } catch (e) {}
    var tip = App.el("div", "msg-flash-tip", text);
    anchorEl.appendChild(tip);
    setTimeout(function () {
      if (tip.parentNode) tip.parentNode.removeChild(tip);
    }, App.FLASH_TIP_MS);
  };

})(window.App);