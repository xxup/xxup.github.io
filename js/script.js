// -------- 本地存储 --------
function getPages() {
  try { return JSON.parse(localStorage.getItem('p5_pages')) || []; } catch { return []; }
}
function savePages(pages) {
  localStorage.setItem('p5_pages', JSON.stringify(pages));
}

// -------- 工具函数 --------
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generatePageHtml(title, script, imageDataUrl) {
  const safeTitle = escapeHtml(title) || '未命名页面';
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

// -------- 预览（新窗口）--------
function previewPage(htmlContent) {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(htmlContent);
    win.document.close();
  } else {
    alert('请允许弹出窗口。');
  }
}

// -------- 导出所有作品为 ZIP --------
function exportZip() {
  const pages = getPages();
  if (!pages.length) {
    alert('没有可导出的作品。');
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

// -------- 状态 --------
let editor = null;
let uploadedImageDataUrl = null;
let theme = 'light';
let searchTerm = '';

// -------- 侧边栏作品列表 --------
function updateSidebarPages() {
  const container = document.getElementById('sidebar-pages');
  const pages = getPages();
  const term = searchTerm.trim().toLowerCase();

  // 过滤
  const visible = [];
  pages.forEach((page, index) => {
    if (term && !(page.title || '').toLowerCase().includes(term)) return;
    visible.push({ page, index });
  });

  if (!visible.length) {
    container.innerHTML = `<div class="no-pages">${
      term ? '没有匹配的作品' : '暂无生成的脚本'
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

// 搜索输入监听
document.getElementById('searchInput').addEventListener('input', function() {
  searchTerm = this.value;
  updateSidebarPages();
});

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
  if (!confirm('确定删除该作品吗？')) return;
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
  const newTitle = prompt('请输入新标题：', page.title);
  if (newTitle === null || newTitle.trim() === '') return;
  page.title = newTitle.trim();
  savePages(pages);
  updateSidebarPages();
  render();
}
window.renamePage = renamePage;

// -------- 侧边栏控制 --------
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  document.getElementById('hamburgerBtn').classList.add('hidden'); // 隐藏汉堡按钮
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('hamburgerBtn').classList.remove('hidden'); // 显示汉堡按钮
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

// -------- 主题切换 --------
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

// -------- 路由渲染 --------
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
    app.innerHTML = `
      <h1>🎨 p5.js 脚本生成器</h1>
      <p>所有数据保存在本地浏览器中，无需服务器。</p>
      <p>编写 p5.js 脚本，上传图片素材，生成独立的 HTML 页面。</p>
      <p>支持预览、导出 ZIP、删除和重命名作品。</p>
      <p>点击左上角 ☰ 菜单查看所有作品。</p>
    `;
  } else if (path === '/about') {
    app.innerHTML = `
      <h1>📖 关于</h1>
      <p>纯前端工具，基于 localStorage 存储，无需后端。</p>
      <p>使用 CodeMirror 实现代码高亮，支持亮色/暗色主题。</p>
      <p>所有作品均可导出为 ZIP 包。</p>
    `;
  } else if (path === '/generator') {
    app.innerHTML = `
      <h1>✏️ 编写 p5.js 脚本</h1>
      <p>输入页面标题和 p5.js 代码，上传图片（可选），点击生成。</p>
      <div class="form-group">
        <label for="title">页面标题</label>
        <input type="text" id="title" placeholder="例如：我的创意绘图">
      </div>
      <div class="form-group">
        <label for="script">p5.js 脚本代码</label>
        <textarea id="script" placeholder="例如：&#10;function setup() {&#10;  createCanvas(400, 400);&#10;  background(220);&#10;}&#10;function draw() {&#10;  ellipse(mouseX, mouseY, 50, 50);&#10;}"></textarea>
      </div>
      <div class="form-group">
        <label for="image">上传图片（可选，脚本可通过 <code>imageUrl</code> 加载）</label>
        <input type="file" id="image" accept="image/*" onchange="handleImageUpload(this)">
        <div id="image-preview"></div>
      </div>
      <button onclick="buildPage()">生成页面</button>
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
        document.getElementById('image-preview').innerHTML = `<p>✅ 图片上传成功</p><img src="${e.target.result}" class="preview-img">`;
      };
      reader.readAsDataURL(file);
    };

    window.buildPage = function() {
      const title = document.getElementById('title').value.trim() || '未命名脚本';
      const script = editor ? editor.getValue().trim() : document.getElementById('script').value.trim();
      if (!script) {
        alert('请填写 p5.js 脚本代码');
        return;
      }
      const imageDataUrl = uploadedImageDataUrl || '';
      const resultDiv = document.getElementById('result');
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = '正在生成...';

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
      msg.textContent = '✅ 页面生成成功！已保存到本地存储。';
      resultDiv.appendChild(msg);

      const btnContainer = document.createElement('div');
      btnContainer.className = 'action-buttons';

      const previewBtn = document.createElement('button');
      previewBtn.className = 'preview';
      previewBtn.textContent = '👁️ 预览';
      previewBtn.addEventListener('click', function() {
        previewPage(htmlContent);
      });
      btnContainer.appendChild(previewBtn);

      const zipBtn = document.createElement('button');
      zipBtn.className = 'zip';
      zipBtn.textContent = '📦 导出所有作品 (ZIP)';
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
    app.innerHTML = `<h1>📄 页面 ${path}</h1><p>内容未定义。</p>`;
  }
}

// -------- 事件监听 --------
window.addEventListener('popstate', function() {
  const app = document.getElementById('app');
  if (app.classList.contains('preview-mode')) {
    app.classList.remove('preview-mode');
  }
  render();
});

window.onload = function() {
  updateSidebarPages();
  render();
};