(function (App) {
  "use strict";
  App.renderAIAssistant = function () {
    var page = App.el("div", "ai-page");
    var clearBtn = App.el("button", "ai-clear-btn", "−");
    clearBtn.id = "aiClearBtn";
    clearBtn.type = "button";
    clearBtn.title = App.T("ai.clearTitle");
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "aiImportFile";
    fileInput.accept = ".json,application/json";
    fileInput.style.display = "none";
    var messages = App.el("div", "ai-messages");
    messages.id = "aiMessages";
    messages.setAttribute("role", "log");
    messages.setAttribute("aria-live", "polite");
    messages.setAttribute("aria-relevant", "additions");
    var statsBar = App.el("div", "ai-stats");
    statsBar.id = "aiStats";
    statsBar.style.display = "none";
    var inputWrap = App.el("div", "ai-input-wrap");
    var bar = App.el("div", "ai-input-bar");
    var picker = App.el("div", "ai-model-picker");
    var modelBtn = App.el("button", "ai-model-btn", "+");
    modelBtn.id = "aiModelBtn";
    modelBtn.type = "button";
    modelBtn.title = App.T("ai.modelPickerTitle");
    var menu = App.el("div", "ai-model-menu");
    menu.id = "aiModelMenu";
    picker.appendChild(modelBtn);
    picker.appendChild(menu);
    var input = document.createElement("textarea");
    input.id = "aiInput";
    input.rows = 1;
    input.placeholder = App.T("ai.inputPlaceholder");
    var sendBtn = App.el("button", "ai-send-btn", "↑");
    sendBtn.id = "aiSendBtn";
    sendBtn.type = "button";
    sendBtn.title = App.T("ai.sendTitle");
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
  };

  App.buildAIModelMenu = function () {
    var menu = App.$("#aiModelMenu");
    if (!menu) return;
    var frag = document.createDocumentFragment();
    var topRow = App.el("div", "ai-model-toprow");
    var addBtn = App.el(
      "div",
      "ai-model-topbtn ai-model-add",
      App.T("ai.topRowAdd"),
    );
    addBtn.dataset.add = "1";
    var importBtn = App.el("div", "ai-model-topbtn", App.T("ai.topRowImport"));
    importBtn.dataset.import = "1";
    topRow.appendChild(addBtn);
    topRow.appendChild(importBtn);
    frag.appendChild(topRow);
    App.getAllModels().forEach(function (m) {
      var item = App.el("div", "ai-model-item");
      if (App.aiState.currentModel === m.id) item.classList.add("active");
      item.dataset.model = m.id;
      item.appendChild(App.el("span", "ai-check", "✓"));
      var name = App.el("span", "ai-model-name");
      var nameText = App.el("span", "ai-model-name-text", m.name);
      name.appendChild(nameText);
      if (!m.builtin) {
        var editBtn = App.el("button", "ai-model-edit", "✎");
        editBtn.type = "button";
        editBtn.title = App.T("ai.editModelTitle");
        editBtn.dataset.edit = m.id;
        name.appendChild(editBtn);
      }
      item.appendChild(name);
      var testBtn = App.el("button", "ai-dl", "T");
      testBtn.type = "button";
      testBtn.title = App.T("ai.menuTest");
      testBtn.dataset.test = m.id;
      var keyBtn = App.el("button", "ai-key", "K");
      keyBtn.type = "button";
      keyBtn.title = App.T("ai.menuKey");
      keyBtn.dataset.key = m.id;
      var promptBtn = App.el("button", "ai-prompt", "P");
      promptBtn.type = "button";
      promptBtn.title = App.T("ai.menuPrompt");
      promptBtn.dataset.prompt = m.id;
      if (App.aiState.prompts[m.id] && App.aiState.prompts[m.id].trim()) {
        promptBtn.classList.add("has-prompt");
      }
      var jsonBtn = App.el("button", "ai-dl", "J");
      jsonBtn.type = "button";
      jsonBtn.title = App.T("ai.menuDownloadJson");
      jsonBtn.dataset.json = m.id;
      var mdBtn = App.el("button", "ai-dl", "M");
      mdBtn.type = "button";
      mdBtn.title = App.T("ai.menuDownloadMd");
      mdBtn.dataset.md = m.id;
      item.appendChild(testBtn);
      item.appendChild(keyBtn);
      item.appendChild(promptBtn);
      item.appendChild(jsonBtn);
      item.appendChild(mdBtn);
      frag.appendChild(item);
    });
    menu.replaceChildren(frag);
  };
  App.refreshAIModelUI = function () {
    App.$$(".ai-model-item").forEach(function (el) {
      if (
        App.aiState.currentModel &&
        el.dataset.model === App.aiState.currentModel
      ) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
    var btn = App.$("#aiModelBtn");
    if (btn) {
      if (App.aiState.currentModel) {
        btn.classList.add("has-model");
        btn.textContent = App.aiModelName(App.aiState.currentModel).charAt(0);
      } else {
        btn.classList.remove("has-model");
        btn.textContent = "+";
      }
    }
    App.refreshGenModelBtn();
  };
  App.closeAIModelMenu = function () {
    var menu = App.$("#aiModelMenu");
    if (menu) menu.classList.remove("show");
  };
  App.toggleAIModelMenu = function () {
    var menu = App.$("#aiModelMenu");
    if (!menu) return;
    menu.classList.toggle("show");
  };

  App.buildAssistantToolbar = function (m, index) {
    var toolbar = App.el("div", "assistant-toolbar");
    var left = App.el("div", "toolbar-left");
    var chat = App.aiState.chats[App.aiState.currentModel] || [];
    var isLastAssistant =
      m.role === "assistant" && index === chat.length - 1 && index > 0;
    if (isLastAssistant) {
      var regenBtn = App.el(
        "button",
        "assistant-tool-btn",
        "↻ " + App.T("msg.regen"),
      );
      regenBtn.type = "button";
      regenBtn.title = App.T("msg.regen");
      regenBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        App.regenerateMessage(index);
      });
      left.appendChild(regenBtn);
    }
    var delBtn = App.el(
      "button",
      "assistant-tool-btn",
      "✕ " + App.T("msg.delete"),
    );
    delBtn.type = "button";
    delBtn.title = App.T("msg.delete");
    delBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      App.deleteMessageFrom(index);
    });
    left.appendChild(delBtn);
    if (m.usage) {
      var up = m.usage.prompt_tokens || 0;
      var down = m.usage.completion_tokens || 0;
      var total = m.usage.total_tokens || up + down;
      var tok = App.el("span", "assistant-token", "↑" + up + " ↓" + down);
      tok.title = total + " tokens";
      left.appendChild(tok);
    }
    toolbar.appendChild(left);
    var right = App.el("div", "toolbar-right");
    var copyBtn = App.el(
      "button",
      "assistant-tool-btn",
      "⧉ " + App.T("msg.copy"),
    );
    copyBtn.type = "button";
    copyBtn.title = App.T("msg.copy");
    copyBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      App.copyToClipboard(m.content || "");
      App.flashTip(toolbar, App.T("msg.copied"));
    });
    right.appendChild(copyBtn);
    toolbar.appendChild(right);
    return toolbar;
  };
  App.bindRowToggleActions = function (row) {
    var pressTimer = null;
    var longPressed = false;
    function show() {
      App.$$(".ai-msg.actions-visible").forEach(function (el) {
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
      }, App.LONG_PRESS_MS);
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
  };
  App.buildMsgNode = function (m, index) {
    var row = App.el(
      "div",
      "ai-msg " + (m.role === "assistant" ? "assistant" : "user"),
    );
    row.dataset.index = String(index);
    if (m.role === "assistant") {
      var body = App.el("div", "assistant-body");
      if (!m.content) {
        body.textContent = App.T("ai.thinking");
        body.classList.add("pending");
      } else {
        body.textContent = m.content;
      }
      row.appendChild(body);
      var toolbar = App.buildAssistantToolbar(m, index);
      row.appendChild(toolbar);
      App.bindRowToggleActions(row);
    } else {
      var b = App.el("div", "bubble");
      b.textContent = m.content;
      row.appendChild(b);
    }
    return row;
  };
  App.buildEmptyNode = function (text) {
    return App.el("div", "ai-empty", text);
  };

  App.renderAIMessages = function () {
    var box = App.$("#aiMessages");
    if (!box) return;
    var model = App.aiState.currentModel;
    if (!model) {
      if (!box.firstChild || !box.querySelector(".ai-empty")) {
        box.replaceChildren(App.buildEmptyNode(App.T("ai.emptyNoModel")));
      }
      App.state.renderedModelId = null;
      App.state.renderedMsgCount = 0;
      App.updateStatsBar();
      return;
    }
    if (App.state.renderedModelId !== model) {
      App.state.renderedModelId = model;
      App.state.renderedMsgCount = 0;
      box.replaceChildren();
    }
    var chat = App.aiState.chats[model] || [];
    if (!chat.length) {
      if (!box.firstChild || !box.querySelector(".ai-empty")) {
        box.replaceChildren(
          App.buildEmptyNode(
            App.T("ai.emptyStart", { model: App.aiModelName(model) }),
          ),
        );
      }
      App.state.renderedMsgCount = 0;
      App.updateStatsBar();
      return;
    }
    if (App.state.renderedMsgCount > chat.length)
      App.state.renderedMsgCount = 0;
    if (App.state.renderedMsgCount === 0) {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < chat.length; i++) {
        frag.appendChild(App.buildMsgNode(chat[i], i));
      }
      box.replaceChildren(frag);
      App.state.renderedMsgCount = chat.length;
      box.scrollTop = box.scrollHeight;
      App.updateStatsBar();
      return;
    }
    if (App.state.renderedMsgCount < chat.length) {
      var emptyEl = box.querySelector(".ai-empty");
      if (emptyEl && box.children.length === 1) {
        box.replaceChildren();
        App.state.renderedMsgCount = 0;
        var frag2 = document.createDocumentFragment();
        for (var k = 0; k < chat.length; k++) {
          frag2.appendChild(App.buildMsgNode(chat[k], k));
        }
        box.replaceChildren(frag2);
        App.state.renderedMsgCount = chat.length;
        box.scrollTop = box.scrollHeight;
        App.updateStatsBar();
        return;
      }
      for (var j = App.state.renderedMsgCount; j < chat.length; j++) {
        box.appendChild(App.buildMsgNode(chat[j], j));
      }
      App.state.renderedMsgCount = chat.length;
      box.scrollTop = box.scrollHeight;
    }
    App.updateStatsBar();
  };
  App.updateStatsBar = function () {
    var bar = App.$("#aiStats");
    if (!bar) return;
    var model = App.aiState.currentModel;
    if (!model) {
      bar.style.display = "none";
      return;
    }
    var chat = App.aiState.chats[model] || [];
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
    bar.textContent = App.T("ai.stats", {
      turns: turns,
      total: total.toLocaleString(),
    });
  };
  App.updateAISendBtn = function () {
    var btn = App.$("#aiSendBtn");
    if (!btn) return;
    btn.disabled = !!App.aiState.busy;
  };
  App.getLastAssistantBubble = function () {
    var box = App.$("#aiMessages");
    if (!box) return null;
    var kids = box.children;
    for (var i = kids.length - 1; i >= 0; i--) {
      if (kids[i].classList.contains("assistant")) {
        return kids[i].querySelector(".assistant-body");
      }
    }
    return null;
  };
  App.isNearBottom = function (box) {
    if (!box) return true;
    return (
      box.scrollHeight - box.scrollTop - box.clientHeight <
      App.NEAR_BOTTOM_PX
    );
  };

  App.deleteMessageFrom = function (index) {
    var model = App.aiState.currentModel;
    if (!model) return;
    var chat = App.aiState.chats[model] || [];
    if (index < 0 || index >= chat.length) return;
    var after = chat.length - index - 1;
    var msgText =
      after > 0
        ? App.T("msg.deleteConfirmBody", { n: after })
        : App.T("msg.deleteConfirmBodyShort");
    App.showConfirm(
      App.T("msg.deleteConfirmTitle"),
      msgText,
      function () {
        chat.splice(index);
        App.saveAIChats(model);
        App.state.renderedMsgCount = 0;
        App.renderAIMessages();
      },
      true,
    );
  };
  App.regenerateMessage = function (index) {
    var model = App.aiState.currentModel;
    if (!model) return;
    var chat = App.aiState.chats[model] || [];
    if (index < 1) return;
    var userMsg = chat[index - 1];
    if (!userMsg || userMsg.role !== "user") return;
    chat.splice(index);
    App.saveAIChats(model);
    App.state.renderedMsgCount = 0;
    App.renderAIMessages();
    var text = userMsg.content || "";
    if (!text.trim()) return;
    App.aiSendWithText(text);
  };
  App.aiSendWithText = function (text) {
    var model = App.aiState.currentModel;
    if (!model) return;
    var key = App.aiState.keys[model];
    if (!key) {
      App.promptAPIKey(model, function () {
        if (App.aiState.keys[model]) App.aiSendWithText(text);
      });
      return;
    }
    var chat = App.aiState.chats[model];
    if (!Array.isArray(chat)) chat = App.aiState.chats[model] = [];
    var lastMsg = chat[chat.length - 1];
    if (!(lastMsg && lastMsg.role === "user" && lastMsg.content === text)) {
      chat.push({ role: "user", content: text });
    }
    chat.push({ role: "assistant", content: "" });
    App.saveAIChats(model);
    if (App.aiState.abortController) {
      try {
        App.aiState.abortController.abort();
      } catch (e) {}
    }
    App.aiState.streamToken += 1;
    var myToken = App.aiState.streamToken;
    App.aiState.abortController = new AbortController();
    App.aiState.busy = true;
    App.updateAISendBtn();
    App.renderAIMessages();
    var bubble = App.getLastAssistantBubble();
    var accumulated = "";
    var firstDelta = true;
    var conf = App.aiModelConf(model);
    var isGemini = conf && conf.protocol === "gemini";
    var box = App.$("#aiMessages");
    var acc = App.createStructuredAccumulator();
    function pushDelta(t2) {
      if (App.aiState.streamToken !== myToken) return;
      if (!t2) return;
      if (firstDelta && bubble) {
        bubble.textContent = "";
        bubble.classList.remove("pending");
        firstDelta = false;
      }
      accumulated += t2;
      if (bubble) bubble.appendChild(document.createTextNode(t2));
      if (box && App.isNearBottom(box)) box.scrollTop = box.scrollHeight;
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
    if (payload.length > App.settings.MAX_CONTEXT_MESSAGES) {
      payload = payload.slice(-App.settings.MAX_CONTEXT_MESSAGES);
      while (payload.length && payload[0].role !== "user") {
        payload.shift();
      }
    }
    var systemPrompt = App.aiState.prompts[model] || "";
    App.streamAI({
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
        if (App.aiState.streamToken !== myToken) return;
        var meta = acc.finalize();
        var msg = chat[chat.length - 1];
        msg.content = accumulated || App.T("ai.emptyReply");
        if (meta.id) msg.id = meta.id;
        if (meta.model) msg.model = meta.model;
        if (meta.created) msg.created = meta.created;
        if (meta.finish_reason) msg.finish_reason = meta.finish_reason;
        if (meta.usage) msg.usage = meta.usage;
        if (meta.tool_calls) msg.tool_calls = meta.tool_calls;
        App.saveAIChats(model);
        App.aiState.busy = false;
        App.updateAISendBtn();
        App.renderAIMessages();
      })
      .catch(function (err) {
        if (App.aiState.streamToken !== myToken) return;
        App.aiState.busy = false;
        App.updateAISendBtn();
        var meta = acc.finalize();
        var isTimeout = err && err.name === "TimeoutError";
        var isAbort =
          err && (err.name === "AbortError" || err.code === 20);
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
        App.saveAIChats(model);
        App.renderAIMessages();
        if (isTimeout) {
          App.showAlert(
            App.T("chat.errTimeoutTitle"),
            App.T("chat.errTimeoutBody"),
            true,
          );
        } else if (!isAbort) {
          App.showAlert(
            App.T("chat.errRequestTitle"),
            String((err && err.message) || err) ||
              App.T("chat.errRequestBody"),
            true,
          );
        }
      });
  };

  App.showModelEditor = function (modelId) {
    var isEdit = !!modelId;
    var existing = isEdit ? App.aiModelConf(modelId) : null;
    if (isEdit && (!existing || existing.builtin)) return;
    App.openModal(function (box) {
      box.appendChild(
        App.el(
          "h3",
          null,
          isEdit ? App.T("ai.editModelTitle") : App.T("model.addTitle"),
        ),
      );
      box.appendChild(
        App.el(
          "div",
          "modal-hint",
          App.T("model.hint", { endpoint: "{endpoint}" }),
        ),
      );
      var l1 = App.el("label", null, App.T("model.labelName"));
      l1.style.cssText =
        "display:block;font-weight:bold;font-size:0.9rem;margin:8px 0 4px;";
      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = App.T("model.placeholderName");
      nameInput.value = isEdit ? existing.name : "";
      nameInput.autocomplete = "off";
      nameInput.spellcheck = false;
      var l2 = App.el("label", null, App.T("model.labelEndpoint"));
      l2.style.cssText = l1.style.cssText;
      var epInput = document.createElement("input");
      epInput.type = "text";
      epInput.placeholder = App.T("model.placeholderEndpoint");
      epInput.value = isEdit ? existing.endpoint : "";
      epInput.autocomplete = "off";
      epInput.spellcheck = false;
      var l3 = App.el("label", null, App.T("model.labelApiModel"));
      l3.style.cssText = l1.style.cssText;
      var apiInput = document.createElement("input");
      apiInput.type = "text";
      apiInput.placeholder = App.T("model.placeholderApiModel");
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
      toolsRow.appendChild(document.createTextNode(App.T("model.labelTools")));
      var visionRow = document.createElement("label");
      visionRow.style.cssText = toolsRow.style.cssText;
      var visionCb = document.createElement("input");
      visionCb.type = "checkbox";
      visionCb.style.cssText = "width:auto;margin:0;";
      visionCb.checked = isEdit ? !!existing.vision : false;
      visionRow.appendChild(visionCb);
      visionRow.appendChild(
        document.createTextNode(App.T("model.labelVision")),
      );
      var actions = App.el("div", "modal-actions");
      var leftWrap = document.createElement("div");
      if (isEdit) {
        var delBtn = App.el("button", "link-btn", App.T("model.deleteBtn"));
        delBtn.type = "button";
        delBtn.addEventListener("click", function () {
          App.closeModal();
          App.deleteCustomModel(modelId);
        });
        leftWrap.appendChild(delBtn);
      }
      var rg = App.rightGroup();
      var cancel = App.el("button", "cancel", App.T("common.cancel"));
      cancel.addEventListener("click", App.closeModal);
      var ok = App.el(
        "button",
        null,
        isEdit ? App.T("common.save") : App.T("common.ok"),
      );
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
          App.showAlert(
            App.T("model.errFormat"),
            App.T("model.errFormatBody"),
            true,
          );
          return;
        }
        if (!apiModel) {
          apiInput.focus();
          return;
        }
        var supportsTools = !!toolsCb.checked;
        var vision = !!visionCb.checked;
        if (isEdit) {
          existing.name = name;
          existing.endpoint = ep;
          existing.apiModel = apiModel;
          existing.supportsTools = supportsTools;
          existing.vision = vision;
          App.saveCustomModels();
          App.closeModal();
          App.buildAIModelMenu();
          App.refreshAIModelUI();
          App.showAlert(
            App.T("model.editOk"),
            App.T("model.editOkBody", { name: name }),
          );
        } else {
          var newId = "custom_" + Date.now();
          App.aiState.customModels.push({
            id: newId,
            name: name,
            endpoint: ep,
            apiModel: apiModel,
            protocol: "openai",
            builtin: false,
            supportsTools: supportsTools,
            vision: vision,
          });
          App.aiState.chats[newId] = [];
          App.aiState.prompts[newId] = "";
          App.saveCustomModels();
          App.saveAIPrompts();
          App.closeModal();
          App.buildAIModelMenu();
          App.refreshAIModelUI();
          App.showAlert(
            App.T("model.addOk"),
            App.T("model.addOkBody", { name: name }),
          );
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
      box.appendChild(visionRow);
      box.appendChild(actions);
    });
  };
  App.deleteCustomModel = function (modelId) {
    var conf = App.aiModelConf(modelId);
    if (!conf || conf.builtin) return;
    App.showConfirm(
      App.T("model.deleteConfirmTitle"),
      App.T("model.deleteConfirmBody", { name: conf.name }),
      function () {
        delete App.aiState.keys[modelId];
        delete App.aiState.chats[modelId];
        delete App.aiState.prompts[modelId];
        App.saveAIKeys();
        App.saveAIPrompts();
        App.storageRemove(App.AI_CHAT_STORAGE + "_" + modelId);
        App.aiState.customModels = App.aiState.customModels.filter(
          function (m) {
            return m.id !== modelId;
          },
        );
        App.saveCustomModels();
        if (App.aiState.currentModel === modelId) {
          App.aiState.currentModel = null;
          App.saveCurrentModel(null);
          App.state.renderedModelId = null;
          App.state.renderedMsgCount = 0;
        }
        App.buildAIModelMenu();
        App.refreshAIModelUI();
        App.renderAIMessages();
        App.updateAISendBtn();
        App.showAlert(
          App.T("model.deleteOk"),
          App.T("model.deleteOkBody", { name: conf.name }),
        );
      },
      true,
    );
  };
  App.testAIModelConnection = function (model) {
    var conf = App.aiModelConf(model);
    if (!conf) return;
    var key = App.aiState.keys[model];
    if (!key) {
      App.showAlert(
        App.T("test.noKeyTitle"),
        App.T("test.noKeyBody", { model: App.aiModelName(model) }),
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
    App.showAlert(
      App.T("test.title"),
      App.T("test.body", { model: App.aiModelName(model) }),
    );
    var testAbort = new AbortController();
    var timeoutId = setTimeout(function () {
      try {
        testAbort.abort();
      } catch (e) {}
    }, App.TEST_TIMEOUT_MS);
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
            App.showAlert(
              App.T("test.okTitle"),
              App.T("test.okBody", { model: App.aiModelName(model) }),
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
            App.showAlert(App.T("test.failTitle"), msg, true);
          }
        });
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        var msg = String((err && err.message) || err);
        if (err && err.name === "AbortError") msg = App.T("test.timeout");
        App.showAlert(App.T("test.failTitle"), msg, true);
      });
  };
  App.promptAPIKey = function (model, onSaved) {
    var hasKey = !!App.aiState.keys[model];
    App.showPrompt(
      App.T("ai.setKeyTitle", { model: App.aiModelName(model) }),
      App.aiState.keys[model] || "",
      function (v) {
        App.aiState.keys[model] = v;
        App.saveAIKeys();
        if (onSaved) onSaved();
      },
      "password",
      App.T("ai.keySecurityHint"),
      hasKey
        ? {
            clearText: App.T("ai.clearKey"),
            onClear: function () {
              delete App.aiState.keys[model];
              App.saveAIKeys();
            },
          }
        : null,
    );
  };
  App.promptSystemPrompt = function (model) {
    var existing = App.aiState.prompts[model] || "";
    App.showPromptArea({
      title: App.T("ai.setPromptTitle", { model: App.aiModelName(model) }),
      hint: App.T("ai.setPromptHint"),
      value: existing,
      placeholder: App.T("ai.setPromptPlaceholder"),
      onOk: function (v) {
        App.aiState.prompts[model] = v.trim();
        App.saveAIPrompts();
        App.buildAIModelMenu();
        App.refreshAIModelUI();
      },
      onClear: function () {
        App.aiState.prompts[model] = "";
        App.saveAIPrompts();
        App.buildAIModelMenu();
        App.refreshAIModelUI();
      },
    });
  };
  App.selectAIModel = function (model) {
    if (!App.aiModelConf(model)) return;
    if (App.aiState.busy) {
      if (App.aiState.abortController) {
        try {
          App.aiState.abortController.abort();
        } catch (e) {}
      }
      App.aiState.streamToken += 1;
      App.aiState.busy = false;
      App.updateAISendBtn();
    }
    if (!App.aiState.keys[model]) {
      App.promptAPIKey(model, function () {
        App.aiState.currentModel = model;
        App.saveCurrentModel(model);
        App.refreshAIModelUI();
        App.renderAIMessages();
        App.updateAISendBtn();
      });
      return;
    }
    App.aiState.currentModel = model;
    App.saveCurrentModel(model);
    App.refreshAIModelUI();
    App.renderAIMessages();
    App.updateAISendBtn();
  };

  App.triggerDownload = function (content, mime, filename) {
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
  };
  App.downloadAIChatMd = function (model) {
    var chat = App.aiState.chats[model] || [];
    if (!chat.length) {
      App.showAlert(
        App.T("chat.errNoDownloadTitle"),
        App.T("chat.errNoDownloadBody", { model: App.aiModelName(model) }),
      );
      return;
    }
    var lines = ["# " + App.aiModelName(model), ""];
    var sys = App.aiState.prompts[model];
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
    App.triggerDownload(
      lines.join("\n"),
      "text/markdown;charset=utf-8",
      "ai_chat_" + model + "_" + Date.now() + ".md",
    );
  };
  App.downloadAIChatJson = function (model) {
    var chat = App.aiState.chats[model] || [];
    if (!chat.length) {
      App.showAlert(
        App.T("chat.errNoDownloadTitle"),
        App.T("chat.errNoDownloadBody", { model: App.aiModelName(model) }),
      );
      return;
    }
    var sys = App.aiState.prompts[model];
    var data = {
      schemaVersion: 1,
      model: model,
      modelName: App.aiModelName(model),
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
    App.triggerDownload(
      JSON.stringify(data, null, 2),
      "application/json;charset=utf-8",
      "ai_chat_" + model + "_" + Date.now() + ".json",
    );
  };
  App.importAIChatFromFile = function (file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var data;
      try {
        data = JSON.parse(e.target.result);
      } catch (err) {
        App.showAlert(App.T("import.failTitle"), App.T("import.badJson"), true);
        return;
      }
      if (!data || !Array.isArray(data.messages)) {
        App.showAlert(
          App.T("import.failTitle"),
          App.T("import.badShape"),
          true,
        );
        return;
      }
      var targetModel = data.model;
      if (!targetModel || !App.aiModelConf(targetModel)) {
        var name = String(data.modelName || "").toLowerCase();
        var allModels = App.getAllModels();
        for (var i = 0; i < allModels.length; i++) {
          if (allModels[i].name.toLowerCase() === name) {
            targetModel = allModels[i].id;
            break;
          }
        }
      }
      if (!targetModel || !App.aiModelConf(targetModel)) {
        App.showAlert(
          App.T("import.failTitle"),
          App.T("import.unknownModel", { model: data.model || "?" }),
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
          if (m.tool_calls && m.tool_calls.length)
            out.tool_calls = m.tool_calls;
          return out;
        });
      if (!cleaned.length) {
        App.showAlert(
          App.T("import.failTitle"),
          App.T("import.noMessages"),
          true,
        );
        return;
      }
      var applyImport = function (mode) {
        var existing = App.aiState.chats[targetModel] || [];
        if (mode === "replace") App.aiState.chats[targetModel] = cleaned;
        else App.aiState.chats[targetModel] = existing.concat(cleaned);
        if (
          data.systemPrompt &&
          String(data.systemPrompt).trim() &&
          !(App.aiState.prompts[targetModel] || "").trim()
        ) {
          App.aiState.prompts[targetModel] = String(
            data.systemPrompt,
          ).trim();
          App.saveAIPrompts();
        }
        App.saveAIChats(targetModel);
        if (App.aiState.currentModel === targetModel) {
          App.state.renderedMsgCount = 0;
          App.renderAIMessages();
          App.showAlert(
            App.T("import.okTitle"),
            App.T("import.okBody", {
              n: cleaned.length,
              model: App.aiModelName(targetModel),
            }),
          );
        } else {
          App.showConfirm(
            App.T("import.okTitle"),
            App.T("import.askSwitch", {
              n: cleaned.length,
              model: App.aiModelName(targetModel),
            }),
            function () {
              App.selectAIModel(targetModel);
            },
          );
        }
      };
      var existing = App.aiState.chats[targetModel] || [];
      if (!existing.length) {
        applyImport("replace");
        return;
      }
      App.openModal(function (box) {
        box.appendChild(App.el("h3", null, App.T("import.conflictTitle")));
        box.appendChild(
          App.el(
            "p",
            null,
            App.T("import.conflictBody", {
              model: App.aiModelName(targetModel),
              existing: existing.length,
              incoming: cleaned.length,
            }),
          ),
        );
        var actions = App.el("div", "modal-actions");
        var leftWrap = document.createElement("div");
        var cancelBtn = App.el("button", "link-btn", App.T("common.cancel"));
        cancelBtn.addEventListener("click", App.closeModal);
        leftWrap.appendChild(cancelBtn);
        var rg = App.rightGroup();
        var appendBtn = App.el("button", "cancel", App.T("common.append"));
        appendBtn.addEventListener("click", function () {
          App.closeModal();
          applyImport("append");
        });
        var replaceBtn = App.el("button", "danger", App.T("common.replace"));
        replaceBtn.addEventListener("click", function () {
          App.closeModal();
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
      App.showAlert(App.T("import.failTitle"), App.T("import.readFail"), true);
    };
    reader.readAsText(file);
  };

  App.aiSend = function () {
    if (App.aiState.busy) return;
    var model = App.aiState.currentModel;
    if (!model) {
      App.showAlert(
        App.T("chat.errNoModelTitle"),
        App.T("chat.errNoModelBody"),
        true,
      );
      return;
    }
    var inputEl = App.$("#aiInput");
    if (!inputEl) return;
    var text = (inputEl.value || "").trim();
    if (!text) return;
    inputEl.value = "";
    inputEl.style.height = "auto";
    App.aiSendWithText(text);
  };
  App.clearAIChat = function () {
    var model = App.aiState.currentModel;
    if (!model) {
      App.showAlert(
        App.T("chat.errNoClearTitle"),
        App.T("chat.errNoClearNoModel"),
      );
      return;
    }
    var chat = App.aiState.chats[model] || [];
    if (!chat.length) {
      App.showAlert(
        App.T("chat.errNoClearTitle"),
        App.T("chat.errNoClearNoChat", { model: App.aiModelName(model) }),
      );
      return;
    }
    App.showConfirm(
      App.T("chat.clearConfirmTitle"),
      App.T("chat.clearConfirmBody", { model: App.aiModelName(model) }),
      function () {
        if (App.aiState.busy) {
          if (App.aiState.abortController) {
            try {
              App.aiState.abortController.abort();
            } catch (e) {}
          }
          App.aiState.streamToken += 1;
          App.aiState.busy = false;
          App.updateAISendBtn();
        }
        App.aiState.chats[model] = [];
        App.saveAIChats(model);
        App.state.renderedMsgCount = 0;
        App.renderAIMessages();
      },
      true,
    );
  };

  App.bindAIAssistant = function () {
    App.state.renderedModelId = null;
    App.state.renderedMsgCount = 0;
    App.buildAIModelMenu();
    App.refreshAIModelUI();
    App.renderAIMessages();
    App.updateAISendBtn();
    var modelBtn = App.$("#aiModelBtn");
    var modelMenu = App.$("#aiModelMenu");
    var inputEl = App.$("#aiInput");
    var sendBtn = App.$("#aiSendBtn");
    var clearBtn = App.$("#aiClearBtn");
    if (modelBtn) {
      modelBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        App.toggleAIModelMenu();
      });
    }
    if (modelMenu) {
      modelMenu.addEventListener("click", function (e) {
        var importItem = e.target.closest("[data-import]");
        if (importItem) {
          e.stopPropagation();
          App.closeAIModelMenu();
          var importFile = App.$("#aiImportFile");
          if (importFile) {
            importFile.value = "";
            importFile.click();
          }
          return;
        }
        var addBtn = e.target.closest("[data-add]");
        if (addBtn) {
          e.stopPropagation();
          App.closeAIModelMenu();
          App.showModelEditor();
          return;
        }
        var editBtn = e.target.closest("[data-edit]");
        if (editBtn) {
          e.stopPropagation();
          e.preventDefault();
          App.closeAIModelMenu();
          App.showModelEditor(editBtn.dataset.edit);
          return;
        }
        var promptBtn = e.target.closest("[data-prompt]");
        if (promptBtn) {
          e.stopPropagation();
          App.closeAIModelMenu();
          App.promptSystemPrompt(promptBtn.dataset.prompt);
          return;
        }
        var keyBtn = e.target.closest("[data-key]");
        if (keyBtn) {
          e.stopPropagation();
          App.closeAIModelMenu();
          App.promptAPIKey(keyBtn.dataset.key);
          return;
        }
        var testBtn = e.target.closest("[data-test]");
        if (testBtn) {
          e.stopPropagation();
          App.closeAIModelMenu();
          App.testAIModelConnection(testBtn.dataset.test);
          return;
        }
        var mdBtn = e.target.closest("[data-md]");
        if (mdBtn) {
          e.stopPropagation();
          App.closeAIModelMenu();
          App.downloadAIChatMd(mdBtn.dataset.md);
          return;
        }
        var jsonBtn = e.target.closest("[data-json]");
        if (jsonBtn) {
          e.stopPropagation();
          App.closeAIModelMenu();
          App.downloadAIChatJson(jsonBtn.dataset.json);
          return;
        }
        var item = e.target.closest(".ai-model-item");
        if (item) {
          e.stopPropagation();
          App.closeAIModelMenu();
          App.selectAIModel(item.dataset.model);
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
          App.aiSend();
        }
      });
    }
    if (sendBtn) {
      sendBtn.addEventListener("click", function () {
        App.aiSend();
      });
    }
    var importFile = App.$("#aiImportFile");
    if (importFile) {
      importFile.addEventListener("change", function () {
        var f = this.files && this.files[0];
        if (!f) return;
        App.importAIChatFromFile(f);
        this.value = "";
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        App.clearAIChat();
      });
    }
  };

})(window.App);