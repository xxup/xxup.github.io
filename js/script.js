// ============================================================
// 预览 iframe：最简 srcdoc（不做任何 resize 干预）
// ============================================================
function setPreviewIframe(app, html) {
  app.classList.add('preview-mode');
  app.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.setAttribute('allow', 'fullscreen');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.display = 'block';
  iframe.srcdoc = html;
  app.appendChild(iframe);
}

// ============================================================
// 首页随机 p5 脚本
// ============================================================
const HOME_SCRIPTS = [
  'p5sketches/dots.js',
  'p5sketches/orbit.js',
  'p5sketches/rotating-square.js',
];

function pickRandomScriptPath() {
  if (!HOME_SCRIPTS.length) return null;
  return HOME_SCRIPTS[Math.floor(Math.random() * HOME_SCRIPTS.length)];
}

// p5 页面外壳（干净，不做任何干预）
function buildP5PageHtml(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title || 'p5'}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"><\/script>
  <style>
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      overflow: hidden; background: #000; touch-action: none;
    }
    canvas { display: block; }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

function buildHomeFrameHtml(scriptPath) {
  const absPath = new URL(scriptPath, window.location.href).href;
  return buildP5PageHtml('', `<script src="${absPath}"><\/script>`);
}

let homeScriptPath = null;
let homeScriptHtml = null;

function pickRandomHomeScript() {
  homeScriptPath = pickRandomScriptPath();
  homeScriptHtml = homeScriptPath ? buildHomeFrameHtml(homeScriptPath) : null;
}

// ============================================================
// AI 助手
// ============================================================
const AI_MODELS = {
  chatgpt:  { name: 'ChatGPT',  key: 'ai_key_chatgpt',  storage: 'ai_msgs_chatgpt' },
  gemini:   { name: 'Gemini',   key: 'ai_key_gemini',   storage: 'ai_msgs_gemini' },
  deepseek: { name: 'DeepSeek', key: 'ai_key_deepseek', storage: 'ai_msgs_deepseek' },
};

let aiCurrentModel = null;
let aiMessages = [];
let aiSending = false;

function aiGetKey(model) {
  return localStorage.getItem(AI_MODELS[model].key) || '';
}
function aiSetKey(model, key) {
  localStorage.setItem(AI_MODELS[model].key, key);
}
function aiLoadMessages(model) {
  try {
    return JSON.parse(localStorage.getItem(AI_MODELS[model].storage)) || [];
  } catch { return []; }
}
function aiSaveMessages() {
  if (aiCurrentModel) {
    localStorage.setItem(AI_MODELS[aiCurrentModel].storage, JSON.stringify(aiMessages));
  }
}

// ============================================================
// 文本内容加载
// ============================================================
let CONTENT = null;

async function loadContent() {
  try {
    const res = await fetch('data/content.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    CONTENT = await res.json();
  } catch (e) {
    console.error('加载 content.json 失败:', e);
    CONTENT = { nav: {}, pages: {}, messages: {}, meta: {} };
  }
}

function get(path, fallback = '') {
  if (!CONTENT) return fallback;
  return path.split('.').reduce((obj, key) =>
    (obj && obj[key] !== undefined ? obj[key] : undefined), CONTENT) ?? fallback;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = get(key);
    if (value) el.textContent = value;
  });
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = get('nav.searchPlaceholder', ' =>搜索...');
  document.title = get('meta.pageTitle', 'p5.js 脚本生成器');
}

// ============================================================
// 本地存储
// ============================================================
function getPages() {
  try { return JSON.parse(localStorage.getItem('p5_pages')) || []; } catch { {
 return []; }
}
function savePages(pages) {
  localStorage.setItem('p5_pages', JSON.stringify   (pages));
}

// ============================================================
// 工具
// ============================================================
function escapeHtml(text const) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
 link}

function generatePageHtml(title, script, imageDataUrl) {
  const safeTitle = escapeHtml(title) || = 'Untitled';
  const imgVar = imageDataUrl ? `var imageUrl = "${imageDataUrl} document";` : 'var imageUrl = null;';
  const bodyContent = `<script>
    ${imgVar}
    ${script}
  <\/script>`;
.createElement  return buildP5PageHtml(safeTitle, bodyContent);
}

function exportZip() {
  const pages = getPages();
  if (!pages.length) {
    alert(get('messages.zipEmpty', '没有可导出的作品。'));
    return;
  }
  const zip = new JSZip();
  pages.forEach((page, idx) => {
    const filename = `p5_${page.title || 'untitled'}_${idx+1}.html`.replace(/[^a-zA-Z0-9._-]/g, '_');
    zip.file(filename, page.html);
  });
  zip.generateAsync({ type: 'blob' }).then(blob('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'p5_works.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  });
}

// ============================================================
// 状态
// ============================================================
let editor = null;
let uploadedImageDataUrl = null;
let theme = 'light';
let searchTerm = '';

// ============================================================
// 侧边栏作品列表
// ============================================================
function updateSidebarPages() {
  const container = document.getElementById('sidebar-pages');
  const pages = getPages();
  const term = searchTerm.trim().toLowerCase();

  const visible = [];
  pages.forEach((page, index) => {
    if (term && !(page.title || '').toLowerCase().includes(term)) return;
    visible.push({ page, index });
  });

  if (!visible.length) {
    container.innerHTML = `<div class="no-pages">${
      term ? get('messages.noMatches', '没有匹配的作品') : get('messages.noPages', '暂无生成的脚本')
    }</div>`;
    return;
  }

  let html = '';
  visible.forEach(({ page, index }) => {
    const title = escapeHtml(page.title);
    html += `
      <div class="page-item">
        <span class="page-title" onclick="navigateToPage(${index})">${title}</span>
        <div class="actions">
          <button class="rename" onclick="event.stopPropagation(); renamePage(${index})" title="重命名">✏️</button>
          <button class="del" onclick="event.stopPropagation(); deletePage(${index})" title="删除">🗑️</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function navigateToPage(index) {
  const pages = getPages();
  if (!pages[index]) return;
  sessionStorage.setItem('p5_preview_override', pages[index].html);
  history.pushState(null, '', '/');
  render();
  closeSidebar();
}
window.navigateToPage = navigateToPage;

function deletePage(index) {
  if (!confirm(get('messages.deleteConfirm', '确定删除该作品吗？'))) return;
  const pages = getPages();
  pages.splice(index, 1);
  savePages(pages);
  updateSidebarPages();
  render();
}
window.deletePage = deletePage;

function renamePage(index) {
  const pages = getPages();
  const page = pages[index];
  if (!page) return;
  const newTitle = prompt(get('messages.renamePrompt', '请输入新标题：'), page.title);
  if (newTitle === null || newTitle.trim() === '') return;
  page.title = newTitle.trim();
  savePages(pages);
  updateSidebarPages();
  render();
}
window.renamePage = renamePage;

// ============================================================
// 侧边栏控制
// ============================================================
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  document.getElementById('hamburgerBtn').classList.add('hidden');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('hamburgerBtn').classList.remove('hidden');
}

document.getElementById('hamburgerBtn').addEventListener('click', openSidebar);
document.getElementById('overlay').addEventListener('click', closeSidebar);

document.querySelectorAll('.sidebar .nav-item[data-path]').forEach(el => {
  el.addEventListener('click', function() {
    const path = this.getAttribute('data-path');
    if (path === '/') {
      sessionStorage.removeItem('p5_preview_override');
      pickRandomHomeScript();
    }
    history.pushState(null, '', path);
    render();
    closeSidebar();
  });
});

// ============================================================
// 主题切换
// ============================================================
function toggleTheme() {
  const body = document.body;
  const lightTheme = document.getElementById('cm-theme');
  const darkTheme = document.getElementById('cm-theme-dark');
  if (theme === 'light') {
    body.classList.add('dark-mode');
    lightTheme.disabled = true;
    darkTheme.disabled = false;
    theme = 'dark';
    if (editor) editor.setOption('theme', 'dracula');
  } else {
    body.classList.remove('dark-mode');
    lightTheme.disabled = false;
    darkTheme.disabled = true;
    theme = 'light';
    if (editor) editor.setOption('theme', 'default');
  }
}
document.getElementById('themeToggleSidebar').addEventListener('click', toggleTheme);

// ============================================================
// AI 助手 - 聊天页面
// ============================================================
function renderAIChat(app) {
  app.classList.add('ai-mode');
  app.classList.remove('preview-mode');

  if (!aiCurrentModel) {
    const saved = localStorage.getItem('ai_last_model');
    if (saved && AI_MODELS[saved]) {
      aiCurrentModel = saved;
      aiMessages = aiLoadMessages(saved);
    }
  }

  app.innerHTML = `
    <div class="ai-chat-wrap">
      <div class="ai-messages" id="aiMessages"></div>
      <div class="ai-input-bar">
        <button class="ai-plus-btn" id="aiPlusBtn" title="选择模型">+</button>
        <input type="text" class="ai-input" id="aiInput" placeholder="${escapeHtml(get('pages.ai.placeholder', '输入你的问题...'))}">
        <button class="ai-send-btn" id="aiSendBtn">${escapeHtml(get('pages.ai.sendBtn', '发送'))}</button>
      </div>
    </div>
    <button class="ai-clear-btn" id="aiClearBtn" title="清除对话">−</button>
  `;

  renderAIMessages();

  document.getElementById('aiPlusBtn').addEventListener('click', showModelMenu);
  document.getElementById('aiSendBtn').addEventListener('click', aiSendMessage);
  document.getElementById('aiInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      aiSendMessage();
    }
  });
  document.getElementById('aiClearBtn').addEventListener('click', function(e) {
    aiClearMessages();
    e.currentTarget.blur();
  });
}

function renderAIMessages() {
  const box = document.getElementById('aiMessages');
  if (!box) return;
  box.innerHTML = '';
  if (!aiMessages.length) {
    const tip = document.createElement('p');
    tip.style.color = '#999';
    tip.style.textAlign = 'center';
    tip.style.marginTop = '40px';
    tip.style.background = 'transparent';
    tip.textContent = aiCurrentModel
      ? `当前模型：${AI_MODELS[aiCurrentModel].name}`
      : '点击左下角 + 选择模型开始对话';
    box.appendChild(tip);
    return;
  }
  aiMessages.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'ai-msg ' + (msg.role === 'user' ? 'user' : 'assistant');
    div.textContent = msg.content;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function showModelMenu() {
  const old = document.querySelector('.ai-model-menu');
  if (old) { old.remove(); return; }

  const menu = document.createElement('div');
  menu.className = 'ai-model-menu';
  ['chatgpt', 'gemini', 'deepseek'].forEach(key => {
    const item = document.createElement('div');
    item.className = 'item' + (aiCurrentModel === key ? ' selected' : '');
    item.innerHTML = `<span>${AI_MODELS[key].name}</span><span class="check">✓</span>`;
    item.addEventListener('click', () => {
      menu.remove();
      selectModel(key);
    });
    menu.appendChild(item);
  });
  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target) && e.target.id !== 'aiPlusBtn') {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

function selectModel(model) {
  aiCurrentModel = model;
  localStorage.setItem('ai_last_model', model);
  aiMessages = aiLoadMessages(model);
  renderAIMessages();

  if (!aiGetKey(model)) {
    showApiKeyModal(model);
  }
}

function showApiKeyModal(model) {
  const overlay = document.createElement('div');
  overlay.className = 'ai-modal-overlay';
  overlay.innerHTML = `
    <div class="ai-modal">
      <h3>${escapeHtml(get('pages.ai.apiKeyTitle', '请输入 API Key'))} - ${AI_MODELS[model].name}</h3>
      <input type="password" id="aiKeyInput" placeholder="sk-...">
      <p class="hint">${escapeHtml(get('pages.ai.apiKeyHint', 'Key 只保存在你的浏览器本地，不会上传到任何服务器。'))}</p>
      <div class="buttons">
        <button class="cancel" id="aiKeyCancel">取消</button>
        <button class="save" id="aiKeySave">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('aiKeyInput');
  input.focus();

  document.getElementById('aiKeyCancel').addEventListener('click', () => overlay.remove());
  document.getElementById('aiKeySave').addEventListener('click', () => {
    const key = input.value.trim();
    if (key) {
      aiSetKey(model, key);
      overlay.remove();
    } else {
      alert(get('pages.ai.noKey', '请先输入 API Key'));
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('aiKeySave').click();
  });
}

function aiClearMessages() {
  if (!aiMessages.length) return;
  if (!confirm('确定清除当前模型的对话记录吗？')) return;
  aiMessages = [];
  aiSaveMessages();
  renderAIMessages();
}

// ============================================================
// 流式输出 - 发送消息
// ============================================================
async function aiSendMessage() {
  if (aiSending) return;
  if (!aiCurrentModel) {
    alert(get('pages.ai.noModel', '请先选择模型'));
    return;
  }
  const key = aiGetKey(aiCurrentModel);
  if (!key) {
    showApiKeyModal(aiCurrentModel);
    return;
  }
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text) return;

  aiMessages.push({ role: 'user', content: text });
  aiSaveMessages();
  input.value = '';
  renderAIMessages();

  const historyMessages = aiMessages.slice();

  aiMessages.push({ role: 'assistant', content: '' });
  const aiMsgDiv = document.createElement('div');
  aiMsgDiv.className = 'ai-msg assistant';
  aiMsgDiv.textContent = '';
  const box = document.getElementById('aiMessages');
  box.querySelectorAll('p').forEach(p => p.remove());
  box.appendChild(aiMsgDiv);
  box.scrollTop = box.scrollHeight;

  aiSending = true;
  const sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const reply = await callAIStream(
      aiCurrentModel,
      key,
      historyMessages,
      (delta, full) => {
        aiMsgDiv.textContent = full;
        box.scrollTop = box.scrollHeight;
      }
    );
    aiMessages[aiMessages.length - 1].content = reply || '(空响应)';
    aiSaveMessages();
  } catch (e) {
    aiMessages[aiMessages.length - 1].content =
      get('pages.ai.errorPrefix', '请求失败：') + e.message;
    aiSaveMessages();
  } finally {
    aiSending = false;
    if (sendBtn) sendBtn.disabled = false;
    renderAIMessages();
  }
}

// ============================================================
// 流式输出 - 调用各模型 API
// ============================================================
async function callAIStream(model, key, messages, onChunk) {
  if (model === 'chatgpt') {
    return streamOpenAIStyle(
      'https://api.openai.com/v1/chat/completions',
      key, 'gpt-4o-mini', messages, onChunk
    );
  }
  if (model === 'deepseek') {
    return streamOpenAIStyle(
      'https://api.deepseek.com/chat/completions',
      key, 'deepseek-chat', messages, onChunk
    );
  }
  if (model === 'gemini') {
    return streamGemini(key, messages, onChunk);
  }
  throw new Error('Unknown model');
}

async function streamOpenAIStyle(url, key, modelName, messages, onChunk) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
    },
    body: JSON.stringify({
      model: modelName,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onChunk(delta, fullText);
        }
      } catch (e) {}
    }
  }
  return fullText;
}

async function streamGemini(key, messages, onChunk) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data) continue;
      try {
        const json = JSON.parse(data);
        const txt = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) {
          fullText += txt;
          onChunk(txt, fullText);
        }
      } catch (e) {}
    }
  }
  return fullText;
}

// ============================================================
// 路由渲染
// ============================================================
function render() {
  const path = window.location.pathname;
  const app = document.getElementById('app');

  if (editor) {
    editor.toTextArea();
    editor = null;
  }

  app.classList.remove('preview-mode');
  app.classList.remove('ai-mode');

  if (path === '/' || path === '/index.html') {
    const override = sessionStorage.getItem('p5_preview_override');
    let html = override || homeScriptHtml;

    if (!html) {
      pickRandomHomeScript();
      html = homeScriptHtml;
    }

    if (html) {
      setPreviewIframe(app, html);
    } else {
      app.innerHTML = `<p style="text-align:center;padding:60px;">${escapeHtml(get('messages.noScripts', '暂无脚本'))}</p>`;
    }
  } else if (path === '/about') {
    const about = get('pages.about', {});
    const paragraphs = (about.paragraphs || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');
    app.innerHTML = `
      <h1>${escapeHtml(about.title || '')}</h1>
      ${paragraphs}
    `;
  } else if (path === '/ai') {
    renderAIChat(app);
  } else if (path === '/generator') {
    const g = get('pages.generator', {});
    const labels = g.labels || {};
    const scriptPlaceholder = labels.scriptPlaceholder || '';
    app.innerHTML = `
      <h1>${escapeHtml(g.title || '')}</h1>
      <p>${escapeHtml(g.description || '')}</p>
      <div class="form-group">
        <label for="title">${escapeHtml(labels.titleInput || '页面标题')}</label>
        <input type="text" id="title" placeholder="${escapeHtml(labels.titlePlaceholder || '')}">
      </div>
      <div class="form-group">
        <label for="script">${escapeHtml(labels.scriptInput || 'p5.js 脚本代码')}</label>
        <textarea id="script"></textarea>
      </div>
      <div class="form-group">
        <label for="image">${escapeHtml(labels.imageInput || '上传图片')}</label>
        <input type="file" id="image" accept="image/*" onchange="handleImageUpload(this)">
        <div id="image-preview"></div>
      </div>
      <button onclick="buildPage()">${escapeHtml(labels.generateBtn || '生成页面')}</button>
      <div id="result" class="result" style="display:none;"></div>
    `;

    setTimeout(() => {
      const textarea = document.getElementById('script');
      if (textarea && !editor) {
        const themeName = theme === 'dark' ? 'dracula' : 'default';
        editor = CodeMirror.fromTextArea(textarea, {
          mode: 'javascript',
          lineNumbers: true,
          theme: themeName,
          tabSize: 2,
          indentUnit: 2,
          autofocus: true,
          placeholder: scriptPlaceholder
        });
        editor.setSize(null, 200);
      }
    }, 50);

    uploadedImageDataUrl = null;
    document.getElementById('image-preview').innerHTML = '';

    window.handleImageUpload = function(input) {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        uploadedImageDataUrl = e.target.result;
        document.getElementById('image-preview').innerHTML =
          `<p>✅ 图片上传成功</p><img src="${e.target.result}" class="preview-img">`;
      };
      reader.readAsDataURL(file);
    };

    window.buildPage = function() {
      const title = document.getElementById('title').value.trim() || get('messages.emptyTitle', '未命名脚本');
      const script = editor ? editor.getValue().trim() : document.getElementById('script').value.trim();
      if (!script) {
        alert(get('messages.scriptRequired', '请填写 p5.js 脚本代码'));
        return;
      }
      const imageDataUrl = uploadedImageDataUrl || '';
      const resultDiv = document.getElementById('result');
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = get('messages.generating', '正在生成...');

      const htmlContent = generatePageHtml(title, script, imageDataUrl);

      const pages = getPages();
      pages.push({
        id: Date.now(),
        title: title,
        html: htmlContent,
        timestamp: new Date().toISOString()
      });
      savePages(pages);
      updateSidebarPages();

      resultDiv.innerHTML = '';
      const msg = document.createElement('p');
      msg.textContent = get('messages.generateSuccess', '✅ 页面生成成功！已保存到本地存储。');
      resultDiv.appendChild(msg);

      const btnContainer = document.createElement('div');
      btnContainer.className = 'action-buttons';

      const previewBtn = document.createElement('button');
      previewBtn.className = 'preview';
      previewBtn.textContent = get('messages.previewBtn', '🏠 返回首页预览');
      previewBtn.addEventListener('click', function() {
        sessionStorage.setItem('p5_preview_override', htmlContent);
        history.pushState(null, '', '/');
        render();
      });
      btnContainer.appendChild(previewBtn);

      const zipBtn = document.createElement('button');
      zipBtn.className = 'zip';
      zipBtn.textContent = get('messages.zipBtn', '📦 导出所有作品 (ZIP)');
      zipBtn.addEventListener('click', exportZip);
      btnContainer.appendChild(zipBtn);

      resultDiv.appendChild(btnContainer);

      document.getElementById('title').value = '';
      if (editor) editor.setValue('');
      else document.getElementById('script').value = '';
      uploadedImageDataUrl = '';
      document.getElementById('image-preview').innerHTML = '';
      document.getElementById('image').value = '';
    };
  } else {
    const nf = get('pages.notFound', {});
    const paragraphs = (nf.paragraphs || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');
    app.innerHTML = `
      <h1>${escapeHtml(nf.title || '📄 页面未找到')}</h1>
      ${paragraphs || `<p>${escapeHtml(path)}</p>`}
    `;
  }
}

document.getElementById('searchInput').addEventListener('input', function() {
  searchTerm = this.value;
  updateSidebarPages();
});

window.addEventListener('popstate', function() {
  render();
});

window.addEventListener('load', async function() {
  await loadContent();
  pickRandomHomeScript();
  applyI18n();
  updateSidebarPages();
  render();
});