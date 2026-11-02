/* ============================================================
   AGI会员瀑布流作品展示 · 主逻辑
   ============================================================ */
(function () {
  'use strict';

  const IMAGE_BASE_URL = 'https://a-g-i.s3.eu-west-3.amazonaws.com';
  const DATA_URL = './data.json';
  const FAV_KEY = 'gallery_favorites_v1';
  const THEME_KEY = 'gallery_theme_v1';
  const HOME_ORDER_KEY = 'gallery_home_order_v1';
  const VARIANT_TEMPLATES = {
    small:  '_500xAUTO_crop_center-center_75_none',
    medium: '_1600xAUTO_crop_center-center_75_none',
    large:  '_2000xAUTO_crop_center-center_75_none'
  };
  const expandCache = new WeakMap();
  function expandImage(img) {
    if (!img) return null;
    if (img.small || img.large) return img;
    if (expandCache.has(img)) return expandCache.get(img);

    const base = String(img.url || img.src || '').trim();
    if (!base) {
      const empty = Object.assign({}, img, { url: '', small: '', medium: '', large: '' });
      expandCache.set(img, empty);
      return empty;
    }
    if (/^(data|blob):/i.test(base)) {
      const pass = Object.assign({}, img, { url: base, small: base, medium: base, large: base });
      expandCache.set(img, pass);
      return pass;
    }
    let host = '';
    let path = base;
    const m = base.match(/^((?:https?:)?\/\/[^/]+)(\/.*)$/i);
    if (m) { host = m[1]; path = m[2]; }

    if (host && host.indexOf('a-g-i.s3.') === -1) {
      const pass = Object.assign({}, img, { url: base, small: base, medium: base, large: base });
      expandCache.set(img, pass);
      return pass;
    }
    const dir = path.replace(/^\//, '');
    const slash = dir.lastIndexOf('/');
    const folder = slash >= 0 ? dir.slice(0, slash + 1) : '';
    const file = slash >= 0 ? dir.slice(slash + 1) : dir;
    const qIdx = file.indexOf('?');
    const cleanFile = qIdx >= 0 ? file.slice(0, qIdx) : file;
    const query = qIdx >= 0 ? file.slice(qIdx) : '';
    const prefix = host ? host + '/' : '';
    const result = Object.assign({}, img, {
      url: base,
      small:  prefix + folder + VARIANT_TEMPLATES.small  + '/' + cleanFile + query,
      medium: prefix + folder + VARIANT_TEMPLATES.medium + '/' + cleanFile + query,
      large:  prefix + folder + VARIANT_TEMPLATES.large  + '/' + cleanFile + query
    });
    expandCache.set(img, result);
    return result;
  }
  function resolveUrl(url) {
    if (!url) return '';
    const s = String(url).trim();
    if (!s) return '';
    if (/^(https?:)?\/\//i.test(s)) return s;
    if (/^(data|blob):/i.test(s)) return s;
    return IMAGE_BASE_URL + (s.charAt(0) === '/' ? '' : '/') + s;
  }
  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function highlightHtml(text, terms) {
    const safe = escapeHtml(text || '');
    if (!terms || !terms.length) return safe;
    const uniq = [...new Set(terms.filter(Boolean).map(t => escapeHtml(t)))];
    if (!uniq.length) return safe;
    uniq.sort((a, b) => b.length - a.length);
    const pattern = uniq.map(escapeRegExp).join('|');
    return safe.replace(new RegExp('(' + pattern + ')', 'gi'), '<mark>$1</mark>');
  }
  function filterBySet(base, other) {
    if (!base || !base.length || !other || !other.length) return [];
    const set = new Set(other);
    return base.filter(x => set.has(x));
  }

  const MIN_COL = 230, MAX_COLS = 6;
  const PHONE_PORTRAIT_MAX = 640, PHONE_LANDSCAPE_MAX = 900;
  const HEADER_EST = 70, CHUNK_SIZE = 15;
  const SEARCH_PAGE = 60;
  const FILTER_LABELS = {
    designer: '设计师',
    country:  '国家',
    type:     '类型',
    sector:   '领域'
  };
  const gallery = document.getElementById('gallery');
  const sentinel = document.getElementById('sentinel');
  const statusEl = document.getElementById('status');
  const lightbox = document.getElementById('lightbox');
  const lbGallery = document.getElementById('lb-gallery');
  const lbCount = document.getElementById('lb-count');
  const lbFav = document.getElementById('lbFav');
  const lbTitle = document.getElementById('lb-title');
  const lbDesigner = document.getElementById('lb-designer');
  const lbMetaGrid = document.getElementById('lb-meta-grid');
  const lbDetails = document.getElementById('lb-details');
  const lbTags = document.getElementById('lb-tags');
  const searchBtn = document.getElementById('searchBtn');
  const searchBox = document.getElementById('searchBox');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const hamburger = document.getElementById('hamburger');
  const pillMenu = document.getElementById('pillMenu');
  const filterYear = document.getElementById('filterYear');
  const filterType = document.getElementById('filterType');
  const filterCountry = document.getElementById('filterCountry');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const toastEl = document.getElementById('toast');
  const themeToggle = document.getElementById('themeToggle');
  const state = {
    allProjects: [],
    loadQueue: [],
    currentIndex: 0,
    chunksPerBatch: 1,
    rootMargin: 800,
    maxCards: 300,
    loading: false,
    finished: false,
    view: 'all',
    savedView: 'all',
    savedCards: [],
    allCards: [],
    columns: [],
    columnHeights: [],
    colWidth: 0,
    gap: 16,
    totalLoaded: 0,
    recordById: new Map(),
    cardQueue: [],
    dehydrated: new Set(),
    liveCount: 0,
    io: null,
    ioRootMargin: 0,
    cardIO: null,
    searchTimer: null,
    searchIndex: [],
    inverted: new Map(),
    currentColCount: 0,
    favorites: new Set(),
    currentTerms: [],
    searchResults: [],
    searchShown: 0,
    searchTotal: 0,
    searchDesc: '',
    currentLightboxId: '',
    lbImages: [],
    lbIndex: 0,
    lbIO: null,
    lastFocus: null,
    scrollSyncTimer: null,
    filterDesigner: '',
    discoverRendered: false,
    homeFilterType: '',
    homeFilterValue: '',
    aboutStats: ''
  };
  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) state.favorites = new Set(JSON.parse(raw).map(String));
    } catch (e) { console.warn('读取收藏失败', e); }
  }
  function saveFavorites() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...state.favorites])); }
    catch (e) { console.warn('保存收藏失败', e); }
  }
  function toggleFavorite(id) {
    const key = String(id);
    if (state.favorites.has(key)) { state.favorites.delete(key); showToast('已取消收藏'); }
    else { state.favorites.add(key); showToast('已加入收藏'); }
    saveFavorites();
    updateFavoriteButtons(key);
    if (state.view === 'favorites') renderFavorites();
  }
  function updateFavoriteButtons(id) {
    const active = state.favorites.has(String(id));
    if (state.currentLightboxId && state.currentLightboxId === String(id)) {
      lbFav.classList.toggle('active', active);
      lbFav.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }
  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }
  function updateSearchClear() {
    searchBox.classList.toggle('has-value', searchInput.value.length > 0);
  }
  function exitPageViews() {
    document.body.classList.remove('view-discover', 'view-about');
    const dv = document.getElementById('discoverView');
    const av = document.getElementById('aboutView');
    if (dv) dv.hidden = true;
    if (av) av.hidden = true;
  }
  function updateDesignerChip() {
    const chip = document.getElementById('designerChip');
    const nameEl = document.getElementById('designerChipName');
    if (!chip || !nameEl) return;
    if (state.filterDesigner) {
      nameEl.textContent = state.filterDesigner;
      chip.hidden = false;
    } else {
      chip.hidden = true;
    }
  }
  function hasUsableImage(img) {
    if (!img) return false;
    const s = img.small, l = img.large, u = img.url;
    return !!((u && String(u).trim()) ||
              (s && String(s).trim()) ||
              (l && String(l).trim()));
  }
  function findCoverImage(record) {
    const imgs = Array.isArray(record.images) ? record.images : [];
    for (let i = 0; i < imgs.length; i++) {
      if (hasUsableImage(imgs[i])) {
        return { image: expandImage(imgs[i]), index: i };
      }
    }
    return null;
  }
  function buildProjectQueue(records) {
    const items = [];
    records.forEach(rec => {
      const cover = findCoverImage(rec);
      if (!cover) return;
      items.push({ record: rec, cover });
    });
    return items;
  }
  function getHomeOrderSeed() {
    try {
      const raw = sessionStorage.getItem(HOME_ORDER_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map(String) : null;
    } catch (e) { return null; }
  }
  function saveHomeOrderSeed(items) {
    try {
      sessionStorage.setItem(HOME_ORDER_KEY, JSON.stringify(items.map(it => String(it.record.id))));
    } catch (e) {}
  }
  function orderBySeed(items, seed) {
    if (!seed || !seed.length) return null;
    const orderMap = new Map(seed.map((id, i) => [String(id), i]));
    for (const it of items) if (!orderMap.has(String(it.record.id))) return null;
    return items.slice().sort((a, b) =>
      orderMap.get(String(a.record.id)) - orderMap.get(String(b.record.id))
    );
  }
  function buildSeededHomeQueue() {
    const items = buildProjectQueue(state.allProjects);
    const ordered = orderBySeed(items, getHomeOrderSeed());
    if (ordered) return ordered;
    const shuffled = shuffleArray(items);
    saveHomeOrderSeed(shuffled);
    return shuffled;
  }
  function matchHomeFilter(rec) {
    const t = state.homeFilterType;
    const v = state.homeFilterValue;
    if (!t || !v) return true;
    if (t === 'designer') return String(rec.designer || '').trim() === v;
    if (t === 'country')  return String(rec.nationalGroup || '').trim() === v;
    if (t === 'type') {
      const arr = Array.isArray(rec.type) ? rec.type : (rec.type ? [rec.type] : []);
      return arr.map(x => String(x).trim()).includes(v);
    }
    if (t === 'sector') {
      const arr = Array.isArray(rec.sector) ? rec.sector : (rec.sector ? [rec.sector] : []);
      return arr.map(x => String(x).trim()).includes(v);
    }
    return true;
  }

  function rebuildHomeQueue() {
    const records = state.allProjects.filter(matchHomeFilter);
    const items = buildProjectQueue(records);
    const ordered = orderBySeed(items, getHomeOrderSeed());
    state.loadQueue = ordered || shuffleArray(items);
    state.currentIndex = 0;
    state.totalLoaded = 0;
    state.finished = false;
    state.loading = false;
    state.liveCount = 0;
    state.dehydrated.clear();
  }
  function showFilterInHome(type, value) {
    const v = String(value || '').trim();
    if (!type || !v) return;

    exitPageViews();
    closePill();
    document.body.classList.remove('searching');
    clearTimeout(state.searchTimer);
    searchInput.value = '';
    updateSearchClear();
    filterYear.value = '';
    filterType.value = '';
    filterCountry.value = '';
    state.filterDesigner = '';
    updateDesignerChip();
    state.currentTerms = [];
    state.searchResults = [];
    state.searchShown = 0;
    state.searchTotal = 0;
    state.savedCards = [];
    state.allCards = [];
    state.view = 'all';
    state.homeFilterType = type;
    state.homeFilterValue = v;
    rebuildHomeQueue();
    clearGalleryForSearch();
    syncUrl();
    if (!state.loadQueue.length) {
      statusEl.textContent = `没有找到「${FILTER_LABELS[type] || ''} · ${v}」对应的作品`;
      updateLoadMore();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    updateStatus('正在加载…');
    setupObserver();
    requestAnimationFrame(() => loadNextBatch());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function initData() {
    try {
      statusEl.textContent = '正在下载数据…';
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const text = await res.text();
      statusEl.textContent = '正在解析数据…';
      await new Promise(r => setTimeout(r, 30));
      const json = JSON.parse(text);
      if (Array.isArray(json)) {
        state.allProjects = json;
      } else if (json && Array.isArray(json.projects)) {
        state.allProjects = json.projects;
      } else if (json && typeof json === 'object') {
        state.allProjects = Object.values(json).filter(v => v && typeof v === 'object' && v.id != null);
      } else {
        state.allProjects = [];
      }
      state.recordById = new Map();
      state.allProjects.forEach(rec => {
        if (rec && rec.id != null) state.recordById.set(String(rec.id), rec);
      });
      state.loadQueue = buildSeededHomeQueue();
      state.currentIndex = 0;
      state.totalLoaded = 0;
      state.finished = false;
      state.liveCount = 0;
      state.dehydrated.clear();
      await buildSearchIndexChunked();
      computeAboutStats();
      rebuildFilters();
      if (!state.loadQueue.length) {
        statusEl.textContent = '数据中没有可用的图片';
        return;
      }
      statusEl.textContent = `成功加载 ${state.allProjects.length} 个项目，可用 ${state.loadQueue.length} 个项目，开始渲染…`;
      requestAnimationFrame(() => loadNextBatch());
    } catch (err) {
      console.error(err);
      statusEl.textContent = '';
      if (location.protocol === 'file:') {
        statusEl.append('加载失败：浏览器限制 file:// 读取本地 JSON。请用本地服务器打开（例如在项目根目录运行 npx serve，然后访问 http://localhost:3000）。');
      } else {
        statusEl.append('加载失败：' + (err && err.message ? err.message : err) + '。');
      }
      const btn = document.createElement('button');
      btn.className = 'load-more-btn';
      btn.style.cssText = 'margin-left:8px;padding:4px 14px;font-size:13px;';
      btn.textContent = '重试';
      btn.addEventListener('click', () => { statusEl.textContent = '正在重试…'; initData(); });
      statusEl.appendChild(btn);
    }
  }
  const TOKEN_SPLIT_RE = /[\s,，。;；、|\/\\\-_·:：()（）\[\]【】"'“”‘’!！?？]+/;
  async function buildSearchIndexChunked() {
    const total = state.allProjects.length;
    state.searchIndex = new Array(total);
    state.inverted = new Map();
    const CHUNK = 800;
    for (let i = 0; i < total; i += CHUNK) {
      const end = Math.min(i + CHUNK, total);
      for (let j = i; j < end; j++) {
        const rec = state.allProjects[j] || {};
        const types = Array.isArray(rec.type) ? rec.type.join(' ') : (rec.type || '');
        const details = Array.isArray(rec.details) ? rec.details.join(' ') : (rec.details || '');
        const sectors = Array.isArray(rec.sector) ? rec.sector.join(' ') : (rec.sector || '');
        const tags = Array.isArray(rec.tags) ? rec.tags.join(' ') : '';
        const haystack = [
          rec.title || '', rec.designer || '', rec.client || '', rec.year || '',
          rec.nationalGroup || '', details, sectors, types, tags
        ].join(' ').toLowerCase();
        state.searchIndex[j] = { id: rec.id, haystack, record: rec };
        const seen = new Set();
        const tokens = haystack.split(TOKEN_SPLIT_RE);
        for (let k = 0; k < tokens.length; k++) {
          const t = tokens[k];
          if (!t || t.length < 2 || t.length > 48 || seen.has(t)) continue;
          seen.add(t);
          let arr = state.inverted.get(t);
          if (!arr) { arr = []; state.inverted.set(t, arr); }
          arr.push(j);
        }
      }
      statusEl.textContent = `正在构建搜索索引… ${end}/${total}`;
      await new Promise(r => setTimeout(r, 0));
    }
  }
  function rebuildFilters() {
    const prevYear = filterYear.value;
    const prevType = filterType.value;
    const prevCountry = filterCountry.value;
    filterYear.innerHTML = '<option value="">全部年份</option>';
    filterType.innerHTML = '<option value="">全部类型</option>';
    filterCountry.innerHTML = '<option value="">全部国家</option>';
    const years = new Set(), types = new Set(), countries = new Set();
    state.allProjects.forEach(rec => {
      if (rec.year) years.add(String(rec.year).trim());
      const t = Array.isArray(rec.type) ? rec.type : (rec.type ? [rec.type] : []);
      t.forEach(x => { if (x && String(x).trim()) types.add(String(x).trim()); });
      if (rec.nationalGroup) {
        const c = String(rec.nationalGroup).trim();
        if (c) countries.add(c);
      }
    });
    [...years].sort((a, b) => String(b).localeCompare(String(a), 'zh')).forEach(y => {
      const o = document.createElement('option'); o.value = y; o.textContent = y; filterYear.appendChild(o);
    });
    [...types].sort((a, b) => String(a).localeCompare(String(b), 'zh')).forEach(t => {
      const o = document.createElement('option'); o.value = t; o.textContent = t; filterType.appendChild(o);
    });
    [...countries].sort((a, b) => String(a).localeCompare(String(b), 'en')).forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c; filterCountry.appendChild(o);
    });
    if (prevYear && years.has(prevYear)) filterYear.value = prevYear;
    if (prevType && types.has(prevType)) filterType.value = prevType;
    if (prevCountry && countries.has(prevCountry)) filterCountry.value = prevCountry;
  }
  function syncUrl() {
    const params = new URLSearchParams();
    if (state.view === 'search') {
      const q = searchInput.value.trim();
      if (q) params.set('q', q);
      if (filterYear.value) params.set('year', filterYear.value);
      if (filterType.value) params.set('type', filterType.value);
      if (filterCountry.value) params.set('country', filterCountry.value);
      if (state.filterDesigner) params.set('designer', state.filterDesigner);
    } else if (state.view === 'favorites') {
      params.set('view', 'favorites');
    } else if (state.view === 'discover') {
      params.set('view', 'discover');
    } else if (state.view === 'about') {
      params.set('view', 'about');
    } else if (state.view === 'all' && state.homeFilterType && state.homeFilterValue) {
      params.set('hf', `${state.homeFilterType}:${state.homeFilterValue}`);
    }
    const qs = params.toString();
    const url = location.pathname + (qs ? '?' + qs : '') + location.hash;
    try {
      history.replaceState(null, '', url);
    } catch (e) {
    }
  }
  function restoreFromUrl() {
    const params = new URLSearchParams(location.search);
    const view = params.get('view');
    const q = params.get('q'), year = params.get('year'), type = params.get('type');
    const country = params.get('country');
    const designer = params.get('designer');
    const hf = params.get('hf');
    if (view === 'favorites') { enterFavorites(); return; }
    if (view === 'discover') { enterDiscover(); return; }
    if (view === 'about') { enterAbout(); return; }
    if (hf && !view) {
      const idx = hf.indexOf(':');
      if (idx > 0) {
        const ft = hf.slice(0, idx);
        const fv = hf.slice(idx + 1);
        if (ft && fv) {
          state.homeFilterType = ft;
          state.homeFilterValue = fv;
          rebuildHomeQueue();
          statusEl.textContent = '正在加载…';
          return;
        }
      }
    }
    if (q || year || type || country || designer) {
      enterSearch({ focus: false });  
      if (year) filterYear.value = year;
      if (type) filterType.value = type;
      if (country) filterCountry.value = country;
      if (designer) { state.filterDesigner = designer; updateDesignerChip(); }
      searchInput.value = q || '';
      updateSearchClear();
      doSearch(q || '');
    }
  }
  function computeColumnCount(innerWidth, gap) {
    const vw = window.innerWidth;
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    if (isPortrait && vw <= PHONE_PORTRAIT_MAX) return 2;
    let n = Math.floor((innerWidth + gap) / (MIN_COL + gap));
    n = Math.max(2, Math.min(n, MAX_COLS));
    if (!isPortrait && vw <= PHONE_LANDSCAPE_MAX) n = Math.max(3, n);
    return n;
  }
  function computeLoadConfig(cols, isPhonePortrait) {
    if (cols <= 3) return { chunksPerBatch: 1, rootMargin: isPhonePortrait ? 600 : 800, maxCards: 200 };
    return { chunksPerBatch: 2, rootMargin: 1000, maxCards: 400 };
  }
  function layoutCards(cards) {
    gallery.classList.add('js-ready');
    if (state.cardIO) state.cardIO.disconnect();
    gallery.innerHTML = '';
    state.columns = [];
    state.columnHeights = [];
    const style = getComputedStyle(gallery);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const gap = parseFloat(style.columnGap) || parseFloat(style.gap) || 16;
    let innerWidth = gallery.clientWidth - paddingX;
    if (!innerWidth || innerWidth <= 0) innerWidth = window.innerWidth - paddingX;
    if (!innerWidth || innerWidth <= 0) return false;
    const vw = window.innerWidth;
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    const isPhonePortrait = isPortrait && vw <= PHONE_PORTRAIT_MAX;
    const count = computeColumnCount(innerWidth, gap);
    state.currentColCount = count;
    state.gap = gap;
    state.colWidth = (innerWidth - gap * (count - 1)) / count;
    for (let i = 0; i < count; i++) {
      const col = document.createElement('div');
      col.className = 'col';
      gallery.appendChild(col);
      state.columns.push(col);
      state.columnHeights.push(0);
    }
    cards.forEach(card => appendCardToColumn(card));
    const config = computeLoadConfig(count, isPhonePortrait);
    state.chunksPerBatch = config.chunksPerBatch;
    state.maxCards = config.maxCards || state.maxCards;
    state.rootMargin = config.rootMargin;
    if (state.view === 'all') setupObserver();
    requestAnimationFrame(() => {
      for (let i = 0; i < state.columns.length; i++) {
        const h = state.columns[i].offsetHeight;
        if (h > 0) state.columnHeights[i] = h + state.gap;
      }
    });
    updateLoadMore();
    return true;
  }
  function setCards(cards) {
    state.cardQueue = cards.slice();
    state.dehydrated.clear();
    state.liveCount = state.cardQueue.reduce((n, c) => n + (c && c._img ? 1 : 0), 0);
    layoutCards(cards);
  }
  function appendCardToColumn(card) {
    if (!state.columns.length) {
      if (!layoutCards([]) || !state.columns.length) return;
    }
    const ratio = parseFloat(card.dataset.ratio) || 1;
    let minIdx = 0;
    for (let i = 1; i < state.columnHeights.length; i++) {
      if (state.columnHeights[i] < state.columnHeights[minIdx]) minIdx = i;
    }
    state.columns[minIdx].appendChild(card);
    card.dataset.colIndex = String(minIdx);
    state.columnHeights[minIdx] += state.colWidth * ratio + HEADER_EST + state.gap;
    if (!state.cardIO) setupCardObserver();
    state.cardIO.observe(card);
  }
  function removeCard(card) {
    if (!card || !card.isConnected) return;
    if (state.cardIO) state.cardIO.unobserve(card);
    const idx = state.cardQueue.indexOf(card);
    if (idx >= 0) state.cardQueue.splice(idx, 1);
    state.dehydrated.delete(card);
    if (card._img) { card._img = null; state.liveCount = Math.max(0, state.liveCount - 1); }
    const colIdx = parseInt(card.dataset.colIndex, 10);
    if (!Number.isNaN(colIdx) && state.columnHeights[colIdx] != null) {
      const realH = card.offsetHeight;
      if (realH > 0) {
        state.columnHeights[colIdx] = Math.max(0, state.columnHeights[colIdx] - (realH + state.gap));
      } else {
        const ratio = parseFloat(card.dataset.ratio) || 1;
        state.columnHeights[colIdx] = Math.max(
          0,
          state.columnHeights[colIdx] - (state.colWidth * ratio + HEADER_EST + state.gap)
        );
      }
    }
    card.remove();
  }
  function createCard(item) {
    const record = item && item.record;
    if (!record) return null;
    const cover = item.cover || {};
    const image = cover.image || {};
    const coverIndex = cover.index || 0;
    if (!hasUsableImage(image)) return null;
    const article = document.createElement('article');
    article.className = 'card';
    article.dataset.id = record.id;
    article.setAttribute('tabindex', '0');
    article.setAttribute('role', 'button');
    article.setAttribute('aria-label', (record.title || '查看图片') + '，按回车打开详情');
    const w = parseInt(image.width, 10) || 2000;
    const h = parseInt(image.height, 10) || 1500;
    article.dataset.ratio = (h / w).toFixed(4);
    article._item = item;
    article._coverIndex = coverIndex;
    article._img = null;
    article._imgFailed = false;
    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-img-wrap';
    imgWrap.style.setProperty('--ratio', (h / w) * 100 + '%');
    article._imgWrap = imgWrap;
    const body = document.createElement('div');
    body.className = 'card-body';
    const h2 = document.createElement('h2');
    if (state.currentTerms && state.currentTerms.length) {
      h2.innerHTML = highlightHtml(record.title || '无标题', state.currentTerms);
    } else {
      h2.textContent = record.title || '无标题';
    }
    body.appendChild(h2);
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const sp1 = document.createElement('span');
    sp1.textContent = record.designer || 'Unknown';
    sp1.title = sp1.textContent;
    const sp2 = document.createElement('span');
    sp2.textContent = record.year || '';
    meta.appendChild(sp1);
    meta.appendChild(sp2);
    body.appendChild(meta);
    article.appendChild(imgWrap);
    article.appendChild(body);
    materializeCard(article);
    if (article._imgFailed) return null;
    article.addEventListener('click', () => openLightbox(record, coverIndex));
    article.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(record, coverIndex);
      }
    });
    return article;
  }
  function materializeCard(card) {
    if (!card || card._img || card._imgFailed) return;
    const item = card._item;
    if (!item) return;
    const image = (item.cover && item.cover.image) || {};
    const urlSmall = resolveUrl(image.small);
    const urlLarge = resolveUrl(image.large);
    const urlOrig  = resolveUrl(image.url);
    const primaryUrl = urlSmall || urlLarge || urlOrig;
    if (!primaryUrl) {
      card._imgFailed = true;
      removeCard(card);
      return;
    }
    const img = document.createElement('img');
    img.alt = item.record.title || '图片';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onload = () => img.classList.add('loaded');
    img.onerror = () => {
      if (card._img && card._img !== img) return;
      card._imgFailed = true;
      img.remove();
      if (card._img === img) card._img = null;
      state.liveCount = Math.max(0, state.liveCount - 1);
      removeCard(card);
    };
    img.src = primaryUrl;
    if (img.complete && img.naturalWidth > 0) img.classList.add('loaded');
    card._imgWrap.appendChild(img);
    card._img = img;
    state.liveCount++;
    state.dehydrated.delete(card);
  }
  function dematerializeCard(card) {
    if (!card || !card._img) return;
    card._img.onload = null;
    card._img.onerror = null;
    card._img.remove();
    card._img = null;
    state.liveCount = Math.max(0, state.liveCount - 1);
    state.dehydrated.add(card);
  }
  function setupCardObserver() {
    if (state.cardIO) return;
    state.cardIO = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const card = entry.target;
        if (entry.isIntersecting) materializeCard(card);
        else dematerializeCard(card);
      }
    }, { rootMargin: '800px 0px' });
  }

  function renderItemsChunked(items) {
    return new Promise(resolve => {
      let i = 0, success = 0;
      const CHUNK = 10;
      if (!items.length) { resolve(0); return; }
      const step = () => {
        const end = Math.min(i + CHUNK, items.length);
        for (; i < end; i++) {
          const card = createCard(items[i]);
          if (!card) continue;
          state.cardQueue.push(card);
          appendCardToColumn(card);
          success++;
        }
        for (let c = 0; c < state.columns.length; c++) {
          const h = state.columns[c].offsetHeight;
          if (h > 0) state.columnHeights[c] = h + state.gap;
        }
        if (i < items.length) requestAnimationFrame(step);
        else resolve(success);
      };
      requestAnimationFrame(step);
    });
  }
  async function loadNextBatch() {
    if (state.view !== 'all' || state.loading || state.finished) return;

    if (state.currentIndex >= state.loadQueue.length) { state.finished = true; updateStatus(); return; }

    state.loading = true;
    updateStatus('渲染中…');
    updateLoadMore();
    await new Promise(r => setTimeout(r, 16));

    if (state.view !== 'all') { state.loading = false; updateLoadMore(); return; }

    if (!state.columns.length) {
      if (!layoutCards([]) || !state.columns.length) {
        state.loading = false;
        updateStatus('布局初始化失败，请刷新页面');
        return;
      }
    }
    const batchSize = state.chunksPerBatch * CHUNK_SIZE;

    let nextItems;
    if (state.currentIndex > 0) {
      const remaining = state.loadQueue.slice(state.currentIndex);
      const shuffledRemaining = shuffleArray(remaining);
      state.loadQueue = state.loadQueue.slice(0, state.currentIndex).concat(shuffledRemaining);
      nextItems = state.loadQueue.slice(state.currentIndex, state.currentIndex + batchSize);
    } else {
      nextItems = state.loadQueue.slice(0, batchSize);
    }
    state.currentIndex += nextItems.length;

    const added = await renderItemsChunked(nextItems);
    state.totalLoaded += added;
    state.loading = false;
    if (!state.homeFilterType && !state.homeFilterValue) {
      saveHomeOrderSeed(state.loadQueue);
    }
    updateStatus();
    if (!state.finished) requestAnimationFrame(checkSentinel);
  }

  function checkSentinel() {
    const rect = sentinel.getBoundingClientRect();
    if (rect.top < window.innerHeight + state.rootMargin) loadNextBatch();
  }
  function updateStatus(text) {
    if (text) { statusEl.textContent = text; updateLoadMore(); return; }
    if (state.view === 'search') {
      if (state.searchTotal > 0) {
        const more = state.searchShown < state.searchTotal ? ' · 可继续加载' : '';
        statusEl.textContent = `找到 ${state.searchTotal} 个匹配「${state.searchDesc}」的项目 · 已显示 ${state.searchShown}${more}`;
      }
      updateLoadMore(); return;
    }
    if (state.view === 'favorites') { updateLoadMore(); return; }
    const remain = Math.max(0, state.loadQueue.length - state.currentIndex);
    if (state.finished) statusEl.textContent = `已加载全部 ${state.totalLoaded} 个项目`;
    else statusEl.textContent = `已渲染 ${state.totalLoaded} 个项目 · 剩余约 ${remain} 个 · 滚动加载更多`;
    updateLoadMore();
  }
  function updateLoadMore() {
    let show = false, label = '加载更多';
    if (state.view === 'all') {
      show = !state.finished;
    } else if (state.view === 'search') {
      show = state.searchResults.length > state.searchShown;
      label = '加载更多结果';
    }
    loadMoreWrap.style.display = show ? 'block' : 'none';
    loadMoreBtn.disabled = state.loading;
    loadMoreBtn.textContent = state.loading ? '加载中…' : label;
  }
  function setupObserver() {
    if (state.io && state.ioRootMargin === state.rootMargin) return;
    if (state.io) state.io.disconnect();
    state.ioRootMargin = state.rootMargin;
    state.io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) loadNextBatch();
    }, { rootMargin: state.rootMargin + 'px 0px' });
    state.io.observe(sentinel);
  }
  function clearGalleryForSearch() {
    if (state.cardIO) state.cardIO.disconnect();
    gallery.innerHTML = '';
    gallery.classList.remove('js-ready');
    state.columns = [];
    state.columnHeights = [];
    state.cardQueue = [];
    state.dehydrated.clear();
    state.liveCount = 0;
  }
  function enterDiscover() {
    if (state.view === 'discover') return;
    exitPageViews();
    closePill();
    if (state.view === 'all') state.allCards = state.cardQueue.slice();
    if (state.view === 'search') {
      document.body.classList.remove('searching');
      searchInput.value = '';
      updateSearchClear();
      filterYear.value = '';
      filterType.value = '';
      filterCountry.value = '';
      state.filterDesigner = '';
      updateDesignerChip();
      state.currentTerms = [];
      state.searchResults = [];
      state.searchShown = 0;
      state.searchTotal = 0;
      clearTimeout(state.searchTimer);
      state.savedCards = [];
    }
    state.view = 'discover';
    document.body.classList.add('view-discover');
    const dv = document.getElementById('discoverView');
    dv.hidden = false;
    if (!state.discoverRendered) {
      renderDiscover();
      state.discoverRendered = true;
    }
    syncUrl();
  }

  function renderDiscover() {
    const total = state.allProjects.length;
    const designerMap = new Map();
    const countryMap = new Map();
    const typeMap = new Map();
    const sectorMap = new Map();
    state.allProjects.forEach(rec => {
      if (rec.designer) {
        const n = String(rec.designer).trim();
        if (n) designerMap.set(n, (designerMap.get(n) || 0) + 1);
      }
      const c = String(rec.nationalGroup || '').trim();
      if (c) countryMap.set(c, (countryMap.get(c) || 0) + 1);
      const types = Array.isArray(rec.type) ? rec.type : (rec.type ? [rec.type] : []);
      types.forEach(x => {
        const v = String(x || '').trim();
        if (v) typeMap.set(v, (typeMap.get(v) || 0) + 1);
      });
      const sectors = Array.isArray(rec.sector) ? rec.sector : (rec.sector ? [rec.sector] : []);
      sectors.forEach(x => {
        const v = String(x || '').trim();
        if (v) sectorMap.set(v, (sectorMap.get(v) || 0) + 1);
      });
    });
    document.getElementById('discoverStats').textContent =
      `${total} 个项目 · ${designerMap.size} 位设计师 · ${countryMap.size} 个国家 · ${typeMap.size} 种类型 · ${sectorMap.size} 个领域`;

    renderChips('discoverCountryChips', countryMap, 'country', (a, b) => a.localeCompare(b, 'en'));
    renderChips('discoverTypeChips', typeMap, 'type', (a, b) => a.localeCompare(b, 'zh'));
    renderChips('discoverSectorChips', sectorMap, 'sector', (a, b) => a.localeCompare(b, 'zh'));
    const groups = new Map();
    [...designerMap.entries()].forEach(([name, count]) => {
      const first = name.charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : '#';
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter).push({ name, count });
    });
    const letters = [...groups.keys()].sort();

    const az = document.getElementById('designerAZ');
    az.innerHTML = '';

    const nav = document.createElement('div');
    nav.className = 'az-letters';
    letters.forEach(L => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = L;
      btn.addEventListener('click', () => {
        const target = az.querySelector(`[data-letter="${L}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.appendChild(btn);
    });
    az.appendChild(nav);

    letters.forEach(L => {
      const sec = document.createElement('section');
      sec.className = 'az-group';
      sec.dataset.letter = L;
      const h = document.createElement('h3');
      h.textContent = L;
      sec.appendChild(h);
      const list = document.createElement('div');
      list.className = 'az-list';
      groups.get(L).sort((a, b) => a.name.localeCompare(b.name)).forEach(d => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'az-item';
        const nameEl = document.createElement('span');
        nameEl.className = 'az-name';
        nameEl.textContent = d.name;
        const countEl = document.createElement('span');
        countEl.className = 'az-count';
        countEl.textContent = d.count;
        btn.appendChild(nameEl);
        btn.appendChild(countEl);
        btn.addEventListener('click', () => showFilterInHome('designer', d.name));
        list.appendChild(btn);
      });
      sec.appendChild(list);
      az.appendChild(sec);
    });
  }
  function renderChips(containerId, map, filterType, sorter) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!map.size) {
      wrap.textContent = '暂无数据';
      return;
    }
    [...map.entries()].sort((a, b) => sorter(a[0], b[0])).forEach(([name, count]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'discover-chip';
      const nameEl = document.createElement('span');
      nameEl.textContent = name;
      const countEl = document.createElement('span');
      countEl.className = 'discover-chip-count';
      countEl.textContent = count;
      btn.appendChild(nameEl);
      btn.appendChild(countEl);
      btn.addEventListener('click', () => showFilterInHome(filterType, name));
      wrap.appendChild(btn);
    });
  }
  function enterAbout() {
    if (state.view === 'about') return;
    exitPageViews();
    closePill();
    if (state.view === 'all') state.allCards = state.cardQueue.slice();
    if (state.view === 'search') {
      document.body.classList.remove('searching');
      searchInput.value = '';
      updateSearchClear();
      filterYear.value = '';
      filterType.value = '';
      filterCountry.value = '';
      state.filterDesigner = '';
      updateDesignerChip();
      state.currentTerms = [];
      state.searchResults = [];
      state.searchShown = 0;
      state.searchTotal = 0;
      clearTimeout(state.searchTimer);
      state.savedCards = [];
    }
    state.view = 'about';
    document.body.classList.add('view-about');
    const av = document.getElementById('aboutView');
    av.hidden = false;
    renderAbout();
    syncUrl();
  }
  function computeAboutStats() {
    const total = state.allProjects.length;
    const designers = new Set();
    const countries = new Set();
    let minY = Infinity, maxY = -Infinity;
    state.allProjects.forEach(rec => {
      if (rec.designer) designers.add(String(rec.designer).trim());
      if (rec.nationalGroup) countries.add(String(rec.nationalGroup).trim());
      const y = parseInt(rec.year, 10);
      if (!isNaN(y)) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
    });
    const span = (minY !== Infinity && maxY !== -Infinity) ? `${minY}–${maxY}` : '-';
    state.aboutStats = `共 ${total} 个项目 · ${designers.size} 位设计师 · 覆盖 ${countries.size} 个国家 · 年份跨度 ${span}`;
  }

  function renderAbout() {
    document.getElementById('aboutStats').textContent = state.aboutStats || '统计中…';
  }
  function enterSearch(preset) {
    if (state.view === 'search') return;
    exitPageViews();
    closePill();
    state.savedView = state.view;
    state.savedCards = state.view === 'all' ? state.cardQueue.slice() : [];
    if (state.view === 'all') state.allCards = state.cardQueue.slice();
    state.view = 'search';
    state.currentTerms = [];
    document.body.classList.add('searching');
    clearGalleryForSearch();
    state.searchResults = [];
    state.searchShown = 0;
    state.searchTotal = 0;
    statusEl.textContent = '输入关键词或选择筛选条件';
    searchInput.value = '';
    updateSearchClear();
    filterYear.value = '';
    filterType.value = '';
    filterCountry.value = '';
    state.filterDesigner = '';
    updateDesignerChip();

    if (preset) {
      if (preset.year) filterYear.value = preset.year;
      if (preset.type) filterType.value = preset.type;
      if (preset.country) filterCountry.value = preset.country;
      if (preset.designer) {
        state.filterDesigner = preset.designer;
        updateDesignerChip();
      }
      if (preset.q) {
        searchInput.value = preset.q;
        updateSearchClear();
      }
    }

    if (!preset || preset.focus !== false) {
      searchInput.focus({ preventScroll: true });
    }

    updateLoadMore();
    syncUrl();

    if (preset && (preset.q || preset.year || preset.type || preset.country || preset.designer)) {
      doSearch(preset.q || '');
    }
  }

  function exitSearch() {
    if (state.view !== 'search') return;
    const prevView = state.savedView;
    document.body.classList.remove('searching');
    clearTimeout(state.searchTimer);
    searchInput.value = '';
    filterYear.value = '';
    filterType.value = '';
    filterCountry.value = '';
    state.filterDesigner = '';
    updateDesignerChip();
    state.currentTerms = [];
    state.searchResults = [];
    state.searchShown = 0;
    state.searchTotal = 0;

    if (prevView === 'favorites') {
      state.savedCards = [];
      state.view = 'all';
      syncUrl();
      enterFavorites();
      return;
    }
    if (prevView === 'discover') {
      state.savedCards = [];
      state.view = 'all';
      if (state.allCards.length) setCards(state.allCards);
      syncUrl();
      enterDiscover();
      return;
    }
    if (prevView === 'about') {
      state.savedCards = [];
      state.view = 'all';
      if (state.allCards.length) setCards(state.allCards);
      syncUrl();
      enterAbout();
      return;
    }

    state.view = 'all';
    const saved = state.savedCards.length ? state.savedCards : state.cardQueue.slice();
    state.savedCards = [];
    setCards(saved);
    updateStatus();
    syncUrl();
    setupObserver();
    requestAnimationFrame(checkSentinel);
    requestAnimationFrame(() => updateSearchClear());
  }

  function lookupInverted(term) {
    if (!/^[a-z0-9]+$/.test(term) || term.length < 2) return null;
    return state.inverted.get(term) || null;
  }

  function doSearch(keyword) {
    const q = (keyword || '').trim().toLowerCase();
    const yearFilter = filterYear.value;
    const typeFilter = filterType.value;
    const countryFilter = filterCountry.value;
    const designerFilter = state.filterDesigner;
    const hasQuery = q.length > 0;
    const hasFilter = !!yearFilter || !!typeFilter || !!countryFilter || !!designerFilter;

    state.currentTerms = hasQuery ? q.split(/\s+/).filter(Boolean) : [];

    if (!hasQuery && !hasFilter) {
      clearGalleryForSearch();
      state.searchResults = [];
      state.searchShown = 0;
      state.searchTotal = 0;
      statusEl.textContent = '输入关键词或选择筛选条件';
      syncUrl();
      updateLoadMore();
      return;
    }

    const terms = state.currentTerms;
    let candidates = null;
    if (terms.length) {
      const lists = [];
      let allIndexed = true;
      for (const term of terms) {
        const inv = lookupInverted(term);
        if (!inv) { allIndexed = false; break; }
        lists.push(inv);
      }
      if (allIndexed && lists.length) {
        lists.sort((a, b) => a.length - b.length);
        candidates = lists[0].slice();
        for (let i = 1; i < lists.length && candidates.length; i++) {
          candidates = filterBySet(candidates, lists[i]);
        }
      }
    }

    const matched = [];
    const testRecord = (i) => {
      const item = state.searchIndex[i];
      if (!item) return;
      const rec = item.record;
      if (terms.length) {
        const hay = item.haystack;
        for (let t = 0; t < terms.length; t++) if (hay.indexOf(terms[t]) === -1) return;
      }
      if (yearFilter && String(rec.year || '').trim() !== yearFilter) return;
      if (typeFilter) {
        const t = Array.isArray(rec.type) ? rec.type : (rec.type ? [rec.type] : []);
        if (!t.map(x => String(x).trim()).includes(typeFilter)) return;
      }
      if (countryFilter && String(rec.nationalGroup || '').trim() !== countryFilter) return;
      if (designerFilter && String(rec.designer || '').trim() !== designerFilter) return;
      matched.push(rec);
    };

    if (candidates) {
      for (let i = 0; i < candidates.length; i++) testRecord(candidates[i]);
    } else {
      for (let i = 0; i < state.searchIndex.length; i++) testRecord(i);
    }

    state.searchResults = matched;
    state.searchTotal = matched.length;
    state.searchDesc = [q, yearFilter, typeFilter, countryFilter, designerFilter].filter(Boolean).join(' · ');
    state.searchShown = 0;
    clearGalleryForSearch();
    showSearchResults(true);
    syncUrl();
  }

  function showSearchResults(reset) {
    if (reset) {
      clearGalleryForSearch();
      state.searchShown = 0;
    }
    if (!state.searchResults.length) {
      statusEl.textContent = '未找到匹配的项目';
      updateLoadMore();
      return;
    }
    const next = state.searchResults.slice(state.searchShown, state.searchShown + SEARCH_PAGE);
    if (!next.length) { updateStatus(); return; }

    const cards = [];
    next.forEach(rec => {
      const cover = findCoverImage(rec);
      if (!cover) return;
      const card = createCard({ record: rec, cover });
      if (card) cards.push(card);
    });
    state.searchShown += next.length;

    if (reset) {
      setCards(cards);
    } else {
      cards.forEach(c => { state.cardQueue.push(c); appendCardToColumn(c); });
    }

    if (!cards.length && reset) {
      statusEl.textContent = `找到 ${state.searchTotal} 个匹配项目，但没有可用图片`;
      updateLoadMore();
      return;
    }
    updateStatus();
  }
  function enterFavorites() {
    closePill();
    exitPageViews();
    if (state.view === 'favorites') return;
    if (state.view === 'all') state.allCards = state.cardQueue.slice();
    if (state.view === 'search') {
      document.body.classList.remove('searching');
      searchInput.value = '';
      updateSearchClear();
      filterYear.value = '';
      filterType.value = '';
      filterCountry.value = '';
      state.filterDesigner = '';
      updateDesignerChip();
      state.currentTerms = [];
      state.searchResults = [];
      state.searchShown = 0;
      state.searchTotal = 0;
      clearTimeout(state.searchTimer);
      state.savedCards = [];
    }
    state.view = 'favorites';
    state.currentTerms = [];
    syncUrl();
    renderFavorites();
  }

  function renderFavorites() {
    const favRecords = [];
    state.favorites.forEach(id => {
      const rec = state.recordById.get(String(id));
      if (rec) favRecords.push(rec);
    });

    const cards = [];
    favRecords.forEach(rec => {
      const cover = findCoverImage(rec);
      if (!cover) return;
      const card = createCard({ record: rec, cover });
      if (card) cards.push(card);
    });

    if (!cards.length) {
      clearGalleryForSearch();
      statusEl.textContent = '暂无收藏，点击灯箱左上角 ♥ 收藏';
      updateLoadMore();
      return;
    }

    setCards(cards);
    statusEl.textContent = `收藏夹：${favRecords.length} 个项目`;
  }
  function goHome() {
    closePill();
    exitPageViews();
    if (state.view === 'search') { exitSearch(); return; }
    if (state.view === 'discover' || state.view === 'about') {
      state.view = 'all';
      document.body.classList.remove('searching');
      const cards = state.allCards.length ? state.allCards : state.cardQueue.slice();
      if (cards.length) {
        setCards(cards);
        updateStatus();
        setupObserver();
        requestAnimationFrame(checkSentinel);
      } else {
        if (state.homeFilterType && state.homeFilterValue) rebuildHomeQueue();
        updateStatus();
        setupObserver();
        requestAnimationFrame(() => loadNextBatch());
      }
      syncUrl();
      return;
    }
    if (state.view === 'favorites') {
      state.view = 'all';
      state.currentTerms = [];
      const cards = state.allCards.length ? state.allCards : state.cardQueue.slice();
      setCards(cards);
      updateStatus();
      syncUrl();
      setupObserver();
      requestAnimationFrame(checkSentinel);
    }
  }

  function resetToHome() {
    closePill();
    exitPageViews();

    document.body.classList.remove('searching');
    clearTimeout(state.searchTimer);
    searchInput.value = '';
    updateSearchClear();
    filterYear.value = '';
    filterType.value = '';
    filterCountry.value = '';
    state.filterDesigner = '';
    updateDesignerChip();
    state.currentTerms = [];
    state.searchResults = [];
    state.searchShown = 0;
    state.searchTotal = 0;
    state.savedCards = [];
    state.allCards = [];

    state.homeFilterType = '';
    state.homeFilterValue = '';

    state.view = 'all';
    rebuildHomeQueue();
    clearGalleryForSearch();
    syncUrl();

    if (!state.loadQueue.length) {
      statusEl.textContent = '数据中没有可用的图片';
      updateLoadMore();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    updateStatus('正在加载…');
    setupObserver();
    requestAnimationFrame(() => loadNextBatch());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  let resizeTimer;
  function scheduleRelayout() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const style = getComputedStyle(gallery);
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const gap = parseFloat(style.columnGap) || parseFloat(style.gap) || 16;
      let innerWidth = gallery.clientWidth - paddingX;
      if (!innerWidth || innerWidth <= 0) innerWidth = window.innerWidth - paddingX;
      const newColCount = computeColumnCount(innerWidth, gap);

      if (state.view === 'search') {
        if (newColCount !== state.currentColCount) {
          const cards = state.cardQueue.slice();
          if (cards.length) layoutCards(cards);
        }
        return;
      }
      if (state.view === 'favorites') {
        if (newColCount !== state.currentColCount) {
          const cards = state.cardQueue.slice();
          if (cards.length) layoutCards(cards);
        }
        return;
      }
      if (state.view === 'discover' || state.view === 'about') return;

      const cards = state.cardQueue.slice();
      if (!cards.length) return;
      if (newColCount !== state.currentColCount) {
        layoutCards(cards);
        if (!state.finished && !state.loading) requestAnimationFrame(checkSentinel);
      }
    }, 200);
  }

  /* ---------- 药丸菜单 ---------- */

  const PILL_AUTO_CLOSE_MS = 6000;
  let pillAutoCloseTimer = null;

  function openPill() {
    document.body.classList.add('pill-open');
    pillMenu.setAttribute('aria-hidden', 'false');
    clearTimeout(pillAutoCloseTimer);
    pillAutoCloseTimer = setTimeout(() => {
      closePill();
    }, PILL_AUTO_CLOSE_MS);
  }
  function closePill() {
    document.body.classList.remove('pill-open');
    pillMenu.setAttribute('aria-hidden', 'true');
    clearTimeout(pillAutoCloseTimer);
    pillAutoCloseTimer = null;
  }
  function togglePill() {
    if (document.body.classList.contains('pill-open')) closePill();
    else openPill();
  }

  function setBackgroundInert(on) {
    const els = [
      document.querySelector('.topbar'),
      document.querySelector('.search-filter-bar'),
      document.querySelector('.pill-menu'),
      gallery, statusEl, loadMoreWrap,
      document.getElementById('discoverView'),
      document.getElementById('aboutView')
    ];
    els.forEach(el => {
      if (!el) return;
      if (on) {
        el.setAttribute('aria-hidden', 'true');
        try { el.setAttribute('inert', ''); } catch (_) {}
      } else {
        el.removeAttribute('aria-hidden');
        try { el.removeAttribute('inert'); } catch (_) {}
      }
    });
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const nodes = lightbox.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
    const list = [...nodes].filter(el => el.offsetParent !== null && !el.disabled);
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function loadLbImage(entry) {
    if (!entry || entry.loaded) return;
    entry.loaded = true;

    const urlOrig = resolveUrl(entry.data.url);
    const urlFallback = resolveUrl(entry.data.large) || resolveUrl(entry.data.small);
    const primary = urlOrig || urlFallback;

    if (!primary) { entry.wrap.style.display = 'none'; return; }

    entry.img.onerror = () => {
      if (entry.img.dataset.fallback === '1') {
        entry.wrap.style.display = 'none';
        return;
      }
      entry.img.dataset.fallback = '1';
      if (urlFallback && entry.img.src !== urlFallback) {
        entry.img.src = urlFallback;
        return;
      }
      entry.wrap.style.display = 'none';
    };

    entry.img.src = primary;
  }

  function setupLbLazyLoad() {
    if (state.lbIO) state.lbIO.disconnect();
    state.lbIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const idx = state.lbImages.findIndex(x => x.wrap === e.target);
        if (idx >= 0) loadLbImage(state.lbImages[idx]);
        state.lbIO.unobserve(e.target);
      });
    }, { root: lightbox, rootMargin: '600px 0px' });
    state.lbImages.forEach(entry => { if (!entry.loaded) state.lbIO.observe(entry.wrap); });
  }

  function updateLbCount() {
    const n = state.lbImages.length;
    lbCount.textContent = n ? `${state.lbIndex + 1} / ${n}` : '';
  }

  function scrollToLightboxImage(index, smooth) {
    const entry = state.lbImages[index];
    if (!entry) { lightbox.scrollTop = 0; return; }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rect = entry.wrap.getBoundingClientRect();
    const lbRect = lightbox.getBoundingClientRect();
    const top = lightbox.scrollTop + (rect.top - lbRect.top) - 8;
    lightbox.scrollTo({ top: Math.max(0, top), behavior: (smooth && !reduced) ? 'smooth' : 'auto' });
  }

  function syncLbIndexFromScroll() {
    if (!state.lbImages.length) return;
    const lbTop = lightbox.getBoundingClientRect().top;
    let best = 0, bestD = Infinity;
    state.lbImages.forEach((e, i) => {
      const r = e.wrap.getBoundingClientRect();
      const d = Math.abs(r.top - lbTop - 8);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best !== state.lbIndex) {
      state.lbIndex = best;
      updateLbCount();
    }
  }

  function attachZoom(wrap, img) {
    const MIN = 1, MAX = 4;
    let scale = 1, tx = 0, ty = 0;
    const pointers = new Map();
    let pinchStartDist = 0, pinchStartScale = 1;
    let panStart = null;
    let lastTap = 0;

    function clampPan() {
      const maxX = Math.max(0, (wrap.clientWidth * (scale - 1)) / 2);
      const maxY = Math.max(0, (wrap.clientHeight * (scale - 1)) / 2);
      tx = Math.max(-maxX, Math.min(maxX, tx));
      ty = Math.max(-maxY, Math.min(maxY, ty));
    }
    function apply() {
      if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; }
      img.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
      img.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
      wrap.style.touchAction = scale > 1 ? 'none' : 'pan-y';
    }

    wrap.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
      if (pointers.size === 1) {
        panStart = { x: e.clientX - tx, y: e.clientY - ty };
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStartScale = scale;
        panStart = null;
        wrap.style.touchAction = 'none';
      }
    });

    wrap.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStartDist > 0) {
          scale = Math.max(MIN, Math.min(MAX, pinchStartScale * (d / pinchStartDist)));
          clampPan();
          apply();
        }
        e.preventDefault();
      } else if (pointers.size === 1 && panStart && scale > 1) {
        tx = e.clientX - panStart.x;
        ty = e.clientY - panStart.y;
        clampPan();
        apply();
        e.preventDefault();
      }
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStartDist = 0;
      if (pointers.size === 0) {
        panStart = null;
        const now = Date.now();
        if (now - lastTap < 300) {
          scale = scale > 1 ? 1 : 2.5;
          if (scale === 1) { tx = 0; ty = 0; }
          clampPan();
          apply();
        }
        lastTap = now;
      }
    }
    wrap.addEventListener('pointerup', endPointer);
    wrap.addEventListener('pointercancel', endPointer);
    apply();
  }

  function openLightbox(record, coverIndex) {
    state.currentLightboxId = String(record.id);
    state.lastFocus = document.activeElement;

    lbGallery.innerHTML = '';
    state.lbImages = [];
    if (state.lbIO) { state.lbIO.disconnect(); state.lbIO = null; }

    const images = Array.isArray(record.images) ? record.images : [];
    images.forEach((imgData, i) => {
      if (!hasUsableImage(imgData)) return;
      const e = expandImage(imgData);
      if (!hasUsableImage(e)) return;

      const wrap = document.createElement('div');
      wrap.className = 'lb-img-wrap';
      wrap.style.position = 'relative';
      wrap.style.width = '100%';
      wrap.style.overflow = 'hidden';
      wrap.style.background = 'var(--img-bg)';
      wrap.style.touchAction = 'pan-y';
      wrap.style.flex = '0 0 auto';
      const w = parseInt(e.width, 10);
      const h = parseInt(e.height, 10);
      wrap.style.aspectRatio = (w > 0 && h > 0) ? `${w} / ${h}` : '4 / 3';

      const img = document.createElement('img');
      img.alt = record.title || '';
      img.decoding = 'async';
      img.dataset.srcIndex = String(i);
      img.dataset.fallback = '';
      img.style.transformOrigin = 'center center';
      img.style.willChange = 'transform';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';

      wrap.appendChild(img);
      lbGallery.appendChild(wrap);

      const entry = { wrap, img, index: i, loaded: false, data: e };
      state.lbImages.push(entry);
      attachZoom(wrap, img);
    });

    state.lbImages.forEach((entry, idx) => { if (idx < 2) loadLbImage(entry); });
    setupLbLazyLoad();

    const startIdx = state.lbImages.findIndex(e => e.index === (parseInt(coverIndex, 10) || 0));
    state.lbIndex = startIdx >= 0 ? startIdx : 0;
    updateLbCount();

    const favActive = state.favorites.has(String(record.id));
    lbFav.classList.toggle('active', favActive);
    lbFav.setAttribute('aria-pressed', favActive ? 'true' : 'false');

    lbTitle.textContent = record.title || '无标题';

    const parts = [];
    if (record.designer) parts.push(record.designer);
    const country = String(record.nationalGroup || '').trim();
    if (country) parts.push(country);
    const yb = String(record.yearOfBirth || '').trim();
    if (yb) parts.push(`b. ${yb}`);
    lbDesigner.textContent = parts.length ? `设计师: ${parts.join(' · ')}` : '设计师: 未知';

    const types = Array.isArray(record.type) ? record.type.join(', ') : (record.type || '-');
    const sectors = Array.isArray(record.sector) ? record.sector.join(', ') : (record.sector || '-');

    lbMetaGrid.innerHTML = '';
    const addMeta = (label, value) => {
      const item = document.createElement('div'); item.className = 'lb-meta-item';
      const l = document.createElement('span'); l.className = 'lb-meta-label'; l.textContent = label;
      const v = document.createElement('span'); v.className = 'lb-meta-value'; v.textContent = value;
      item.appendChild(l); item.appendChild(v); lbMetaGrid.appendChild(item);
    };
    addMeta('年份', record.year || '-');
    addMeta('客户', record.client || '-');
    addMeta('类型', types);
    addMeta('领域', sectors);

    lbDetails.innerHTML = '';
    const detailsText = Array.isArray(record.details) ? record.details.join(', ') : (record.details || '');
    lbDetails.textContent = detailsText ? '详细分类: ' + detailsText : '';

    lbTags.innerHTML = '';
    const tags = Array.isArray(record.tags) ? record.tags.filter(Boolean) : [];
    tags.forEach(t => {
      const span = document.createElement('span');
      span.className = 'lb-tag';
      span.textContent = String(t);
      lbTags.appendChild(span);
    });

    lightbox.classList.add('open');
    document.body.classList.add('lightbox-open');
    lightbox.scrollTop = 0;
    setBackgroundInert(true);

    requestAnimationFrame(() => {
      scrollToLightboxImage(state.lbIndex, false);
      const closeBtn = lightbox.querySelector('.lightbox-close');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    });
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.classList.remove('lightbox-open');
    state.currentLightboxId = '';
    if (state.lbIO) { state.lbIO.disconnect(); state.lbIO = null; }
    setBackgroundInert(false);
    const prev = state.lastFocus;
    state.lastFocus = null;
    if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
      try { prev.focus({ preventScroll: true }); } catch (_) {}
    }
  }

  lbFav.addEventListener('click', e => {
    e.stopPropagation();
    if (!state.currentLightboxId) return;
    toggleFavorite(state.currentLightboxId);
  });

  lightbox.addEventListener('scroll', () => {
    clearTimeout(state.scrollSyncTimer);
    state.scrollSyncTimer = setTimeout(syncLbIndexFromScroll, 120);
  }, { passive: true });

  searchBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (state.view === 'search') exitSearch(); else enterSearch();
  });
  searchInput.addEventListener('input', () => {
    updateSearchClear();
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => { if (state.view === 'search') doSearch(searchInput.value); }, 300);
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); exitSearch(); }
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(state.searchTimer);
      if (state.view === 'search') doSearch(searchInput.value);
    }
  });
  searchClear.addEventListener('click', e => {
    e.stopPropagation();
    searchInput.value = '';
    updateSearchClear();
    searchInput.focus();
    if (state.view === 'search') {
      clearTimeout(state.searchTimer);
      doSearch('');
    }
  });

  filterYear.addEventListener('change', () => { if (state.view === 'search') doSearch(searchInput.value); });
  filterType.addEventListener('change', () => { if (state.view === 'search') doSearch(searchInput.value); });
  filterCountry.addEventListener('change', () => { if (state.view === 'search') doSearch(searchInput.value); });
  document.getElementById('clearFilters').addEventListener('click', () => {
    filterYear.value = ''; filterType.value = ''; filterCountry.value = '';
    state.filterDesigner = '';
    updateDesignerChip();
    if (state.view === 'search') doSearch(searchInput.value);
  });
  document.getElementById('designerChipClear').addEventListener('click', () => {
    state.filterDesigner = '';
    updateDesignerChip();
    if (state.view === 'search') doSearch(searchInput.value);
  });

  document.addEventListener('click', e => {
    if (state.view !== 'search') return;
    if (e.target.closest('.topbar, .search-filter-bar, .pill-menu, .lightbox, .card, .load-more-wrap, .status, #sentinel, .toast, button, a, input, select')) return;
    exitSearch();
  });

  hamburger.addEventListener('click', e => {
    e.stopPropagation();
    togglePill();
  });

  document.addEventListener('click', e => {
    if (!document.body.classList.contains('pill-open')) return;
    if (e.target.closest('#pillMenu') || e.target.closest('#hamburger')) return;
    closePill();
  });

  pillMenu.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const v = btn.dataset.view;
      closePill();
      if (v === 'discover') enterDiscover();
      else if (v === 'favorites') enterFavorites();
      else if (v === 'about') enterAbout();
    });
  });

  const logoCell = document.getElementById('logoCell');
  if (logoCell) {
    logoCell.addEventListener('click', e => { e.preventDefault(); resetToHome(); });
  }

  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    try { localStorage.setItem(THEME_KEY, cur); } catch (e) {}
    showToast(cur === 'dark' ? '已切换到深色模式' : '已切换到浅色模式');
  });

  document.addEventListener('keydown', e => {
    if (lightbox.classList.contains('open')) {
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); return; }
      trapFocus(e);
      return;
    }
    if (e.key === 'Escape') {
      if (document.body.classList.contains('pill-open')) closePill();
      else if (state.view === 'search') exitSearch();
    }
  });

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox || e.target.closest('.lightbox-close')) closeLightbox();
  });

  loadMoreBtn.addEventListener('click', () => {
    if (state.view === 'all') loadNextBatch();
    else if (state.view === 'search') showSearchResults(false);
  });

  window.addEventListener('resize', scheduleRelayout);
  const orientationMQ = window.matchMedia('(orientation: portrait)');
  if (orientationMQ.addEventListener) orientationMQ.addEventListener('change', scheduleRelayout);

  async function init() {
    loadFavorites();
    await initData();
    restoreFromUrl();
    setupObserver();
    updateLoadMore();
  }

  init();
})();