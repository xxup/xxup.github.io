/* 可视化测试诊断*/
(function () {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:99999;" +
    "background:rgba(0,0,0,0.9);color:#0f0;" +
    "font-family:monospace;font-size:12px;line-height:1.4;" +
    "padding:8px;max-height:70vh;overflow:auto;" +
    "white-space:pre-wrap;word-break:break-all;";
  box.textContent = "[BOOT] 诊断开始\n";
  (document.body || document.documentElement).appendChild(box);

  function log(msg, color) {
    const line = document.createElement("div");
    line.textContent = msg;
    if (color) line.style.color = color;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  window.addEventListener("error", (e) => {
    if (e.target && e.target !== window) {
      log("[RES] 加载失败: " + (e.target.src || e.target.href), "#f66");
      return;
    }
    log(
      "[ERROR] " + (e.message || "Script error.(跨域脱敏)") +
      "\n  " + (e.filename || "") + ":" + (e.lineno || "") + ":" + (e.colno || ""),
      "#f66"
    );
  }, true);

  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    log("[REJECT] " + ((r && r.message) || (typeof r === "string" ? r : JSON.stringify(r))), "#f66");
  });

  const mods = ["/js/script.js?t=" + Date.now()];

  async function run() {
    for (const path of mods) {
      const t0 = performance.now();
      try {
        await import(path);
        log("OK   " + path + "  (" + Math.round(performance.now() - t0) + "ms)");
      } catch (e) {
        log("FAIL " + path + "\n     " + (e && (e.stack || e.message) || e), "#f66");
      }
    }
    log("=== 诊断完毕 ===");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();