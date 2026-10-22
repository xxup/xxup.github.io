#### randomArt可视化创意编程

---

-randomArt可视化创意编程是一款纯前端工具，所有数据存于本地浏览器，无需后端打开即可离线运行。

-「首页」随机加载并运行p5.js脚本，支持鼠标与触摸交互，侧边栏可查看、搜索、重命名或删除已保存的作品，点击作品名即可运行。

-「编写脚本」提供CodeMirror编辑器，支持语法高亮、行号与草稿自动保留，可上传图片供脚本通过 imageUrl 引用，支持视觉的模型可看图生成像素化、提取配色、调色等处理代码，支持切换p5.js、three.js两种引擎，three.js代码中THREE已自动注入为全局变量，提交后可预览或下载单个HTML，预览时可保存为PNG。

-「编写脚本」内置AI生成面板，选择支持函数调用的模型，用自然语言描述效果，AI通过工具调用把代码写入编辑器，编辑器已有内容时，可选择覆盖或让AI基于现有代码修改，不同引擎使用不同的系统提示词。

-「AI助手」支持ChatGPT、Gemini、DeepSeek流式对话，也可自定义OpenAI兼容模型。每个模型独立配置API Key与系统提示词，支持「测试连接」验证配置。对话记录按模型分别存储，可切换模型独立维护。
-「AI助手」对话可导出为Markdown或JSON（含finish_reason、usage、tool_calls等结构化元数据），也可从JSON文件导入对话继续使用（支持追加或覆盖）

-「设置」可调整参数，切换中文/英文，管理本地存储。界面支持亮色/暗色主题切换，通过PWA可在浏览器中「添加到主屏幕」离线使用。

---

- randomArt Visual Creative Coding is a pure frontend tool. All data is stored locally in the browser — no backend required, works offline.
- The home page randomly loads and runs a p5.js sketch, with mouse and touch interaction. The sidebar lets you view, search, rename, or delete saved works; click a title to run it, and capture a PNG screenshot in preview mode.
- The Script Editor provides a CodeMirror editor with p5.js syntax highlighting, line numbers, and auto-saved drafts; a persistent top menubar keeps the editor full-width. You can upload an image (auto-compressed to max 1024px on the long edge) — scripts reference it via imageUrl, and vision-capable models can "see" it to generate pixelation, palette extraction, color grading, and other processing code. After submitting, preview it or download a single HTML file.
- The Script Editor includes a built-in AI generation panel: pick a function-calling model, describe the effect in natural language, and the AI writes the code into the editor via tool calls. If the editor already has content, choose Overwrite or let the AI modify the existing code.
- The AI Assistant supports streaming chat with ChatGPT, Gemini, and DeepSeek, plus custom OpenAI-compatible models. Each model has its own API key and system prompt, with a "Test Connection" option. Conversations are stored per model and kept independently.
- Conversations can be exported as Markdown (human-readable) or JSON (with structured metadata such as finish_reason, usage, and tool_calls), and imported back from JSON to continue (with append or replace options).
- The "Settings" entry at the bottom of the sidebar lets you adjust parameters (image size limit, tool loop, context length, request timeout, title length), switch between Chinese and English, and manage local storage (view per-item size, delete items, export backups, import backups, and export all works as a ZIP). The UI supports light/dark themes, and as a PWA it can be added to the home screen for offline use.