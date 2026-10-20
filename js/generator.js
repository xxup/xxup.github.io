(function (App) {
  "use strict";
  App.generatePageHtml = function (title, script, imageDataUrl, hasImage) {
    var safeTitle = App.escapeHtml(
      (title || App.T("generator.untitledPage")).slice(
        0,
        App.settings.MAX_TITLE_LEN,
      ),
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
    var safeImgVar = App.escapeScriptClose(imgVar);
    var safeScript = App.escapeScriptClose(script);

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
      App.P5_CDN +
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
      "  \x3Cscript>\n" +
      "</body>\n" +
      "</html>"
    ).replace("</body>", "  \x3C/script>\n</body>");
  };
  App.injectSessionImage = function (html, dataUrl) {
    if (!html || !dataUrl) return html;
    var escaped = String(dataUrl)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
    return html.replace(
      /var imageUrl = (?:null|"[^"]*");/,
      'var imageUrl = "' + escaped + '";',
    );
  };
  App.downloadSingleHtml = function (filename, html) {
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
        App.showAlert(
          App.T("page.downloadFailTitle"),
          String((err2 && err2.message) || err2),
          true,
        );
      }
    }
  };
  App.exportZip = function () {
    var pages = App.getPages();
    if (!pages.length) {
      App.showAlert(
        App.T("page.exportEmptyTitle"),
        App.T("page.exportEmptyBody"),
      );
      return;
    }
    var zip = new JSZip();
    pages.forEach(function (page, idx) {
      var base = App.safeFileName(page.title);
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

  App.renderGenerator = function () {
    var wrap = App.el("div", "generator-page");
    var menubar = App.el("div", "generator-menubar");
    var menubarTitle = App.el(
      "div",
      "generator-menubar-title",
      App.T("generator.title"),
    );
    menubar.appendChild(menubarTitle);
    var helpBtn = App.el("button", "generator-menubar-help", "ⓘ");
    helpBtn.id = "generatorHelpBtn";
    helpBtn.type = "button";
    helpBtn.title = App.T("generator.helpTitle");
    helpBtn.addEventListener("click", function () {
      App.showAlert(App.T("generator.title"), App.T("generator.subtitle"));
    });
    menubar.appendChild(helpBtn);
    wrap.appendChild(menubar);
    var editorWrap = App.el("div", "generator-editor-wrap");
    var g2 = App.el("div", "form-group generator-form-group");
    var ta = document.createElement("textarea");
    ta.id = "script";
    g2.appendChild(ta);
    editorWrap.appendChild(g2);
    wrap.appendChild(editorWrap);
    wrap.appendChild(App.buildGeneratorAIPanel());
    var g3 = App.el("div", "form-group");
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "image";
    fileInput.accept = "image/*";
    var l3 = App.el("label", "image-label-below");
    l3.textContent = App.T("generator.labelImage");
    var previewBox = App.el("div");
    previewBox.id = "image-preview";
    g3.appendChild(fileInput);
    g3.appendChild(l3);
    g3.appendChild(previewBox);
    wrap.appendChild(g3);
    var row = App.el("div", "gen-inline-row");
    var titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.id = "title";
    titleInput.placeholder = App.T("generator.titlePlaceholder");
    titleInput.maxLength = App.settings.MAX_TITLE_LEN;
    var submit = App.el("button", null, App.T("generator.submit"));
    submit.id = "buildBtn";
    submit.type = "button";
    row.appendChild(titleInput);
    row.appendChild(submit);
    wrap.appendChild(row);
    var result = App.el("div", "result");
    result.id = "result";
    result.style.display = "none";
    wrap.appendChild(result);
    return wrap;
  };
  App.buildGeneratorAIPanel = function () {
    var frag = document.createDocumentFragment();
    var bar = App.el("div", "gen-ai-bar gen-ai-bar-bare");
    var picker = App.el("div", "ai-model-picker");
    var modelBtn = App.el("button", "ai-model-btn", "+");
    modelBtn.id = "genModelBtn";
    modelBtn.type = "button";
    modelBtn.title = App.T("gen.modelPickerTitle");
    var menu = App.el("div", "ai-model-menu");
    menu.id = "genModelMenu";
    picker.appendChild(modelBtn);
    picker.appendChild(menu);
    var input = document.createElement("textarea");
    input.id = "genInput";
    input.rows = 1;
    input.placeholder = App.T("gen.placeholder");
    var sendBtn = App.el("button", "ai-send-btn", "↑");
    sendBtn.id = "genSendBtn";
    sendBtn.type = "button";
    sendBtn.title = App.T("gen.sendTitle");
    bar.appendChild(picker);
    bar.appendChild(input);
    bar.appendChild(sendBtn);
    var status = App.el("div", "gen-status");
    status.id = "genStatus";
    frag.appendChild(status);
    frag.appendChild(bar);
    return frag;
  };

  App.refreshGenModelBtn = function () {
    var btn = App.$("#genModelBtn");
    if (!btn) return;
    var cur = App.aiState.currentModel;
    var conf = cur ? App.aiModelConf(cur) : null;
    if (cur && conf && conf.supportsTools) {
      btn.classList.add("has-model");
      btn.textContent = conf.name.charAt(0);
    } else {
      btn.classList.remove("has-model");
      btn.textContent = "+";
    }
  };
  App.buildGenModelMenu = function () {
    var menu = App.$("#genModelMenu");
    if (!menu) return;
    var frag = document.createDocumentFragment();
    var models = App.getToolModels();
    if (!models.length) {
      var empty = App.el("div", "ai-model-item");
      empty.style.cursor = "default";
      empty.style.color = "var(--text-muted)";
      empty.textContent = App.T("gen.menuNoToolsModels");
      frag.appendChild(empty);
      menu.replaceChildren(frag);
      return;
    }
    models.forEach(function (m) {
      var item = App.el("div", "ai-model-item");
      if (App.aiState.currentModel === m.id) item.classList.add("active");
      item.dataset.model = m.id;
      item.appendChild(App.el("span", "ai-check", "✓"));
      item.appendChild(App.el("span", "ai-model-name-text", m.name));
      frag.appendChild(item);
    });
    menu.replaceChildren(frag);
  };
  App.closeGenMenu = function () {
    var menu = App.$("#genModelMenu");
    if (menu) menu.classList.remove("show");
    App.genState.menuOpen = false;
  };
  App.toggleGenMenu = function () {
    var menu = App.$("#genModelMenu");
    if (!menu) return;
    var willShow = !menu.classList.contains("show");
    menu.classList.toggle("show");
    App.genState.menuOpen = willShow;
    if (willShow) App.buildGenModelMenu();
  };

  App.genApplyCode = function (code, intent) {
    var editor = App.state.editor;
    if (!editor || !code) return;
    if (intent === "append") {
      var cur = editor.getValue() || "";
      editor.setValue(cur.trim() ? cur + "\n\n" + code : code);
    } else {
      editor.setValue(code);
    }
    App.state.generatorDraft.script = editor.getValue();
    App.saveDraft();
  };
  App.userTextHasCode = function (text) {
    if (!text) return false;
    if (/```/.test(text)) return true;
    if (/function\s+setup\s*\(/.test(text)) return true;
    if (/function\s+draw\s*\(/.test(text)) return true;
    return false;
  };
  App.genRunLoop = function (userIntent, userText) {
    var model = App.aiState.currentModel;
    var key = App.aiState.keys[model];
    var conf = App.aiModelConf(model);
    if (!conf || !conf.supportsTools) {
      App.genStatusLine(App.T("gen.statusModelNoTools"), "error");
      App.genSetBusy(false);
      return;
    }
    App.genState.messages = [];
    App.genState.messages.push({
      role: "system",
      content: App.T("gen.systemPrompt"),
    });
    var userContent = "[intent: " + userIntent + "]\n";
    if (App.state.uploadedImageDataUrl) {
      var info = App.state.uploadedImageInfo;
      var w = info && info.width ? info.width : "?";
      var h = info && info.height ? info.height : "?";
      userContent += "[图片已上传 | 尺寸: " + w + "×" + h + "]\n";
    }
    if (
      userIntent === "modify" &&
      App.state.editor &&
      !App.userTextHasCode(userText)
    ) {
      var currentCode = App.state.editor.getValue() || "";
      if (currentCode.trim()) {
        userContent += "\n当前代码：\n```js\n" + currentCode + "\n```\n";
      }
    }
    userContent += "\n用户要求：" + userText;
    var useVision =
      !!App.state.uploadedImageDataUrl && conf.vision === true;
    if (useVision) {
      App.genState.messages.push({
        role: "user",
        content: [
          { type: "text", text: userContent },
          {
            type: "image_url",
            image_url: { url: App.state.uploadedImageDataUrl },
          },
        ],
      });
    } else {
      App.genState.messages.push({ role: "user", content: userContent });
    }

    App.genStatusClear();
    App.genStatusLine(
      App.T("gen.statusRequest", { model: App.aiModelName(model) }),
    );
    App.genState.streamToken += 1;
    var myToken = App.genState.streamToken;
    if (App.genState.abortController) {
      try {
        App.genState.abortController.abort();
      } catch (e) {}
    }
    App.genState.abortController = new AbortController();
    var mySignal = App.genState.abortController.signal;
    var loopCount = 0;
    function runOne() {
      loopCount += 1;
      if (loopCount > App.settings.MAX_TOOL_LOOP) {
        App.genStatusLine(App.T("gen.statusMaxLoop"), "warn");
        App.genSetBusy(false);
        return;
      }
      var accumulated = "";
      var acc = App.createStructuredAccumulator();
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
      App.streamAI({
        model: model,
        key: key,
        messages: App.genState.messages.slice(),
        systemPrompt: null,
        onDelta: onDelta,
        onRaw: function (obj) {
          acc.consume(obj);
        },
        tools: true,
        signal: mySignal,
      })
        .then(function () {
          if (App.genState.streamToken !== myToken) return;
          var meta = acc.finalize();
          if (meta.tool_calls && meta.tool_calls.length) {
            App.genState.messages.push({
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
              App.genStatusLine(App.T("gen.statusToolCall", { name: name }));
              var res = App.executeToolCall(name, args);
              var display = res.displayText ? res.displayText : res.text;
              App.genStatusLine(
                App.T("gen.statusToolDone", { result: display }),
                res.ok ? "ok" : "error",
              );
              App.genState.messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: res.text,
              });
            });
            App.genStatusLine(App.T("gen.statusSummary"));
            runOne();
            return;
          }
          if (accumulated && accumulated.trim()) {
            var code = App.extractCodeFromText(accumulated);
            if (code) {
              App.genStatusLine(App.T("gen.statusDegrade"), "warn");
              App.genApplyCode(code, userIntent);
              App.genStatusLine(App.T("gen.statusDone"), "ok");
            } else {
              App.genStatusLine(accumulated.trim(), "ok");
              App.genStatusLine(App.T("gen.statusNoCode"), "warn");
            }
          } else {
            App.genStatusLine(App.T("gen.statusNoCode"), "warn");
          }
          App.genSetBusy(false);
        })
        .catch(function (err) {
          if (App.genState.streamToken !== myToken) return;
          var msg = String((err && err.message) || err);
          var isTimeout = err && err.name === "TimeoutError";
          var isAbort =
            err && (err.name === "AbortError" || err.code === 20);
          if (isTimeout) {
            App.genStatusLine(App.T("gen.statusTimeout"), "error");
            App.genSetBusy(false);
            return;
          }
          if (isAbort) {
            App.genSetBusy(false);
            return;
          }
          App.genStatusLine(
            App.T("gen.statusError", { msg: msg }),
            "error",
          );
          App.genSetBusy(false);
        });
    }
    runOne();
  };
  App.genSend = function () {
    if (App.genState.busy) return;
    var model = App.aiState.currentModel;
    if (!model || !App.aiModelConf(model)) {
      App.showAlert(App.T("gen.statusNoModel"), "", true);
      return;
    }
    var conf = App.aiModelConf(model);
    if (!conf.supportsTools) {
      App.showAlert(App.T("gen.statusModelNoTools"), "", true);
      return;
    }
    var key = App.aiState.keys[model];
    if (!key) {
      App.promptAPIKey(model, function () {
        if (App.aiState.keys[model]) App.genSend();
      });
      return;
    }
    var input = App.$("#genInput");
    if (!input) return;
    var userText = (input.value || "").trim();
    if (!userText) {
      App.genStatusClear();
      App.genStatusLine(App.T("gen.statusEmptyInput"), "warn");
      return;
    }
    var currentCode = App.state.editor
      ? App.state.editor.getValue() || ""
      : "";
    var hasContent = currentCode.trim().length > 0;
    var doSend = function (intent) {
      input.value = "";
      input.style.height = "auto";
      App.genSetBusy(true);
      App.genRunLoop(intent, userText);
    };
    if (!hasContent) {
      if (App.userTextHasCode(userText)) {
        doSend("modify");
      } else {
        doSend("overwrite");
      }
    } else {
      App.showIntentChoice(
        App.T("gen.editorNotEmptyTitle"),
        App.T("gen.editorNotEmptyBody"),
        function () {
          doSend("overwrite");
        },
        function () {
          doSend("modify");
        },
      );
    }
  };
  App.bindGeneratorAIPanel = function () {
    var modelBtn = App.$("#genModelBtn");
    var menu = App.$("#genModelMenu");
    var input = App.$("#genInput");
    var sendBtn = App.$("#genSendBtn");
    if (modelBtn) {
      modelBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        App.toggleGenMenu();
      });
    }
    if (menu) {
      menu.addEventListener("click", function (e) {
        var item = e.target.closest(".ai-model-item");
        if (!item || !item.dataset.model) return;
        e.stopPropagation();
        App.closeGenMenu();
        App.aiState.currentModel = item.dataset.model;
        App.saveCurrentModel(App.aiState.currentModel);
        App.refreshGenModelBtn();
        App.refreshAIModelUI();
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
          App.genSend();
        }
      });
    }
    if (sendBtn) {
      sendBtn.addEventListener("click", function () {
        App.genSend();
      });
    }
    App.refreshGenModelBtn();
  };
  App.compressImage = function (dataUrl, maxDim, quality, callback) {
    var img = new Image();
    img.onload = function () {
      try {
        var w0 = img.naturalWidth;
        var h0 = img.naturalHeight;
        var scale = Math.min(1, maxDim / Math.max(w0, h0));
        var w = Math.max(1, Math.round(w0 * scale));
        var h = Math.max(1, Math.round(h0 * scale));
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        var out = canvas.toDataURL("image/jpeg", quality);
        callback(out && out.length < dataUrl.length ? out : dataUrl);
      } catch (e) {
        callback(dataUrl);
      }
    };
    img.onerror = function () {
      callback(dataUrl);
    };
    img.src = dataUrl;
  };
  App.bindGenerator = function () {
    var titleInput = App.$("#title");
    var textarea = App.$("#script");
    var fileInput = App.$("#image");
    var previewEl = App.$("#image-preview");
    var buildBtn = App.$("#buildBtn");
    App.state.uploadedImageDataUrl = null;
    App.state.uploadedImageInfo = null;
    App.state.generatorDraft = App.loadDraft();
    titleInput.value = App.state.generatorDraft.title || "";
    App.destroyEditor();
    if (window.CodeMirror) {
      var themeName =
        App.currentTheme() === "dark" ? "dracula" : "default";
      App.state.editor = window.CodeMirror.fromTextArea(textarea, {
        mode: "javascript",
        lineNumbers: true,
        theme: themeName,
        tabSize: 2,
        indentUnit: 2,
        autofocus: true,
      });
      App.state.editor.setSize(null, "100%");
      if (App.state.generatorDraft.script)
        App.state.editor.setValue(App.state.generatorDraft.script);
      var cmWrapper = App.state.editor.getWrapperElement();
      if (getComputedStyle(cmWrapper).position === "static") {
        cmWrapper.style.position = "relative";
      }
      var cmPlaceholderEl = App.el("div", "cm-placeholder-overlay");
      cmPlaceholderEl.textContent = App.T("generator.scriptPlaceholder");
      cmWrapper.appendChild(cmPlaceholderEl);
      var gutters = cmWrapper.querySelector(".CodeMirror-gutters");
      var leftOffset = gutters ? gutters.offsetWidth + 8 : 44;
      cmPlaceholderEl.style.left = leftOffset + "px";
      function updateCmPlaceholder() {
        cmPlaceholderEl.style.display =
          App.state.editor.getValue().length === 0 ? "block" : "none";
      }
      App.state.editor.on("change", updateCmPlaceholder);
      App.state.editor.on("optionChange", function () {
        var g = cmWrapper.querySelector(".CodeMirror-gutters");
        if (g) cmPlaceholderEl.style.left = g.offsetWidth + 8 + "px";
      });
      updateCmPlaceholder();
      App.state.editor.on("change", function () {
        App.state.generatorDraft.script = App.state.editor.getValue();
        App.saveDraft();
      });
    }
    titleInput.addEventListener("input", function () {
      App.state.generatorDraft.title = this.value;
      App.saveDraft();
    });
    fileInput.addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        App.showAlert(
          App.T("page.badImageTitle"),
          App.T("page.badImageBody"),
          true,
        );
        this.value = "";
        return;
      }
      if (file.size > App.settings.MAX_IMAGE_BYTES) {
        App.showAlert(
          App.T("page.imageTooLargeTitle"),
          App.T("page.imageTooLargeBody"),
          true,
        );
        this.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        var originalDataUrl = e.target.result;
        App.state.uploadedImageDataUrl = null;
        App.state.uploadedImageInfo = null;
        App.compressImage(
          originalDataUrl,
          1024,
          0.85,
          function (compressed) {
            App.state.uploadedImageDataUrl = compressed;
            var tip = App.el("p", null, App.T("generator.imageOk"));
            var img = document.createElement("img");
            img.src = compressed;
            img.className = "preview-img";
            img.alt = App.T("generator.imageAlt");
            previewEl.replaceChildren(tip, img);
            var probe = new Image();
            probe.onload = function () {
              App.state.uploadedImageInfo = {
                width: probe.naturalWidth,
                height: probe.naturalHeight,
              };
            };
            probe.onerror = function () {
              App.state.uploadedImageInfo = null;
            };
            probe.src = compressed;
          },
        );
      };
      reader.onerror = function () {
        App.showAlert(
          App.T("page.imageReadFailTitle"),
          App.T("page.imageReadFailBody"),
          true,
        );
      };
      reader.readAsDataURL(file);
    });
    buildBtn.addEventListener("click", function () {
      var title =
        titleInput.value.trim().slice(0, App.settings.MAX_TITLE_LEN) ||
        App.T("generator.untitled");
      var script = (
        App.state.editor ? App.state.editor.getValue() : textarea.value
      ).trim();
      if (!script) {
        App.showAlert(
          App.T("page.noScriptTitle"),
          App.T("page.noScriptBody"),
          true,
        );
        return;
      }
      var imageDataUrl = App.state.uploadedImageDataUrl || "";
      var htmlContent = App.generatePageHtml(
        title,
        script,
        "",
        !!imageDataUrl,
      );
      var newId = Date.now() + Math.floor(Math.random() * 1000);
      var pages = App.getPages();
      pages.push({
        id: newId,
        title: title,
        html: htmlContent,
        timestamp: new Date().toISOString(),
      });
      if (!App.savePages(pages)) return;
      if (imageDataUrl) {
        App.state.sessionImages[newId] = imageDataUrl;
        var ids = Object.keys(App.state.sessionImages);
        if (ids.length > App.MAX_SESSION_IMAGES) {
          delete App.state.sessionImages[ids[0]];
        }
      }
      App.updateSidebarPages();
      App.openModal(function (box) {
        box.appendChild(App.el("h3", null, App.T("generator.buildOk")));
        var actions = App.el("div", "modal-actions");
        var leftWrap = document.createElement("div");
        var closeBtn = App.el("button", "link-btn", App.T("common.cancel"));
        closeBtn.addEventListener("click", App.closeModal);
        leftWrap.appendChild(closeBtn);
        var rg = App.rightGroup();
        var previewBtn = App.el("button", null, App.T("generator.preview"));
        previewBtn.addEventListener("click", function () {
          App.closeModal();
          App.runPage(newId);
        });
        var downloadBtn = App.el(
          "button",
          "cancel",
          App.T("generator.download"),
        );
        downloadBtn.addEventListener("click", function () {
          App.downloadSingleHtml(
            "p5_" + App.safeFileName(title) + "_" + newId + ".html",
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
      if (App.state.editor) App.state.editor.setValue("");
      App.clearDraft();
      App.state.uploadedImageDataUrl = "";
      App.state.uploadedImageInfo = null;
      previewEl.replaceChildren();
      fileInput.value = "";
    });
    App.bindGeneratorAIPanel();
  };

})(window.App);