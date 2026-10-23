/* 可视化测试诊断*/
(function () {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:99999;" +
    "background:rgba(0,0,0,0.9);color:#0f0;" +
    "font-family:monospace;font-size:12px;line-height:1.4;" +
    "padding:8px;max-height:70vh;overflow:auto;" +
    "white-space:pre-wrap;word-break:break-all;";
  box.textContent = "[BOOT] main.js 开始\n";
  document.body.appendChild(box);

  function log(msg, color) {
    const line = document.createElement("div");
    line.textContent = msg;
    if (color) line.style.color = color;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  window.addEventListener("error", (e) => {
    log(
      "[ERROR] " + e.message + "\n  " + (e.filename || "") + ":" + (e.lineno || ""),
      "#f66",
    );
  });
  window.addEventListener("unhandledrejection", (e) => {
    log("[REJECT] " + ((e.reason && e.reason.message) || e.reason), "#f66");
  });

  const mods =  "/js/script.js";

  (async () => {
    for (const path of mods) {
      try {
        await import(path);
        log("OK   " + path);
      } catch (e) {
        log("FAIL " + path + "\n     " + ((e && e.message) || e), "#f66");
      }
    }
    log("=== 模块加载完毕 ===");
  })();
})();