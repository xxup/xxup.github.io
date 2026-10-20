(function (App) {
  "use strict";
  App.genStatusClear = function () {
    var box = App.$("#genStatus");
    if (box) box.replaceChildren();
  };
  App.genStatusLine = function (text, kind) {
    var box = App.$("#genStatus");
    if (!box) return;
    box.appendChild(
      App.el("div", "gen-status-line" + (kind ? " " + kind : ""), text),
    );
    while (box.children.length > 12) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  };
  App.genSetBusy = function (busy) {
    App.genState.busy = busy;
    var btn = App.$("#genSendBtn");
    if (btn) btn.disabled = !!busy;
  };
  App.TOOL_HANDLERS = {
    insert_code: function (args) {
      var code = args && typeof args.code === "string" ? args.code : "";
      var editor = App.state.editor;
      if (!editor) throw new Error("editor not found");
      editor.setValue(code);
      App.state.generatorDraft.script = code;
      App.saveDraft();
      return { ok: true, text: App.T("gen.toolInsert", { n: code.length }) };
    },
    append_code: function (args) {
      var code = args && typeof args.code === "string" ? args.code : "";
      var editor = App.state.editor;
      if (!editor) throw new Error("editor not found");
      var cur = editor.getValue() || "";
      var next = cur.trim().length === 0 ? code : cur + "\n\n" + code;
      editor.setValue(next);
      App.state.generatorDraft.script = next;
      App.saveDraft();
      return { ok: true, text: App.T("gen.toolAppend", { n: code.length }) };
    },
    get_current_code: function (args) {
      var editor = App.state.editor;
      if (!editor) throw new Error("editor not found");
      var v = editor.getValue() || "";
      return {
        ok: true,
        text: v.length ? v : "(empty)",
        displayText: App.T("gen.toolRead", { n: v.length }),
      };
    },
    replace_selection: function (args) {
      var editor = App.state.editor;
      if (!editor) throw new Error("editor not found");
      var code = args && typeof args.code === "string" ? args.code : "";
      var sel = editor.getSelection();
      if (!sel) {
        editor.setValue(code);
      } else {
        editor.replaceSelection(code);
      }
      App.state.generatorDraft.script = editor.getValue();
      App.saveDraft();
      return {
        ok: true,
        text: App.T("gen.toolReplace", { n: code.length }),
      };
    },
    get_canvas_size: function (args) {
      var editor = App.state.editor;
      var src = editor ? editor.getValue() || "" : "";
      var cmNum = src.match(/createCanvas\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (cmNum) {
        var w = parseInt(cmNum[1], 10);
        var h = parseInt(cmNum[2], 10);
        return {
          ok: true,
          text: JSON.stringify({ width: w, height: h }),
          displayText: App.T("gen.toolCanvasSize", { w: w, h: h }),
        };
      }
      return {
        ok: true,
        text: JSON.stringify({
          width: "windowWidth",
          height: "windowHeight",
          note: "响应式画布：使用 createCanvas(windowWidth, windowHeight)",
        }),
        displayText: App.T("gen.toolCanvasResponsive"),
      };
    },
    set_color_palette: function (args) {
      var colors = args && Array.isArray(args.colors) ? args.colors : [];
      if (!colors.length) {
        return {
          ok: false,
          text: App.T("gen.toolUnknown", { name: "set_color_palette" }),
        };
      }
      App.genState.palette = colors;
      return {
        ok: true,
        text: "已记录配色：" + colors.join(", "),
        displayText: App.T("gen.toolPalette", { n: colors.length }),
      };
    },
    save_page: function (args) {
      var title =
        args && typeof args.title === "string" && args.title.trim()
          ? args.title.trim()
          : (App.$("#title") ? App.$("#title").value.trim() : "") ||
            App.T("generator.untitled");
      var editor = App.state.editor;
      if (!editor) throw new Error("editor not found");
      var script = editor.getValue().trim();
      if (!script) {
        return { ok: false, text: "编辑器为空，无法保存" };
      }
      var imageDataUrl = App.state.uploadedImageDataUrl || "";
      var html = App.generatePageHtml(title, script, "", !!imageDataUrl);
      var newId = Date.now() + Math.floor(Math.random() * 1000);
      var pages = App.getPages();
      pages.push({
        id: newId,
        title: title,
        html: html,
        timestamp: new Date().toISOString(),
      });
      if (App.savePages(pages)) {
        if (imageDataUrl) {
          App.state.sessionImages[newId] = imageDataUrl;
          var ids = Object.keys(App.state.sessionImages);
          if (ids.length > App.MAX_SESSION_IMAGES) {
            delete App.state.sessionImages[ids[0]];
          }
        }
        App.updateSidebarPages();
        return { ok: true, text: App.T("gen.toolSaved", { title: title }) };
      }
      return { ok: false, text: "保存失败" };
    },
    open_preview: function (args) {
      var editor = App.state.editor;
      if (!editor) throw new Error("editor not found");
      var script = editor.getValue().trim();
      if (!script) return { ok: false, text: "编辑器为空，无法预览" };
      var title =
        (App.$("#title") ? App.$("#title").value.trim() : "") ||
        App.T("generator.untitled");
      var html = App.generatePageHtml(
        title,
        script,
        App.state.uploadedImageDataUrl || "",
      );
      App.state.runner.mode = "temp";
      App.state.runner.tempHtml = html;
      App.state.runner.pageId = null;
      App.destroyEditor();
      if (App.getRoute() === "/") App.render();
      else location.hash = "#/";
      return { ok: true, text: "已打开预览" };
    },
  };
  App.executeToolCall = function (toolName, args) {
    var handler = App.TOOL_HANDLERS[toolName];
    if (!handler) {
      return { ok: false, text: App.T("gen.toolUnknown", { name: toolName }) };
    }
    try {
      return handler(args);
    } catch (e) {
      return {
        ok: false,
        text: App.T("gen.toolError", {
          msg: String((e && e.message) || e),
        }),
      };
    }
  };
  App.extractCodeFromText = function (text) {
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
    if (
      /function\s+setup\s*\(/.test(t) ||
      /function\s+draw\s*\(/.test(t)
    ) {
      return t.trim();
    }
    return null;
  };

})(window.App);