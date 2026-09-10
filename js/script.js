// ============================================================
// 全局配置：从 data/content.json 加载
// ============================================================
let CONTENT = null;

async function loadContent() {
  try {
    const res = await fetch('data/content.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    CONTENT = await res.json();
  } catch (e) {
    console.error('加载 content.json 失败:', e);
    alert('无法加载 data/content.json，请通过 HTTP 服务器访问本页面（如 python -m http.server）。');
    // 兜底：使用空对象，避免后续代码崩溃
    CONTENT = {
      nav: {}, pages: {}, messages: {}, meta: {}
    };
  }
}

// 读取嵌套属性，如 get('pages.home.title')
function get(path, fallback = '') {
  if (!CONTENT) return fallback;
  return path.split('.').reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), CONTENT) ?? fallback;
}

// 应用 HTML 中带有 data-i18n 的元素
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = get(key);
    if (value) el.textContent = value;
  });
  // placeholder 特殊处理
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = get('nav.searchPlaceholder', '搜索...');
  // 页面标题
  document.title = get('meta.pageTitle', 'p5.js 脚本生成器');
}

// ============================================================
// 本地存储
// ============================================================
function getPages() {
  try { return JSON.parse(localStorage.getItem('p5_pages')) || []; } catch { return []; }
}
function savePages(pages) {
  localStorage.setItem('p5_pages', JSON.stringify(pages));
}

// ============================================================
// 工具函数
// ============================================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generatePageHtml(title, script, imageDataUrl) {
  const safeTitle = escapeHtml(title) || 'Untitled';
  const imgVar = imageDataUrl ? `var imageUrl = "${imageDataUrl}";` : 'var imageUrl = null;';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"><\/script>
</head>
<body>
  <script>
    ${imgVar}
    ${script}
  <\/script>
</body>
</html>`;
}

function previewPage(htmlContent) {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(htmlContent);
    win.document.close();
  } else {
    alert(get('messages.popupBlocked', '请允许弹出窗口。'));
  }
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
  zip.generateAsync({ type: 'blob' }).then(blob => {
    const link = document.createElement('a');
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
  const content = pages[index].html;
  const app = document.getElementById('app');
  app.innerHTML = `<iframe srcdoc="${escapeHtml(content).replace(/"/g, '&quot;')}"></iframe>`;
  app.classList.add('preview-mode');
  closeSidebar();
}
window.navigateToPage = navigateToPage;

function deletePage(index) {
  if (!confirm(get('messages.deleteConfirm', '确定删除该作品吗？'))) return;
  const pages = getPages();
  pages.splice(index, 1);
  savePages(pages);
  updateSidebarPages();
  const app = document.getElementById('app');
  if (app.classList.contains('preview-mode')) {
    app.classList.remove('preview-mode');
    history.pushState(null, '', '/');
    render();
  } else {
    render();
  }
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
    history.pushState(null, '', path);
    const app = document.getElementById('app');
    if (app.classList.contains('preview-mode')) {
      app.classList.remove('preview-mode');
    }
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
// 路由渲染
// ============================================================
function render() {
  const path = window.location.pathname;
  const app = document.getElementById('app');

  if (app.classList.contains('preview-mode') && path !== '/') {
    app.classList.remove('preview-mode');
  }

  if (editor) {
    editor.toTextArea();
    editor = null;
  }

  if (path === '/' || path === '/index.html') {
    const home = get('pages.home', {});
    const paragraphs = (home.paragraphs || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');
    app.innerHTML = `
      <h1>${escapeHtml(home.title || '')}</h1>
      ${paragraphs}
    `;
  } else if (path === '/about') {
    const about = get('pages.about', {});
    const paragraphs = (about.paragraphs || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');
    app.innerHTML = `
      <h1>${escapeHtml(about.title || '')}</h1>
      ${paragraphs}
    `;
  } else if (path === '/generator') {
    const g = get('pages.generator', {});
    const labels = g.labels || {};
    const scriptPlaceholder = escapeHtml(labels.scriptPlaceholder || '');
    app.innerHTML = `
      <h1>${escapeHtml(g.title || '')}</h1>
      <p>${escapeHtml(g.description || '')}</p>
      <div class="form-group">
        <label for="title">${escapeHtml(labels.titleInput || '页面标题')}</label>
        <input type="text" id="title" placeholder="${escapeHtml(labels.titlePlaceholder || '')}">
      </div>
      <div class="form-group">
        <label for="script">${escapeHtml(labels.scriptInput || 'p5.js 脚本代码')}</label>
        <textarea id="script" placeholder="${scriptPlaceholder}"></textarea>
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
          autofocus: true
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
      msg.textContent = get('messages.generateSuccess', '✅ 页面生成成功！');
      resultDiv.appendChild(msg);

      const btnContainer = document.createElement('div');
      btnContainer.className = 'action-buttons';

      const previewBtn = document.createElement('button');
      previewBtn.className = 'preview';
      previewBtn.textContent = get('messages.previewBtn', '👁️ 预览');
      previewBtn.addEventListener('click', function() { previewPage(htmlContent); });
      btnContainer.appendChild(previewBtn);

      const zipBtn = document.createElement('button');
      zipBtn.className = 'zip';
      zipBtn.textContent = get('messages.zipBtn', '📦 导出所有作品 (ZIP)');
      zipBtn.addEventListener('click', exportZip);
      btnContainer.appendChild(zipBtn);

      resultDiv.appendChild(btnContainer);

      // 重置表单
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

// ============================================================
// 搜索输入监听
// ============================================================
document.getElementById('searchInput').addEventListener('input', function() {
  searchTerm = this.value;
  updateSidebarPages();
});

// ============================================================
// 事件监听
// ============================================================
window.addEventListener('popstate', function() {
  const app = document.getElementById('app');
  if (app.classList.contains('preview-mode')) {
    app.classList.remove('preview-mode');
  }
  render();
});

// ============================================================
// 初始化（先加载 JSON，再应用文本并渲染）
// ============================================================
window.addEventListener('load', async function() {
  await loadContent();
  applyI18n();
  updateSidebarPages();
  render();
});