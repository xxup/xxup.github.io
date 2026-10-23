## randomArt可视化创意编程

#### randomArt Visual Creative Coding is a pure frontend tool. All data is stored locally in the browser — no backend required, works offline.

---

- The home page randomly loads and runs a p5.js sketch with mouse and touch interaction. The sidebar lets you view, search, rename, or delete saved works; click a title to run it.
- The Script Editor provides a CodeMirror editor with syntax highlighting, line numbers, and auto-saved drafts. You can upload an image for scripts to reference via imageUrl, and vision-capable models can "see" it to generate processing code such as pixelation, palette extraction, and color grading. Supports switching between p5.js and three.js engines; in three.js mode, THREE is auto-injected as a global variable. After submitting, you can preview it or download it as a single HTML file, and save the preview as a PNG.
- The Script Editor includes a built-in AI generation panel: pick a function-calling model, describe the effect in natural language, and the AI writes the code into the editor via tool calls. If the editor already has content, choose Overwrite or let the AI modify the existing code. Different engines use different system prompts.
- The AI Assistant supports streaming chat with ChatGPT, Gemini, and DeepSeek, plus custom OpenAI-compatible models. Each model has its own API key and system prompt, with a "Test Connection" option. Conversations are stored per model and kept independently.
- The AI Assistant's conversations can be exported as Markdown or JSON (with structured metadata such as finish_reason, usage, and tool_calls), and imported back from JSON to continue (with append or replace options).
- The "Settings" entry lets you adjust parameters, switch between Chinese and English, and manage local storage. The UI supports light/dark themes, and as a PWA it can be added to the home screen for offline use.

---

#### randomArt可视化创意编程是一款纯前端工具，所有数据存于本地浏览器，无需后端打开即可离线运行

---

### 功能

##### 运行器（首页）
- 随机加载并运行内置p5.js脚本
- 侧边栏查看、搜索、重命名、删除已保存作品
- 点击作品标题全屏预览；预览模式锁定设备宽高，横竖屏自动适配
- p5.js、three.js作品均支持PNG截图
- 主文档双指/多指手势锁定，避免误缩放

##### 编写脚本（编辑器）
- CodeMirror5编辑器：语法高亮、行号、草稿自动保存
- **双引擎切换**：右上角`p5.js`/`three.js`按钮即时切换
- 上传图片（自动压缩至长边1024px，会话级），脚本通过`imageUrl`引用
- AI生成面板：用自然语言描述效果，AI通过工具调用把代码写入编辑器
- 编辑器已有内容时可选「覆盖」或「基于现有代码修改」
- 提交后可预览、下载单个HTML文件

##### three.js引擎
- `THREE`自动注入为全局变量，用户代码直接使用`THREE.Scene`等
- 无需写`import`语句
- 不使用`OrbitControls`、addons（环境限制），相机手势需手写`TouchEvent`
- 截图功能已通过强制`preserveDrawingBuffer: true`支持

##### AI助手
- 支持ChatGPT、Gemini、DeepSeek流式对话
- 可自定义OpenAI兼容模型（Endpoint、API Model、Tools、Vision）
- 每个模型独立配置API Key与系统提示词
- 测试连接、重新生成、删除、复制消息
- 对话导出Markdown/JSON（含 `finish_reason`、`usage`、`tool_calls` 等元数据）
- 从JSON文件导入对话（支持追加或覆盖）

##### 设置
- 参数调整：图片上限、工具调用轮次、上下文长度、请求超时、标题长度
- 中英文切换（静态与动态文本均即时更新）
- 本地存储管理：查看各项大小、单项删除、打包备份、导入备份、导出全部作品ZIP
- 亮/暗主题切换（CodeMirror主题同步）

---

### 技术栈

| 层 | 技术 | 引入方式 |
|---|---|---|
| 编辑器 | CodeMirror 5.65.16 | CDN UMD（`window.CodeMirror`） |
| 压缩 | JSZip 3.10.1 | CDN UMD（`window.JSZip`） |
| 图形 | p5.js 1.9.0 / three.js 0.186.0 | 运行时 CDN |
| 部署 | GitHub Pages | 纯静态，无构建 |


---
