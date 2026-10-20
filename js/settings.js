(function (App) {
  "use strict";
  App._storageItems = function () {
    return [
      {
        id: "pages",
        nameKey: "storage.itemWorks",
        keys: [App.STORAGE_KEY],
        defaultOn: true,
      },
      {
        id: "draft",
        nameKey: "storage.itemDraft",
        keys: [App.DRAFT_KEY],
        defaultOn: true,
      },
      {
        id: "settings",
        nameKey: "storage.itemSettings",
        keys: [App.THEME_KEY, App.LANG_KEY, App.SETTINGS_KEY],
        defaultOn: true,
      },
      {
        id: "keys",
        nameKey: "storage.itemKeys",
        keys: [App.AI_KEY_STORAGE],
        defaultOn: false,
      },
      {
        id: "prompts",
        nameKey: "storage.itemPrompts",
        keys: [App.AI_PROMPT_STORAGE],
        defaultOn: true,
      },
      {
        id: "customModels",
        nameKey: "storage.itemCustomModels",
        keys: [App.AI_CUSTOM_MODELS_STORAGE],
        defaultOn: true,
      },
      {
        id: "currentModel",
        nameKey: "storage.itemCurrentModel",
        keys: [App.AI_CURRENT_MODEL_STORAGE],
        defaultOn: true,
      },
      {
        id: "chats",
        nameKey: "storage.itemChats",
        dynamic: "chats",
        defaultOn: true,
      },
    ];
  };
  App._itemSizeKB = function (item) {
    var total = 0;
    if (item.dynamic === "chats") {
      App.getAllModels().forEach(function (m) {
        var v = App.storageGet(App.AI_CHAT_STORAGE + "_" + m.id, null);
        if (v != null) total += JSON.stringify(v).length;
      });
    } else {
      item.keys.forEach(function (k) {
        var v = App.storageGet(k, null);
        if (v != null) total += JSON.stringify(v).length;
      });
    }
    return Math.round((total * App.STORAGE_KB_MULTIPLIER) / 1024 * 10) / 10;
  };
  App._deleteItem = function (item) {
    if (item.dynamic === "chats") {
      App.getAllModels().forEach(function (m) {
        App.storageRemove(App.AI_CHAT_STORAGE + "_" + m.id);
      });
      App.aiState.chats = {};
      App.state.renderedMsgCount = 0;
      return;
    }
    item.keys.forEach(function (k) {
      App.storageRemove(k);
    });
    if (item.id === "pages") {
      App.updateSidebarPages();
      if (
        App.state.runner.mode === "page" &&
        App.state.runner.pageId !== null
      ) {
        var still = App.getPages().some(function (p) {
          return p.id === App.state.runner.pageId;
        });
        if (!still) {
          App.state.runner.mode = "random";
          App.state.runner.pageId = null;
        }
      }
    }
    if (item.id === "draft")
      App.state.generatorDraft = { title: "", script: "" };
    if (item.id === "keys") App.aiState.keys = {};
    if (item.id === "prompts") App.aiState.prompts = {};
    if (item.id === "customModels") {
      App.aiState.customModels = [];
      App.buildAIModelMenu();
      App.refreshAIModelUI();
    }
    if (item.id === "currentModel") {
      App.aiState.currentModel = null;
      App.refreshAIModelUI();
    }
    if (item.id === "settings") {
      App.settings.MAX_IMAGE_BYTES =
        App.DEFAULT_SETTINGS.maxImageMB * 1024 * 1024;
      App.settings.MAX_TOOL_LOOP = App.DEFAULT_SETTINGS.maxToolLoop;
      App.settings.MAX_CONTEXT_MESSAGES = App.DEFAULT_SETTINGS.maxContext;
      App.settings.REQUEST_TIMEOUT_MS =
        App.DEFAULT_SETTINGS.requestTimeoutSec * 1000;
      App.settings.MAX_TITLE_LEN = App.DEFAULT_SETTINGS.maxTitleLen;
    }
  };
  App._writeItemsToZip = function (zip, selected) {
    var itemKeys = selected.map(function (it) {
      return it.dynamic === "chats" ? "p5_ai_chats" : it.keys[0];
    });
    zip.file(
      "manifest.json",
      JSON.stringify(
        {
          app: "randomArt",
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          items: itemKeys,
        },
        null,
        2,
      ),
    );
    selected.forEach(function (item) {
      if (item.dynamic === "chats") {
        var chatsMap = {};
        App.getAllModels().forEach(function (m) {
          var v = App.storageGet(App.AI_CHAT_STORAGE + "_" + m.id, null);
          if (v && v.length) chatsMap[m.id] = v;
        });
        zip.file("p5_ai_chats.json", JSON.stringify(chatsMap, null, 2));
        return;
      }
      if (item.id === "settings") {
        var s = {
          theme: App.storageGet(App.THEME_KEY, "light"),
          lang: App.storageGet(App.LANG_KEY, ""),
          settings: App.storageGet(App.SETTINGS_KEY, null),
        };
        zip.file("p5_settings.json", JSON.stringify(s, null, 2));
        return;
      }
      var v = App.storageGet(item.keys[0], null);
      if (v == null) return;
      zip.file(item.keys[0] + ".json", JSON.stringify(v, null, 2));
    });
  };
  App._packSelected = function (selected, anchorEl) {
    if (!selected.length) {
      if (anchorEl) App.flashTip(anchorEl, App.T("settings.packNoSelection"));
      else App.showAlert(App.T("settings.packNoSelection"), "", true);
      return;
    }
    var zip = new JSZip();
    App._writeItemsToZip(zip, selected);
    zip
      .generateAsync({ type: "base64" })
      .then(function (base64) {
        try {
          var url = "data:application/zip;base64," + base64;
          var link = document.createElement("a");
          link.href = url;
          link.download = "randomArt_backup.zip";
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (e) {
          App.showAlert(
            App.T("page.exportFailTitle"),
            String((e && e.message) || e),
            true,
          );
        }
      })
      .catch(function (err) {
        App.showAlert(
          App.T("page.exportFailTitle"),
          String((err && err.message) || err),
          true,
        );
      });
  };
  App._parseBackupFile = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var buf = e.target.result;
        var isZip = false;
        try {
          var arr = new Uint8Array(buf, 0, 4);
          isZip = arr[0] === 0x50 && arr[1] === 0x4b;
        } catch (err) {}
        if (isZip) {
          JSZip.loadAsync(buf)
            .then(function (zip) {
              var tasks = [];
              var knownFiles = [
                "p5_pages.json",
                "p5_gen_draft.json",
                "p5_settings.json",
                "p5_ai_keys.json",
                "p5_ai_prompts.json",
                "p5_ai_custom_models.json",
                "p5_ai_current_model.json",
                "p5_ai_chats.json",
              ];
              var result = { source: file.name, files: {}, manifest: null };
              if (zip.file("manifest.json")) {
                tasks.push(
                  zip
                    .file("manifest.json")
                    .async("string")
                    .then(function (txt) {
                      try {
                        result.manifest = JSON.parse(txt);
                      } catch (e) {}
                    }),
                );
              }
              knownFiles.forEach(function (fn) {
                var f = zip.file(fn);
                if (!f) return;
                tasks.push(
                  f.async("string").then(function (txt) {
                    try {
                      result.files[fn] = JSON.parse(txt);
                    } catch (e) {}
                  }),
                );
              });
              return Promise.all(tasks).then(function () {
                resolve(result);
              });
            })
            .catch(reject);
          return;
        }
        try {
          var txt = new TextDecoder("utf-8").decode(new Uint8Array(buf));
          var obj = JSON.parse(txt);
          resolve({
            source: file.name,
            files: { __single__: obj },
            manifest: null,
          });
        } catch (err) {
          reject(new Error("bad json"));
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };
  App._previewImport = function (parsed) {
    var f = parsed.files;
    var items = [];
    function add(id, nameKey, available, count, extra) {
      if (available) {
        items.push({
          id: id,
          nameKey: nameKey,
          count: count,
          extra: extra || "",
        });
      }
    }
    if (f["p5_pages.json"]) {
      var arr = Array.isArray(f["p5_pages.json"]) ? f["p5_pages.json"] : [];
      var cur = App.storageGet(App.STORAGE_KEY, []).length;
      add("pages", "storage.itemWorks", true, arr.length, "当前 " + cur + " 条");
    }
    if (f["p5_gen_draft.json"])
      add("draft", "storage.itemDraft", true, 1, "");
    if (f["p5_settings.json"])
      add("settings", "storage.itemSettings", true, 1, "");
    if (f["p5_ai_keys.json"]) {
      var k = f["p5_ai_keys.json"];
      var kc = k && typeof k === "object" ? Object.keys(k).length : 0;
      add("keys", "storage.itemKeys", true, kc, "");
    }
    if (f["p5_ai_prompts.json"]) {
      var pr = f["p5_ai_prompts.json"];
      var pc = pr && typeof pr === "object" ? Object.keys(pr).length : 0;
      add("prompts", "storage.itemPrompts", true, pc, "");
    }
    if (f["p5_ai_custom_models.json"]) {
      var cm = Array.isArray(f["p5_ai_custom_models.json"])
        ? f["p5_ai_custom_models.json"]
        : [];
      add("customModels", "storage.itemCustomModels", true, cm.length, "");
    }
    if (f["p5_ai_current_model.json"])
      add("currentModel", "storage.itemCurrentModel", true, 1, "");
    if (f["p5_ai_chats.json"]) {
      var ch = f["p5_ai_chats.json"];
      var chc = ch && typeof ch === "object" ? Object.keys(ch).length : 0;
      add("chats", "storage.itemChats", true, chc, "");
    }
    return items;
  };
  App._applyImport = function (parsed, selectedIds) {
    var f = parsed.files;
    if (selectedIds.indexOf("pages") !== -1 && f["p5_pages.json"]) {
      var existing = App.storageGet(App.STORAGE_KEY, []);
      var idSet = {};
      existing.forEach(function (p) {
        idSet[p.id] = true;
      });
      var incoming = Array.isArray(f["p5_pages.json"])
        ? f["p5_pages.json"]
        : [];
      incoming.forEach(function (p) {
        if (p && p.id && !idSet[p.id]) {
          existing.push(p);
          idSet[p.id] = true;
        }
      });
      App.storageSet(App.STORAGE_KEY, existing);
    }
    if (selectedIds.indexOf("draft") !== -1 && f["p5_gen_draft.json"]) {
      App.storageSet(App.DRAFT_KEY, f["p5_gen_draft.json"]);
    }
    if (selectedIds.indexOf("settings") !== -1 && f["p5_settings.json"]) {
      var s = f["p5_settings.json"];
      if (s.theme) App.storageSet(App.THEME_KEY, s.theme);
      if (s.lang) App.storageSet(App.LANG_KEY, s.lang);
      if (s.settings) App.storageSet(App.SETTINGS_KEY, s.settings);
    }
    if (selectedIds.indexOf("keys") !== -1 && f["p5_ai_keys.json"]) {
      App.storageSet(App.AI_KEY_STORAGE, f["p5_ai_keys.json"]);
    }
    if (selectedIds.indexOf("prompts") !== -1 && f["p5_ai_prompts.json"]) {
      App.storageSet(App.AI_PROMPT_STORAGE, f["p5_ai_prompts.json"]);
    }
    if (
      selectedIds.indexOf("customModels") !== -1 &&
      f["p5_ai_custom_models.json"]
    ) {
      var existingM = App.storageGet(App.AI_CUSTOM_MODELS_STORAGE, []);
      var midSet = {};
      existingM.forEach(function (m) {
        midSet[m.id] = true;
      });
      var incM = Array.isArray(f["p5_ai_custom_models.json"])
        ? f["p5_ai_custom_models.json"]
        : [];
      incM.forEach(function (m) {
        if (m && m.id && !midSet[m.id]) {
          existingM.push(m);
          midSet[m.id] = true;
        }
      });
      App.storageSet(App.AI_CUSTOM_MODELS_STORAGE, existingM);
    }
    if (
      selectedIds.indexOf("currentModel") !== -1 &&
      f["p5_ai_current_model.json"]
    ) {
      var cm = f["p5_ai_current_model.json"];
      if (typeof cm === "string")
        App.storageSet(App.AI_CURRENT_MODEL_STORAGE, cm);
    }
    if (selectedIds.indexOf("chats") !== -1 && f["p5_ai_chats.json"]) {
      var chatsMap = f["p5_ai_chats.json"];
      if (chatsMap && typeof chatsMap === "object") {
        Object.keys(chatsMap).forEach(function (modelId) {
          App.storageSet(
            App.AI_CHAT_STORAGE + "_" + modelId,
            chatsMap[modelId],
          );
        });
      }
    }
  };

  App.showSettingsDialog = function () {
    App.openModal(function (box) {
      var header = App.el("div", "settings-header");
      header.appendChild(App.el("h3", null, App.T("settings.title")));
      var closeTopBtn = App.el(
        "button",
        "settings-close-btn",
        App.T("common.close"),
      );
      closeTopBtn.type = "button";
      closeTopBtn.addEventListener("click", App.closeModal);
      header.appendChild(closeTopBtn);
      box.appendChild(header);
      var langSec = App.el("section", "settings-section");
      langSec.appendChild(App.el("h4", null, App.T("settings.langSection")));
      var langGroup = App.el("div", "lang-group");
      ["zh", "en"].forEach(function (code) {
        var btn = App.el(
          "button",
          "lang-btn" + (App.LANG === code ? " active" : ""),
        );
        btn.type = "button";
        btn.textContent = code === "zh" ? "中文" : "English";
        btn.dataset.lang = code;
        langGroup.appendChild(btn);
      });
      langSec.appendChild(langGroup);
      box.appendChild(langSec);
      var paramSec = App.el("section", "settings-section");
      paramSec.appendChild(App.el("h4", null, App.T("settings.paramsSection")));
      var params = [
        { key: "maxImageMB", labelKey: "settings.paramImageMB" },
        { key: "maxToolLoop", labelKey: "settings.paramToolLoop" },
        { key: "maxContext", labelKey: "settings.paramContext" },
        { key: "requestTimeoutSec", labelKey: "settings.paramTimeout" },
        { key: "maxTitleLen", labelKey: "settings.paramTitleLen" },
      ];
      var savedSettings = App.storageGet(App.SETTINGS_KEY, null);
      params.forEach(function (p) {
        var row = App.el("div", "settings-param-row");
        row.appendChild(App.el("label", null, App.T(p.labelKey)));
        var input = document.createElement("input");
        input.type = "number";
        input.dataset.key = p.key;
        input.value =
          savedSettings && typeof savedSettings[p.key] === "number"
            ? savedSettings[p.key]
            : App.DEFAULT_SETTINGS[p.key];
        row.appendChild(input);
        paramSec.appendChild(row);
      });
      var paramActions = App.el("div", "settings-param-actions");
      var restoreBtn = App.el(
        "button",
        "settings-restore-btn",
        App.T("settings.restoreDefault"),
      );
      restoreBtn.type = "button";
      restoreBtn.addEventListener("click", function () {
        App.$$(".settings-param-row input", box).forEach(function (inp) {
          var k = inp.dataset.key;
          if (k && typeof App.DEFAULT_SETTINGS[k] === "number") {
            inp.value = App.DEFAULT_SETTINGS[k];
          }
        });
      });
      var saveBtn = App.el(
        "button",
        "settings-save-btn",
        App.T("settings.saveBtn"),
      );
      saveBtn.type = "button";
      saveBtn.addEventListener("click", function () {
        var ranges = {
          maxImageMB: [0.1, 100],
          maxToolLoop: [1, 20],
          maxContext: [5, 200],
          requestTimeoutSec: [10, 300],
          maxTitleLen: [10, 200],
        };
        var draft = {};
        var ok = true;
        App.$$(".settings-param-row input", box).forEach(function (inp) {
          var k = inp.dataset.key;
          if (!k || !ranges[k]) return;
          var v = Number(inp.value);
          if (isNaN(v) || v < ranges[k][0] || v > ranges[k][1]) {
            ok = false;
            return;
          }
          draft[k] = v;
        });
        if (!ok) {
          App.flashTip(saveBtn, App.T("settings.invalidRange"));
          return;
        }
        App.saveSettings(draft);
        App.flashTip(saveBtn, App.T("settings.saved"));
      });
      paramActions.appendChild(restoreBtn);
      paramActions.appendChild(saveBtn);
      paramSec.appendChild(paramActions);
      box.appendChild(paramSec);
      var storageSec = App.el("section", "settings-section");
      storageSec.appendChild(
        App.el("h4", null, App.T("settings.storageSection")),
      );
      var list = App.el("div", "storage-list");
      storageSec.appendChild(list);
      var totalEl = App.el("div", "storage-total");
      storageSec.appendChild(totalEl);
      var storageActions = App.el("div", "settings-storage-actions");
      var packBtn = App.el(
        "button",
        "settings-pack-btn",
        App.T("settings.packBtn"),
      );
      packBtn.type = "button";
      var importBtn = App.el(
        "button",
        "settings-import-btn",
        App.T("settings.importBtn"),
      );
      importBtn.type = "button";
      var exportBtn = App.el(
        "button",
        "settings-export-btn",
        App.T("settings.exportZipBtn"),
      );
      exportBtn.type = "button";
      exportBtn.addEventListener("click", function () {
        var pages = App.getPages();
        if (!pages.length) {
          App.flashTip(exportBtn, App.T("page.exportEmptyTitle"));
          return;
        }
        App.exportZip();
      });
      storageActions.appendChild(packBtn);
      storageActions.appendChild(importBtn);
      storageActions.appendChild(exportBtn);
      storageSec.appendChild(storageActions);
      var importFile = document.createElement("input");
      importFile.type = "file";
      importFile.accept = ".zip,.json,application/zip,application/json";
      importFile.style.display = "none";
      storageSec.appendChild(importFile);
      box.appendChild(storageSec);
      var items = App._storageItems();
      var cbs = [];
      function refreshTotal() {
        var total = 0;
        items.forEach(function (it, i) {
          if (cbs[i] && cbs[i].checked) total += App._itemSizeKB(it);
        });
        totalEl.textContent = App.T("settings.totalLabel", {
          kb: Math.round(total * 10) / 10,
        });
      }
      function renderList() {
        list.replaceChildren();
        cbs = [];
        items.forEach(function (item) {
          var row = App.el("div", "storage-row");
          var cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = item.defaultOn !== false;
          cb.addEventListener("change", refreshTotal);
          cbs.push(cb);
          row.appendChild(cb);
          row.appendChild(App.el("span", "storage-name", App.T(item.nameKey)));
          row.appendChild(
            App.el(
              "span",
              "storage-size",
              App._itemSizeKB(item) + " KB",
            ),
          );
          var delBtn = App.el("button", "storage-del-btn", "🗑");
          delBtn.type = "button";
          delBtn.title = App.T("common.delete");
          delBtn.addEventListener("click", function () {
            App.showConfirm(
              App.T("settings.deleteConfirmTitle"),
              App.T("settings.deleteConfirmBody", {
                name: App.T(item.nameKey),
              }),
              function () {
                App._deleteItem(item);
                renderList();
              },
              true,
            );
          });
          row.appendChild(delBtn);
          list.appendChild(row);
        });
        refreshTotal();
      }
      renderList();
      App.$$(".lang-btn", langGroup).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var code = btn.dataset.lang;
          if (!code || code === App.LANG) return;
          App.LANG = code;
          App.storageSet(App.LANG_KEY, code);
          App._i18nCache = null;
          App.applyI18nToStatic();
          App.updateSidebarPages();
          App.closeModal();
          App.render();
          App.showSettingsDialog();
        });
      });
      packBtn.addEventListener("click", function () {
        var selected = items.filter(function (_, i) {
          return cbs[i] && cbs[i].checked;
        });
        App._packSelected(selected, packBtn);
      });
      importBtn.addEventListener("click", function () {
        importFile.value = "";
        importFile.click();
      });
      importFile.addEventListener("change", function () {
        var file = this.files && this.files[0];
        if (!file) return;
        App._parseBackupFile(file)
          .then(function (parsed) {
            var preview = App._previewImport(parsed);
            if (!preview.length) {
              App.showAlert(
                App.T("settings.importFail"),
                App.T("settings.importBadFormat"),
                true,
              );
              return;
            }
            App.closeModal();
            App._showImportDialog(parsed, preview);
          })
          .catch(function (err) {
            App.showAlert(
              App.T("settings.importFail"),
              String((err && err.message) || err),
              true,
            );
          });
      });
    });
  };

  App._showImportDialog = function (parsed, preview) {
    App.openModal(function (box) {
      box.appendChild(App.el("h3", null, App.T("settings.importTitle")));
      box.appendChild(
        App.el(
          "div",
          "modal-hint",
          App.T("settings.importSource", { name: parsed.source }),
        ),
      );

      var list = App.el("div", "import-list");
      var cbs = [];
      preview.forEach(function (item) {
        var row = App.el("div", "import-row");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = true;
        cb.dataset.id = item.id;
        cbs.push(cb);
        row.appendChild(cb);
        row.appendChild(App.el("span", "import-name", App.T(item.nameKey)));
        var countText =
          item.count > 0
            ? App.T("settings.importCount", { n: item.count })
            : "";
        if (item.extra) countText += "（" + item.extra + "）";
        row.appendChild(App.el("span", "import-count", countText));
        list.appendChild(row);
      });
      box.appendChild(list);

      box.appendChild(
        App.el("div", "modal-hint", App.T("settings.importConflictHint")),
      );

      var actions = App.el("div", "modal-actions");
      var leftWrap = document.createElement("div");
      var cancel = App.el("button", "link-btn", App.T("common.cancel"));
      cancel.addEventListener("click", App.closeModal);
      leftWrap.appendChild(cancel);
      var rg = App.rightGroup();
      var ok = App.el("button", null, App.T("settings.importConfirm"));
      ok.addEventListener("click", function () {
        var selectedIds = cbs
          .filter(function (cb) {
            return cb.checked;
          })
          .map(function (cb) {
            return cb.dataset.id;
          });
        if (!selectedIds.length) {
          App.showAlert(App.T("settings.packNoSelection"), "", true);
          return;
        }
        App._applyImport(parsed, selectedIds);
        App.closeModal();
        App.LANG = App.detectLang();
        App.applyTheme(App.storageGet(App.THEME_KEY, "light"));
        App.loadSettings();
        App.initAIState();
        App._i18nCache = null;
        App.applyI18nToStatic();
        App.updateSidebarPages();
        App.render();
        App.showAlert(App.T("settings.importOk"), "");
      });
      rg.appendChild(ok);
      actions.appendChild(leftWrap);
      actions.appendChild(rg);
      box.appendChild(actions);
    });
  };

})(window.App);