(function (App) {
  "use strict";
  App.render = function () {
    var path = App.getRoute();
    var appEl = App.dom.appEl;
    appEl.classList.remove("preview-mode");
    appEl.classList.remove("ai-mode");
    appEl.classList.remove("generator-mode");

    if (App.genState.busy) {
      if (App.genState.abortController) {
        try {
          App.genState.abortController.abort();
        } catch (e) {}
      }
      App.genState.streamToken += 1;
      App.genSetBusy(false);
    }
    if (path !== "/" && path !== "" && path !== "/index.html") {
      if (App.state.runner.mode === "page") {
        App.state.runner.mode = "random";
        App.state.runner.pageId = null;
      }
    }
    if (path === "/" || path === "" || path === "/index.html") {
      App.renderRunner();
      return;
    }
    delete appEl.dataset.currentPageId;
    App.unlockAppSize();
    App.destroyEditor();
    appEl.replaceChildren();
    App.setActiveNav(path);
    if (path === "/ai") {
      appEl.classList.add("ai-mode");
      appEl.appendChild(App.renderAIAssistant());
      App.bindAIAssistant();
      return;
    }
    if (path === "/about") {
      appEl.appendChild(App.renderAbout());
    } else if (path === "/generator") {
      appEl.classList.add("generator-mode");
      appEl.appendChild(App.renderGenerator());
      App.bindGenerator();
    } else {
      var wrap = document.createElement("div");
      wrap.appendChild(
        App.el("h1", null, App.T("page.notFoundTitle", { path: path })),
      );
      wrap.appendChild(App.el("p", null, App.T("page.notFoundBody")));
      appEl.appendChild(wrap);
    }
  };
  App.renderAbout = function () {
    var wrap = document.createElement("div");
    wrap.appendChild(App.el("h1", null, App.T("about.title")));
    ["p1", "p2", "p3", "p4", "p5", "p6", "p7"].forEach(function (k) {
      var text = App.T("about." + k);
      if (text && text !== "about." + k) {
        wrap.appendChild(App.el("p", null, text));
      }
    });
    return wrap;
  };

  App._settingsLoaded = false;
  App._ensureSettingsLoaded = function () {
    if (App._settingsLoaded) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "js/settings.js";
      s.onload = function () {
        App._settingsLoaded = true;
        resolve();
      };
      s.onerror = function (e) {
        reject(e);
      };
      document.body.appendChild(s);
    });
  };

  App.initStatic = function () {
    var dom = App.dom;
    dom.modalBackdrop = App.$("#modalBackdrop");
    dom.modalBox = App.$("#modalBox");
    dom.sidebarPagesEl = App.$("#sidebar-pages");
    dom.sidebarEl = App.$("#sidebar");
    dom.overlayEl = App.$("#overlay");
    dom.hamburgerBtn = App.$("#hamburgerBtn");
    dom.appEl = App.$("#app");
    dom.sidebarSearchEl = App.$("#sidebarSearch");


    var savedTheme = "light";
    try {
      savedTheme = localStorage.getItem(App.THEME_KEY) || "light";
    } catch (e) {}
    App.applyTheme(savedTheme);

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
    document.addEventListener("pointerdown", function (e) {
      var aiMenu = App.$("#aiModelMenu");
      if (aiMenu && aiMenu.classList.contains("show")) {
        var picker = aiMenu.parentNode;
        if (picker && !picker.contains(e.target)) {
          aiMenu.classList.remove("show");
        }
      }
      var genMenu = App.$("#genModelMenu");
      if (genMenu && genMenu.classList.contains("show")) {
        var gPicker = genMenu.parentNode;
        if (gPicker && !gPicker.contains(e.target)) {
          App.closeGenMenu();
        }
      }
      if (!e.target.closest(".ai-msg")) {
        App.$$(".ai-msg.actions-visible").forEach(function (el) {
          el.classList.remove("actions-visible");
        });
      }
    });
    document.addEventListener("pointerdown", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (t.closest(".CodeMirror")) return;
      if (t.closest(".ai-model-picker")) return;
      if (t.closest(".modal-backdrop")) return;
      if (t.closest("button")) return;
      var active = document.activeElement;
      if (!active) return;
      var tag = active.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || active.isContentEditable) {
        active.blur();
      }
    });
    if (dom.sidebarSearchEl) {
      dom.sidebarSearchEl.addEventListener("input", function () {
        var v = this.value || "";
        dom.sidebarSearchKeyword = v;
        if (dom.sidebarSearchTimer) clearTimeout(dom.sidebarSearchTimer);
        dom.sidebarSearchTimer = setTimeout(function () {
          dom.sidebarSearchTimer = null;
          App.updateSidebarPages();
        }, App.SEARCH_DEBOUNCE_MS);
      });
      dom.sidebarSearchEl.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          if (this.value) {
            this.value = "";
            dom.sidebarSearchKeyword = "";
            App.updateSidebarPages();
          }
          e.stopPropagation();
        } else {
          e.stopPropagation();
        }
      });
      dom.sidebarSearchEl.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
    dom.hamburgerBtn.addEventListener("click", App.openSidebar);
    dom.overlayEl.addEventListener("click", App.closeSidebar);
    dom.modalBackdrop.addEventListener("click", function (e) {
      if (e.target === dom.modalBackdrop) App.closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (dom.modalBackdrop.classList.contains("show")) {
          App.closeModal();
        } else if (dom.sidebarEl.classList.contains("open")) {
          App.closeSidebar();
        } else if (
          App.state.runner.mode === "page" &&
          App.getRoute() === "/"
        ) {
          App.setRandom();
        }
      }
    });
    var exportZipBtn = App.$("#exportZipSidebar");
    if (exportZipBtn) {
      var openSettings = function () {
        App.closeSidebar();
        App._ensureSettingsLoaded()
          .then(function () {
            App.showSettingsDialog();
          })
          .catch(function () {
            console.warn("[settings.js] 加载失败");
          });
      };
      exportZipBtn.addEventListener("click", openSettings);
      exportZipBtn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSettings();
        }
      });
    }
    var themeBtn = App.$("#themeToggleSidebar");
    if (themeBtn) themeBtn.addEventListener("click", App.toggleTheme);
    App.$$(".sidebar .nav-item[data-path]").forEach(function (el) {
      var go = function () {
        var path = el.getAttribute("data-path");
        App.closeSidebar();
        if (path === "#/") {
          App.setRandom();
          return;
        }
        if (location.hash === path) App.render();
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
    dom.sidebarPagesEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var id = Number(btn.dataset.id);
      var action = btn.dataset.action;
      if (action === "open") {
        App.closeSidebar();
        App.runPage(id);
      } else if (action === "rename") {
        App.renamePage(id);
      } else if (action === "delete") {
        App.deletePage(id);
      }
    });
    window.addEventListener("hashchange", function () {
      App.render();
      App.closeSidebar();
    });
    window.addEventListener("orientationchange", function () {
      if (App.state.editor) App.state.editor.refresh();
    });
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (dom.appEl.classList.contains("preview-mode")) {
        dom.appEl.style.width = window.innerWidth + "px";
        dom.appEl.style.height = window.innerHeight + "px";
      }
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (App.state.editor) App.state.editor.refresh();
      }, 100);
    });
  };

  App.loadContent = function () {
    return fetch(App.CONTENT_URL, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        App.CONTENT = json || {};
        App.I18N = App.CONTENT.i18n || {};
        App.AI_MODELS = (App.CONTENT.models || []).slice();
        App.LANG = App.detectLang();
      });
  };
  App.boot = function () {
    App.initStatic();
    App.LANG = App.detectLang();
    App.applyTheme(App.storageGet(App.THEME_KEY, "light"));
    App.loadSettings();
    App.initAIState();
    App.applyI18nToStatic();
    App.updateSidebarPages();
    App.render();
  };
  App.loadContent()
    .then(function () {
      App.boot();
    })
    .catch(function (e) {
      console.warn("[content.json] 加载失败，使用默认文案：", e);
      App.boot();
    });

})(window.App);