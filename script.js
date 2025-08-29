(function () {
  'use strict';

  const config = {
    sheetId: '1B0XPR4uSvRzy9LfzWDjNjwAyMZVtJs6_Kk_r2fh7dTw',
    sheets: {
      katalog: { name: 'Sheet3' },
      preorder: { name1: 'Sheet1', name2: 'Sheet2' },
      accounts: { name: 'Sheet5' },
    },
    waNumber: '6285877001999',
    fee: { QRIS: 0.01, Transfer: 0.004 }
  };

  const state = {
    mode: 'katalog',
    theme: 'light',
    katalog: { data: [], filtered: [], initialized: false },
    layanan: { categories: [], selectedKey: 'all' },
    preorder: {
      allData: [], filtered: [], displayMode: 'open',
      pageSize: 12, currentPage: 1, initialized: false
    },
    accounts: {
      data: [], filtered: [], selectedKey: 'all',
      currentIndex: 0, initialized: false
    }
  };

  const elements = {
    body: document.body,
    nav: {
      items: Array.from(document.querySelectorAll('.nav-item'))
    },
    sections: {
      home: document.getElementById('homeSection'),
      katalog: document.getElementById('katalogSection'),
      preorder: document.getElementById('preorderSection'),
      accounts: document.getElementById('accountsSection'),
      perpustakaan: document.getElementById('perpustakaanSection')
    },
    home: {
      searchInput: document.getElementById('homeSearchInput'),
      list: document.getElementById('homeList'),
    },
    katalog: {
      list: document.getElementById('katalogList'),
      total: document.getElementById('katalogTotal'),
      searchInput: document.getElementById('layananSearchInput'),
      customSelect: {
        wrapper: document.getElementById('layananCustomSelectWrapper'),
        btn: document.getElementById('layananCustomSelectBtn'),
        value: document.getElementById('layananCustomSelectValue'),
        options: document.getElementById('layananCustomSelectOptions'),
      },
    },
    preorder: {
      list: document.getElementById('preorderList'),
      listContainer: document.getElementById('preorderListContainer'),
      prevBtn: document.getElementById('preorderPrevBtn'),
      nextBtn: document.getElementById('preorderNextBtn'),
      pageInfo: document.getElementById('preorderPageInfo'),
      total: document.getElementById('preorderTotal'),
      customSelect: {
        wrapper: document.getElementById('preorderCustomSelectWrapper'),
        btn: document.getElementById('preorderCustomSelectBtn'),
        value: document.getElementById('preorderCustomSelectValue'),
        options: document.getElementById('preorderCustomSelectOptions'),
      },
    },
    accounts: {
      display: document.getElementById('accountDisplay'),
      empty: document.getElementById('accountEmpty'),
      title: document.getElementById('accountTitle'),
      desc: document.getElementById('accountDesc'),
      status: document.getElementById('accountStatus'),
      price: document.getElementById('accountPrice'),
      buyBtn: document.getElementById('buyAccountBtn'),
      offerBtn: document.getElementById('offerAccountBtn'),
      customSelect: {
        wrapper: document.getElementById('accountCustomSelectWrapper'),
        btn: document.getElementById('accountCustomSelectBtn'),
        value: document.getElementById('accountCustomSelectValue'),
        options: document.getElementById('accountCustomSelectOptions'),
      },
      carousel: {
        track: document.getElementById('carouselTrack'),
        indicators: document.getElementById('carouselIndicators'),
        prevBtn: document.getElementById('carouselPrevBtn'),
        nextBtn: document.getElementById('carouselNextBtn'),
      }
    },
    templates: {
      itemTemplate: document.getElementById('listItemTemplate'),
      skeletonItemTemplate: document.getElementById('skeletonItemTemplate'),
    },
    modal: {
      overlay: document.getElementById('paymentModal'),
      itemName: document.getElementById('modalItemName'),
      price: document.getElementById('modalPrice'),
      fee: document.getElementById('modalFee'),
      total: document.getElementById('modalTotal'),
      closeBtn: document.getElementById('closeModalBtn'),
      continueBtn: document.getElementById('continueToWaBtn'),
      payQris: document.getElementById('payQris'),
      payTf: document.getElementById('payTf'),
    },
    toggles: {
      theme: document.getElementById('themeToggleBtn'),
      burger: document.getElementById('burgerBtn'),
    }
  };

  function safeId(s) { return String(s).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, ''); }
  function formatToIdr(n) { if (isNaN(Number(n))) return 'Rp 0'; return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n)); }
  function normalizeStatus(s) { return String(s || '').trim().toLowerCase(); }
  function getElement(id) { return document.getElementById(id); }

  function buildUrl(sheetName, format) {
    const baseUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`;
    const encodedSheetName = encodeURIComponent(sheetName);
    return format === 'csv'
      ? `${baseUrl}?tqx=out:csv&sheet=${encodedSheetName}`
      : `${baseUrl}?sheet=${encodedSheetName}&tqx=out:json`;
  }

  function showSkeleton(container, template, count = 6) {
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) fragment.appendChild(template.content.cloneNode(true));
    container.appendChild(fragment);
  }

  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    state.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (_) {}
  }

  function switchMode(newMode) {
    state.mode = newMode;
    Object.entries(elements.sections).forEach(([key, el]) => { el.hidden = key !== newMode && !(key === 'home' && newMode === 'katalog'); });
    elements.nav.items.forEach(a => a.classList.toggle('active', a.dataset.mode === newMode));
    if (newMode === 'katalog' && !state.katalog.initialized) initializeKatalog();
    if (newMode === 'preorder' && !state.preorder.initialized) initializePreorder();
    if (newMode === 'accounts' && !state.accounts.initialized) initializeAccounts();
  }

  function attachNav() {
    elements.nav.items.forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const mode = a.dataset.mode;
        switchMode(mode);
      }, { passive: true });
    });
  }

  function buildLayananCategorySelect(layananData) {
    const { options, btn, value } = elements.katalog.customSelect;
    options.innerHTML = '';
    const categoryMap = new Map();
    layananData.forEach(item => {
      if (!categoryMap.has(item.catKey)) categoryMap.set(item.catKey, item.catLabel);
    });
    const layananCategories = [{ key: 'all', label: 'Semua' }, ...Array.from(categoryMap, ([key, label]) => ({ key, label }))];
    layananCategories.forEach((cat, index) => {
      const el = document.createElement('div');
      el.className = 'custom-select-option';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      el.dataset.key = cat.key;
      el.textContent = cat.label;
      if (index === 0) el.classList.add('selected');
      el.addEventListener('click', () => {
        state.layanan.selectedKey = cat.key;
        Array.from(options.children).forEach(o => { o.classList.toggle('selected', o.dataset.key === cat.key); o.setAttribute('aria-selected', o.dataset.key === cat.key ? 'true' : 'false'); });
        value.textContent = cat.label;
        filterKatalog();
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      });
      options.appendChild(el);
    });
    const selected = layananCategories.find(c => c.key === state.layanan.selectedKey) || layananCategories[0];
    value.textContent = selected.label;
  }

  function renderList(container, countInfoEl, items, emptyText) {
    container.innerHTML = '';
    if (items.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-inner"><svg class="icon" viewBox="0 0 24 24"><path d="M12 2v20M2 12h20"/></svg><p>${emptyText}</p></div></div>`;
      if (countInfoEl) countInfoEl.textContent = '';
      return;
    }
    const fragment = document.createDocumentFragment();
    const MAX_ANIMATED_ITEMS = 20;
    items.forEach((item, index) => {
      const clone = elements.templates.itemTemplate.content.cloneNode(true);
      const buttonEl = clone.querySelector('.list-item');
      if (index < MAX_ANIMATED_ITEMS) buttonEl.style.animationDelay = `${index * 50}ms`;
      buttonEl.querySelector('.title').textContent = item.title;
      buttonEl.querySelector('.price').textContent = formatToIdr(item.price);
      buttonEl.addEventListener('click', (event) => {
        event.stopPropagation();
        openPaymentModal(item.title, item.price);
      });
      fragment.appendChild(clone);
    });
    container.appendChild(fragment);
    if (countInfoEl) countInfoEl.textContent = `${items.length} item`;
  }

  function fetchJsonSheet(sheetName) {
    const url = buildUrl(sheetName, 'json');
    return fetch(url, { cache: 'no-store' })
      .then(res => { if (!res.ok) throw new Error(`Network error: ${res.statusText}`); return res.text(); })
      .then(text => {
        const json = JSON.parse(text.replace(/^[^{]+/, '').replace(/;$/, ''));
        return json.table;
      });
  }

  function fetchCsvSheet(sheetName) {
    const url = buildUrl(sheetName, 'csv');
    return fetch(url, { cache: 'no-store' }).then(res => { if (!res.ok) throw new Error(`Network error: ${res.statusText}`); return res.text(); });
  }

  function parseKatalogTable(table) {
    const cols = table.cols.map(c => c.label.toLowerCase());
    const idxTitle = cols.indexOf('title') !== -1 ? cols.indexOf('title') : 0;
    const idxPrice = cols.indexOf('price') !== -1 ? cols.indexOf('price') : 1;
    const idxCat = cols.indexOf('category') !== -1 ? cols.indexOf('category') : 2;
    const rows = table.rows || [];
    const data = rows.map(r => {
      const c = r.c || [];
      return {
        title: (c[idxTitle] && (c[idxTitle].v ?? c[idxTitle].f)) || '',
        price: Number((c[idxPrice] && (c[idxPrice].v ?? c[idxPrice].f)) || 0) || 0,
        catKey: safeId((c[idxCat] && (c[idxCat].v ?? c[idxCat].f)) || 'lainnya'),
        catLabel: (c[idxCat] && (c[idxCat].v ?? c[idxCat].f)) || 'Lainnya'
      };
    }).filter(d => d.title);
    return data;
  }

  function filterKatalog() {
    const key = state.layanan.selectedKey;
    const q = (elements.katalog.searchInput.value || '').trim().toLowerCase();
    state.katalog.filtered = state.katalog.data.filter(item => {
      const matchCat = key === 'all' || item.catKey === key;
      const matchText = !q || item.title.toLowerCase().includes(q);
      return matchCat && matchText;
    });
    renderList(elements.katalog.list, elements.katalog.total, state.katalog.filtered, 'Tidak ada data.');
  }

  async function initializeKatalog() {
    if (state.katalog.initialized) return;
    const list = elements.katalog.list;
    showSkeleton(list, elements.templates.skeletonItemTemplate, 6);
    try {
      const table = await fetchJsonSheet(config.sheets.katalog.name);
      const data = parseKatalogTable(table);
      state.katalog.data = data;
      buildLayananCategorySelect(data);
      filterKatalog();
    } catch (e) {
      elements.katalog.list.innerHTML = '<div class="empty"><div class="empty-inner"><p>Gagal memuat katalog.</p></div></div>';
    } finally {
      state.katalog.initialized = true;
    }
  }

  function buildPreorderCategorySelect(rows) {
    const { options, btn, value } = elements.preorder.customSelect;
    options.innerHTML = '';
    const catSet = new Set(['open', 'in-progress', 'done']);
    const cats = [{ key: 'all', label: 'Semua' }, { key: 'open', label: 'Open' }, { key: 'in-progress', label: 'Proses' }, { key: 'done', label: 'Selesai' }]
      .filter(c => c.key === 'all' || catSet.has(c.key));
    cats.forEach((c, index) => {
      const el = document.createElement('div');
      el.className = 'custom-select-option';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      el.dataset.key = c.key;
      el.textContent = c.label;
      if (index === 0) el.classList.add('selected');
      el.addEventListener('click', () => {
        state.preorder.displayMode = c.key;
        Array.from(options.children).forEach(o => { o.classList.toggle('selected', o.dataset.key === c.key); o.setAttribute('aria-selected', o.dataset.key === c.key ? 'true' : 'false'); });
        value.textContent = c.label;
        state.preorder.currentPage = 1;
        renderPreorderCards();
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      });
      options.appendChild(el);
    });
    value.textContent = cats[0].label;
  }

  function renderPreorderCards() {
    const { list } = elements.preorder;
    const q = (document.getElementById('preorderSearchInput').value || '').trim().toLowerCase();
    const mode = state.preorder.displayMode;
    const filtered = state.preorder.allData.filter(row => {
      const t = (row.title || '').toLowerCase();
      const s = normalizeStatus(row.status);
      const textOk = !q || t.includes(q);
      const modeOk = mode === 'all' || s === mode;
      return textOk && modeOk;
    });
    state.preorder.filtered = filtered;

    const { pageSize } = state.preorder;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.preorder.currentPage = Math.min(state.preorder.currentPage, totalPages);
    const start = (state.preorder.currentPage - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);

    list.innerHTML = '';
    if (slice.length === 0) {
      list.innerHTML = `<div class="empty"><div class="empty-inner"><p>Tidak ada data.</p></div></div>`;
      elements.preorder.pageInfo.textContent = '';
      updatePreorderPagination(state.preorder.currentPage, totalPages);
      elements.preorder.total.textContent = '';
      return;
    }

    const frag = document.createDocumentFragment();
    slice.forEach(row => {
      const card = document.createElement('div');
      card.className = `card`;
      const status = normalizeStatus(row.status);
      const badgeColor = status === 'open' ? 'style="background:rgba(48,199,90,.12);border:1px solid rgba(48,199,90,.25);color:#0a7a2b"' :
                         status === 'in-progress' ? 'style="background:rgba(255,193,7,.12);border:1px solid rgba(255,193,7,.25);color:#7a5a00"' :
                         'style="background:rgba(244,67,54,.12);border:1px solid rgba(244,67,54,.25);color:#9b1c14"';
      const detailsHtml = row.detail ? `<div class="meta">${row.detail}</div>` : '';
      card.innerHTML = `<div class="title">${row.title}</div><div class="meta"><span class="badge" ${badgeColor}>${row.status}</span></div>${detailsHtml}`;
      frag.appendChild(card);
    });
    list.appendChild(frag);

    elements.preorder.total.textContent = `${filtered.length} item`;
    updatePreorderPagination(state.preorder.currentPage, totalPages);
  }

  function updatePreorderPagination(page, totalPages) {
    const { prevBtn, nextBtn, pageInfo } = elements.preorder;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
    pageInfo.textContent = `${page} / ${totalPages}`;
  }

  function sortPreorderData(data, mode) {
    const statusOrder = { open: 0, 'in-progress': 1, done: 2 };
    const statusIndex = 2;
    return data.sort((a, b) => statusOrder[normalizeStatus(a[statusIndex])] - statusOrder[normalizeStatus(b[statusIndex])]);
  }

  async function fetchPreorderData(sheetName) {
    const { listContainer } = elements.preorder;
    showSkeleton(listContainer, elements.templates.skeletonItemTemplate, 6);
    try {
      const text = await fetchCsvSheet(sheetName);
      const rows = robustCsvParser(text);
      rows.shift();
      const dataRows = rows.map(r => [r[0] || '', r[1] || '', r[2] || '', r[3] || '']);
      state.preorder.allData = sortPreorderData(dataRows, state.preorder.displayMode).map(r => ({
        title: r[0] || '',
        detail: r[1] || '',
        status: r[2] || 'open',
        extra: r[3] || ''
      }));
      renderPreorderCards();
    } catch (e) {
      elements.preorder.list.innerHTML = '<div class="empty"><div class="empty-inner"><p>Gagal memuat data.</p></div></div>';
      console.error('Fetch Pre-Order failed:', e);
    } finally {
      state.preorder.currentPage = 1;
      renderPreorderCards();
    }
  }

  function initializePreorder() {
    if (state.preorder.initialized) return;
    buildPreorderCategorySelect([]);
    fetchPreorderData(config.sheets.preorder.name1);
    state.preorder.initialized = true;
  }

  function robustCsvParser(text) {
    const normalizedText = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = [];
    let current = '';
    let currentRow = [];
    let inQuotes = false;
    for (let i = 0; i < normalizedText.length; i++) {
      const ch = normalizedText[i];
      if (ch === '"') {
        if (inQuotes && normalizedText[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        currentRow.push(current); current = '';
      } else if (ch === '\n' && !inQuotes) {
        currentRow.push(current); rows.push(currentRow); currentRow = []; current = '';
      } else {
        current += ch;
      }
    }
    if (current.length || currentRow.length) currentRow.push(current);
    if (currentRow.length) rows.push(currentRow);
    return rows;
  }

  async function parseAccountsSheet(text) {
    const rows = robustCsvParser(text);
    rows.shift();
    state.accounts.data = rows.map(row => ({
      title: row[0] || '',
      price: Number(row[1]) || 0,
      status: row[2] || 'Tersedia',
      description: row[3] || '',
      images: (row[4] || '').split(',').map(url => url.trim()).filter(Boolean),
    }));
  }

  function populateAccountSelect() {
    const { customSelect, empty } = elements.accounts;
    const options = customSelect.options;
    options.innerHTML = '';
    const categories = [{ key: 'all', label: 'Semua' }];
    const catSet = new Set();
    state.accounts.data.forEach(a => { const k = safeId((a.category || '')); if (k && !catSet.has(k)) { catSet.add(k); categories.push({ key: k, label: a.category || 'Lainnya' }); } });
    if (categories.length === 1) {
      const el = document.createElement('div');
      el.className = 'custom-select-option';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', 'true');
      el.textContent = 'Tidak ada akun';
      options.appendChild(el);
      customSelect.value.textContent = 'Tidak ada akun';
      empty.style.display = 'grid';
      return;
    }
    categories.forEach((c, index) => {
      const el = document.createElement('div');
      el.className = 'custom-select-option';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      el.dataset.key = c.key;
      el.textContent = c.label;
      if (index === 0) el.classList.add('selected');
      el.addEventListener('click', () => {
        state.accounts.selectedKey = c.key;
        Array.from(options.children).forEach(o => { o.classList.toggle('selected', o.dataset.key === c.key); o.setAttribute('aria-selected', o.dataset.key === c.key ? 'true' : 'false'); });
        customSelect.value.textContent = c.label;
        filterAccounts();
        customSelect.btn.setAttribute('aria-expanded', 'false');
        customSelect.btn.focus();
      });
      options.appendChild(el);
    });
  }

  function renderAccount(index) {
    const { display, empty, price, desc, title, status, carousel } = elements.accounts;
    const filtered = state.accounts.filtered;
    if (!filtered.length) {
      display.style.display = 'none';
      empty.style.display = 'grid';
      return;
    }
    empty.style.display = 'none';
    display.style.display = 'block';
    const account = filtered[index] || filtered[0];
    state.accounts.currentIndex = index;

    title.textContent = account.title;
    desc.textContent = account.description || '';
    status.textContent = account.status;
    status.className = 'account-status-badge';
    status.classList.add(account.status.toLowerCase());
    price.textContent = formatToIdr(account.price);

    carousel.track.innerHTML = '';
    carousel.indicators.innerHTML = '';
    const frag = document.createDocumentFragment();
    const indFrag = document.createDocumentFragment();
    account.images.forEach((src, i) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-item';
      const img = document.createElement('img');
      img.src = src;
      img.alt = `Foto ${i + 1} ${account.title}`;
      img.loading = 'lazy';
      slide.appendChild(img);
      frag.appendChild(slide);

      const dot = document.createElement('div');
      dot.className = 'indicator';
      indFrag.appendChild(dot);
    });
    carousel.track.appendChild(frag);
    carousel.indicators.appendChild(indFrag);
    updateCarousel();
  }

  function updateCarousel() {
    const account = state.accounts.currentIndex;
    const { track, indicators } = elements.accounts.carousel;
    const width = track.clientWidth || track.getBoundingClientRect().width;
    track.style.transform = `translateX(-${account * width}px)`;
    Array.from(indicators.children).forEach((el, i) => el.classList.toggle('active', i === state.accounts.currentIndex));
  }

  function initializeCarousel() {
    const { prevBtn, nextBtn, track } = elements.accounts.carousel;
    prevBtn.addEventListener('click', () => {
      const n = state.accounts.currentIndex - 1;
      if (n >= 0) { state.accounts.currentIndex = n; updateCarousel(); }
    });
    nextBtn.addEventListener('click', () => {
      const max = Math.max(0, elements.accounts.carousel.indicators.children.length - 1);
      const n = state.accounts.currentIndex + 1;
      if (n <= max) { state.accounts.currentIndex = n; updateCarousel(); }
    });
    let touchStartX = 0;
    track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
      const endX = e.changedTouches[0].clientX;
      if (endX < touchStartX - 50) elements.accounts.carousel.nextBtn.click();
      if (endX > touchStartX + 50) elements.accounts.carousel.prevBtn.click();
    }, { passive: true });
    window.addEventListener('resize', () => updateCarousel(), { passive: true });
  }

  async function initializeAccounts() {
    if (state.accounts.initialized) return;
    try {
      const res = await fetch(buildUrl(config.sheets.accounts.name, 'csv'), { cache: 'no-store' });
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
      const text = await res.text();
      await parseAccountsSheet(text);
      state.accounts.filtered = state.accounts.data.slice();
      populateAccountSelect();
      renderAccount(0);
      initializeCarousel();
      state.accounts.initialized = true;
    } catch (e) {
      elements.accounts.empty.hidden = false;
      console.error('Load accounts failed:', e);
    }
  }

  function openPaymentModal(itemName, basePrice) {
    const { overlay, itemName: nameEl, price, fee, total, continueBtn, payQris, payTf } = elements.modal;
    function computeTotal(method) {
      const rate = config.fee[method] || 0;
      const feeValue = Math.round(Number(basePrice) * rate);
      const t = Math.round(Number(basePrice) + feeValue);
      fee.textContent = formatToIdr(feeValue);
      total.textContent = formatToIdr(t);
      return t;
    }
    nameEl.textContent = itemName;
    price.textContent = formatToIdr(basePrice);
    const activeMethod = payQris.checked ? 'QRIS' : 'Transfer';
    const t = computeTotal(activeMethod);
    overlay.style.display = 'flex';
    continueBtn.href = `https://wa.me/${config.waNumber}?text=${encodeURIComponent(`Halo Admin, saya ingin pesan: ${itemName} (${formatToIdr(t)})`)}`;
    function onChange() {
      const method = payQris.checked ? 'QRIS' : 'Transfer';
      const totalVal = computeTotal(method);
      continueBtn.href = `https://wa.me/${config.waNumber}?text=${encodeURIComponent(`Halo Admin, saya ingin pesan: ${itemName} (${formatToIdr(totalVal)})`)}`;
    }
    elements.modal.payQris.addEventListener('change', onChange);
    elements.modal.payTf.addEventListener('change', onChange);
  }

  function closePaymentModal() { elements.modal.overlay.style.display = 'none'; }

  function attachModal() {
    elements.modal.closeBtn.addEventListener('click', () => closePaymentModal());
    elements.modal.overlay.addEventListener('click', e => { if (e.target === elements.modal.overlay) closePaymentModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && elements.modal.overlay.style.display !== 'none') closePaymentModal(); });
  }

  function initializeApp() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());

    const savedTheme = (localStorage.getItem('theme') || '').toLowerCase();
    applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
    elements.toggles.theme.addEventListener('click', () => applyTheme(state.theme === 'light' ? 'dark' : 'light'));

    attachNav();
    attachModal();

    elements.katalog.customSelect.btn.addEventListener('click', () => {
      const w = elements.katalog.customSelect.wrapper;
      const open = w.classList.toggle('open');
      elements.katalog.customSelect.btn.setAttribute('aria-expanded', String(open));
      elements.katalog.customSelect.options.focus && elements.katalog.customSelect.options.focus();
    });

    elements.preorder.customSelect.btn.addEventListener('click', () => {
      const w = elements.preorder.customSelect.wrapper;
      const open = w.classList.toggle('open');
      elements.preorder.customSelect.btn.setAttribute('aria-expanded', String(open));
    });

    elements.accounts.customSelect.btn.addEventListener('click', () => {
      const w = elements.accounts.customSelect.wrapper;
      const open = w.classList.toggle('open');
      elements.accounts.customSelect.btn.setAttribute('aria-expanded', String(open));
    });

    elements.katalog.searchInput.addEventListener('input', () => filterKatalog(), { passive: true });
    document.getElementById('preorderSearchInput').addEventListener('input', () => { state.preorder.currentPage = 1; renderPreorderCards(); }, { passive: true });

    elements.preorder.prevBtn.addEventListener('click', () => { state.preorder.currentPage = Math.max(1, state.preorder.currentPage - 1); renderPreorderCards(); });
    elements.preorder.nextBtn.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(state.preorder.filtered.length / state.preorder.pageSize));
      state.preorder.currentPage = Math.min(totalPages, state.preorder.currentPage + 1);
      renderPreorderCards();
    });

    switchMode('katalog');

    try {
      const mm = MenuModule.init({
        menuCat: document.getElementById('menuKatalog'),
        menuPO: document.getElementById('menuPreorder'),
        menuAcc: document.getElementById('menuAccounts'),
        onRoute: (r) => switchMode(r),
        closeAll: () => {}
      });
      void mm;
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', initializeApp, { passive: true });

  document.addEventListener('DOMContentLoaded',function(){var modal=document.getElementById('paymentModal');if(modal){var prevFocus=null;var trapRemover=null;function trapFocus(container){var sel='a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])';var nodes=container.querySelectorAll(sel);if(!nodes.length)return function(){};var first=nodes[0],last=nodes[nodes.length-1];function onKey(e){if(e.key!=='Tab')return;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}container.addEventListener('keydown',onKey);return function(){container.removeEventListener('keydown',onKey);};}
var content=modal.querySelector('.modal-content');var obs=new MutationObserver(function(){var style=window.getComputedStyle(modal);var visible=style.display!=='none';if(visible){modal.setAttribute('aria-hidden','false');prevFocus=document.activeElement;content&&content.focus();trapRemover=trapFocus(content||modal);}else{modal.setAttribute('aria-hidden','true');if(trapRemover){trapRemover();trapRemover=null;}if(prevFocus){try{prevFocus.focus();}catch(e){}}}});obs.observe(modal,{attributes:true,attributeFilter:['style']});}
function ensureCustomSelectAria(){var lists=document.querySelectorAll('.custom-select-options');lists.forEach(function(list,liIdx){if(!list.getAttribute('role'))list.setAttribute('role','listbox');var opts=list.children;for(var i=0;i<opts.length;i++){var o=opts[i];if(!o.getAttribute('role'))o.setAttribute('role','option');if(!o.id)o.id='opt_'+liIdx+'_'+i;}});var pairs=[['layananCustomSelectBtn','layananCustomSelectOptions'],['preorderCustomSelectBtn','preorderCustomSelectOptions'],['accountCustomSelectBtn','accountCustomSelectOptions']];pairs.forEach(function(p){var btn=document.getElementById(p[0]);var list=document.getElementById(p[1]);if(btn&&list){btn.setAttribute('aria-controls',p[1]);}});}
ensureCustomSelectAria();document.body.addEventListener('click',function(e){if(e.target.closest('.custom-select-wrapper')){setTimeout(ensureCustomSelectAria,0);}},{capture:true});});
})();
