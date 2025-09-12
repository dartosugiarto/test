/**
 * PlayPal.ID — SPA
 * Versi ini menambahkan View "Akun Game" lengkap.
 */
(function () {
  'use strict';

  /* =================== CONFIG =================== */
  const config = {
    sheetId: '1B0XPR4uSvRzy9LfzWDjNjwAyMZVtJs6_Kk_r2fh7dTw',
    sheets: {
      katalog: { name: 'Sheet3' },        // pair kolom: (judul, harga) per kategori
      preorder: { name1: 'Sheet1', name2: 'Sheet2' },
      accounts: { name: 'Sheet5' }        // Kolom minimal: A=Kategori, B=Judul, C=Harga, D=Deskripsi, E=Gambar(opsional), F=Kontak(opsional)
    },
    waNumber: '6285877001999',
    waGreeting: '*Detail pesanan:*',
    paymentOptions: [
      { id: 'seabank', name: 'Seabank', feeType: 'fixed', value: 0 },
      { id: 'gopay',   name: 'Gopay',   feeType: 'fixed', value: 0 },
      { id: 'dana',    name: 'Dana',    feeType: 'fixed', value: 125 },
      { id: 'bank_to_dana', name: 'Bank ke Dana', feeType: 'fixed', value: 500 },
      { id: 'qris',    name: 'Qris',    feeType: 'percentage', value: 0.01 },
    ],
  };

  /* =================== STATE =================== */
  const state = {
    home: { activeCategory: '', searchQuery: '' },
    preorder: { initialized: false, allData: [], currentPage: 1, perPage: 15, displayMode: 'detailed' },
    accounts: { initialized: false, allData: [], activeCategory: 'Semua Kategori', searchQuery: '' }
  };

  /* =================== HELPERS =================== */
  const $ = id => document.getElementById(id);
  const elements = {
    // shell
    sidebar: { nav: $('sidebarNav'), overlay: $('sidebarOverlay'), burger: $('burgerBtn'), links: document.querySelectorAll('.sidebar-nav .nav-item') },
    themeToggle: $('themeToggleBtn'), sidebarThemeBtn: $('sidebarThemeBtn'),
    // views
    viewHome: $('viewHome'), viewPreorder: $('viewPreorder'), viewAccounts: $('viewAccounts'), viewPerpustakaan: $('viewPerpustakaan'), viewFilm: $('viewFilm'),
    // home
    home: {
      listContainer: $('homeListContainer'), searchInput: $('homeSearchInput'), countInfo: $('homeCountInfo'), errorContainer: $('homeErrorContainer'),
      customSelect: { wrapper: $('homeCustomSelectWrapper'), btn: $('homeCustomSelectBtn'), value: $('homeCustomSelectValue'), options: $('homeCustomSelectOptions') },
    },
    // shared templates
    itemTemplate: $('itemTemplate'), skeletonItemTemplate: $('skeletonItemTemplate'), skeletonCardTemplate: $('skeletonCardTemplate'),
    // payment modal
    paymentModal: { modal: $('paymentModal'), closeBtn: $('closeModalBtn'), itemName: $('modalItemName'), itemPrice: $('modalItemPrice'), optionsContainer: $('paymentOptionsContainer'), fee: $('modalFee'), total: $('modalTotal'), waBtn: $('continueToWaBtn') },
    // preorder
    preorder: {
      searchInput: $('preorderSearchInput'), statusSelect: $('preorderStatusSelect'),
      listContainer: $('preorderListContainer'),
      prevBtn: $('preorderPrevBtn'), nextBtn: $('preorderNextBtn'), pageInfo: $('preorderPageInfo'), total: $('preorderTotal'),
      customSelect: { wrapper: $('preorderCustomSelectWrapper'), btn: $('preorderCustomSelectBtn'), value: $('preorderCustomSelectValue'), options: $('preorderCustomSelectOptions') },
      customStatusSelect: { wrapper: $('preorderStatusCustomSelectWrapper'), btn: $('preorderStatusCustomSelectBtn'), value: $('preorderStatusCustomSelectValue'), options: $('preorderStatusCustomSelectOptions') },
    },
    // accounts
    accounts: {
      grid: $('accountCardGrid'), empty: $('accountEmpty'), error: $('accountError'), countInfo: $('accountCountInfo'),
      searchInput: $('accountSearchInput'),
      customSelect: { wrapper: $('accountCustomSelectWrapper'), btn: $('accountCustomSelectBtn'), value: $('accountCustomSelectValue'), options: $('accountCustomSelectOptions') },
      cardTemplate: $('accountCardTemplate')
    }
  };

  function formatToIdr(value) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
  function getSheetUrl(sheetName, format = 'json') {
    const baseUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`;
    const encoded = encodeURIComponent(sheetName);
    return format === 'csv' ? `${baseUrl}?tqx=out:csv&sheet=${encoded}` : `${baseUrl}?sheet=${encoded}&tqx=out:json`;
  }
  function showSkeleton(container, template, count = 6) {
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) frag.appendChild(template.content.cloneNode(true));
    container.appendChild(frag);
  }
  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    const pressed = theme === 'dark';
    elements.themeToggle?.setAttribute('aria-pressed', pressed);
    elements.sidebarThemeBtn?.setAttribute('aria-pressed', pressed);
    document.documentElement.style.colorScheme = pressed ? 'dark' : 'light';
  }
  function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  }
  function toggleTheme() {
    const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme); applyTheme(newTheme);
  }
  function toggleSidebar(forceOpen) {
    const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open', isOpen);
    elements.sidebar.burger.classList.toggle('active', isOpen);
  }
  function toggleCustomSelect(wrapper, forceOpen) {
    if (!wrapper) return;
    const btn = wrapper.querySelector('.custom-select-btn');
    const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !wrapper.classList.contains('open');
    wrapper.classList.toggle('open', isOpen);
    btn?.setAttribute('aria-expanded', String(isOpen));
  }

  /* =================== HOME (Katalog) =================== */
  let allCatalogData = [];
  let catalogFetchController = null;
  let currentSelectedItem = null;

  function parseGvizPairs(jsonText) {
    const match = jsonText.match(/\{.*\}/s);
    if (!match) throw new Error('Invalid GViz response');
    const obj = JSON.parse(match[0]);
    const { rows = [], cols = [] } = obj.table || {};
    const pairs = Array.from({ length: Math.floor(cols.length / 2) }, (_, i) => ({
      iTitle: i * 2, iPrice: i * 2 + 1, label: cols[i * 2]?.label || ''
    })).filter(p => p.label && cols[p.iPrice]);
    const out = [];
    for (const r of rows) {
      const c = r.c || [];
      for (const p of pairs) {
        const title = String(c[p.iTitle]?.v || '').trim();
        const priceRaw = c[p.iPrice]?.v;
        const price = priceRaw != null && priceRaw !== '' ? Number(priceRaw) : NaN;
        if (title && !isNaN(price)) {
          out.push({ catKey: p.label, catLabel: String(p.label || '').trim().replace(/\s+/g, ' '), title, price });
        }
      }
    }
    return out;
  }

  function buildHomeCategorySelect(data) {
    const { options, value } = elements.home.customSelect;
    const categoryMap = new Map();
    data.forEach(it => { if (!categoryMap.has(it.catKey)) categoryMap.set(it.catKey, it.catLabel); });
    options.innerHTML = '';
    [...categoryMap].forEach(([key, label], idx) => {
      const el = document.createElement('div');
      el.className = 'custom-select-option' + (idx === 0 ? ' selected' : '');
      el.textContent = label; el.dataset.value = key; el.setAttribute('role', 'option'); el.tabIndex = -1;
      el.addEventListener('click', () => {
        state.home.activeCategory = key; value.textContent = label;
        options.querySelector('.selected')?.classList.remove('selected'); el.classList.add('selected');
        toggleCustomSelect(elements.home.customSelect.wrapper, false); renderHomeList();
      });
      options.appendChild(el);
    });
    const first = options.querySelector('.custom-select-option');
    if (first) { state.home.activeCategory = first.dataset.value; value.textContent = first.textContent; }
    else value.textContent = 'Data tidak tersedia';
  }

  function renderList(container, countInfoEl, items, emptyText) {
    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = `<div class="empty"><div class="empty-content"><svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg><p>${emptyText}</p></div></div>`;
      countInfoEl.textContent = ''; return;
    }
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const clone = elements.itemTemplate.content.cloneNode(true);
      const btn = clone.querySelector('.list-item');
      btn.querySelector('.title').textContent = item.title;
      btn.querySelector('.price').textContent = formatToIdr(item.price);
      btn.addEventListener('click', () => openPaymentModal(item));
      frag.appendChild(clone);
    }
    container.appendChild(frag);
    countInfoEl.textContent = `${items.length} item ditemukan`;
  }

  function renderHomeList() {
    const { activeCategory, searchQuery } = state.home;
    const q = searchQuery.toLowerCase();
    const items = allCatalogData.filter(x =>
      x.catKey === activeCategory &&
      (q === '' || x.title.toLowerCase().includes(q) || String(x.price).includes(q))
    );
    renderList(elements.home.listContainer, elements.home.countInfo, items, 'Tidak ada item ditemukan.');
  }

  async function loadCatalog() {
    if (catalogFetchController) catalogFetchController.abort();
    catalogFetchController = new AbortController();
    try {
      elements.home.errorContainer.style.display = 'none';
      showSkeleton(elements.home.listContainer, elements.skeletonItemTemplate, 6);
      const res = await fetch(getSheetUrl(config.sheets.katalog.name), { signal: catalogFetchController.signal });
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
      const text = await res.text();
      allCatalogData = parseGvizPairs(text);
      if (!allCatalogData.length) throw new Error('Data kosong/format salah');
      buildHomeCategorySelect(allCatalogData);
      renderHomeList();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Failed to load catalog:', err);
      elements.home.listContainer.innerHTML = '';
      elements.home.errorContainer.style.display = 'block';
      elements.home.errorContainer.textContent = 'Oops, terjadi kesalahan. Silakan coba lagi nanti.';
    }
  }

  /* ===== Payment modal (katalog) ===== */
  function calculateFee(price, option) {
    if (option.feeType === 'fixed') return option.value;
    if (option.feeType === 'percentage') return Math.ceil(price * option.value);
    return 0;
  }
  function updateWaLink(option, fee, total) {
    const { catLabel = 'Produk', title, price } = currentSelectedItem || {};
    const text = [
      config.waGreeting,
      `› Tipe: ${catLabel}`,
      `› Item: ${title}`,
      `› Pembayaran: ${option.name}`,
      `› Harga: ${formatToIdr(price)}`,
      `› Fee: ${formatToIdr(fee)}`,
      `› Total: ${formatToIdr(total)}`
    ].join('\n');
    elements.paymentModal.waBtn.href = `https://wa.me/${config.waNumber}?text=${encodeURIComponent(text)}`;
  }
  function updatePriceDetails() {
    const selectedId = document.querySelector('input[name="payment"]:checked')?.value;
    if (!selectedId || !currentSelectedItem) return;
    const opt = config.paymentOptions.find(o => o.id === selectedId);
    if (!opt) return;
    const price = currentSelectedItem.price;
    const fee = calculateFee(price, opt);
    const total = price + fee;
    elements.paymentModal.fee.textContent = formatToIdr(fee);
    elements.paymentModal.total.textContent = formatToIdr(total);
    updateWaLink(opt, fee, total);
  }
  function openPaymentModal(item) {
    currentSelectedItem = item;
    const { modal, itemName, itemPrice, optionsContainer } = elements.paymentModal;
    itemName.textContent = item.title; itemPrice.textContent = formatToIdr(item.price);
    optionsContainer.innerHTML = '';
    config.paymentOptions.forEach((option, i) => {
      const fee = calculateFee(item.price, option);
      optionsContainer.insertAdjacentHTML('beforeend',
        `<label class="payment-option"><input type="radio" name="payment" value="${option.id}" ${i===0?'checked':''}/> ${option.name}<span style="margin-left:auto">+ ${formatToIdr(fee)}</span></label>`);
    });
    optionsContainer.querySelectorAll('input[name="payment"]').forEach(inp => inp.addEventListener('change', updatePriceDetails));
    updatePriceDetails();
    modal.classList.add('visible');
  }
  function closePaymentModal(){ elements.paymentModal.modal.classList.remove('visible'); currentSelectedItem = null; }

  /* =================== PREORDER =================== */
  let preorderFetchController = null;

  function normalizeStatus(s) {
    const v = String(s || '').trim().toLowerCase();
    if (['success','selesai','berhasil','done'].includes(v)) return 'success';
    if (['progress','proses','diproses','processing'].includes(v)) return 'progress';
    if (['failed','gagal','dibatalkan','cancel','error'].includes(v)) return 'failed';
    return 'pending';
  }
  function updatePreorderPagination(currentPage, totalPages) {
    elements.preorder.prevBtn.disabled = currentPage <= 1;
    elements.preorder.nextBtn.disabled = currentPage >= totalPages;
    elements.preorder.pageInfo.textContent = totalPages ? `Hal ${currentPage} dari ${totalPages}` : '';
  }
  function filterPreorderData() {
    const q = elements.preorder.searchInput.value.trim().toLowerCase();
    const status = elements.preorder.statusSelect.value;
    const mode = state.preorder.displayMode;
    return state.preorder.allData.filter(row => {
      const rowStatus = normalizeStatus(row[mode === 'detailed' ? 6 : 2]);
      if (status !== 'all' && rowStatus !== status) return false;
      if (mode === 'detailed') {
        const product = (row[3] || '').toLowerCase();
        const nickname = (row[5] || '').toLowerCase();
        const idGift = (row[7] || '').toLowerCase();
        return product.includes(q) || nickname.includes(q) || idGift.includes(q);
      } else {
        const orderNum = (row[0] || '').toLowerCase();
        const product = (row[1] || '').toLowerCase();
        return orderNum.includes(q) || product.includes(q);
      }
    });
  }
  function sortPreorderData(data, mode) {
    const order = { progress:1, pending:2, success:3, failed:4 };
    const idx = mode === 'detailed' ? 6 : 2;
    return data.sort((a,b) => order[normalizeStatus(a[idx])] - order[normalizeStatus(b[idx])]);
  }
  function renderPreorderCards() {
    const filtered = filterPreorderData();
    const totalItems = state.preorder.allData.length;
    const { perPage } = state.preorder;
    const { listContainer, total } = elements.preorder;
    total.textContent = `${totalItems} total pesanan${filtered.length !== totalItems ? `, ${filtered.length} ditemukan` : ''}`;

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    state.preorder.currentPage = Math.min(Math.max(1, state.preorder.currentPage), totalPages);
    const start = (state.preorder.currentPage - 1) * perPage;
    const pageData = filtered.slice(start, start + perPage);

    listContainer.innerHTML = '';
    if (!pageData.length) {
      listContainer.innerHTML = `<div class="empty"><div class="empty-content"><svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg><p>Tidak Ada Hasil Ditemukan</p></div></div>`;
      updatePreorderPagination(0,0); return;
    }

    const frag = document.createDocumentFragment();
    pageData.forEach(item => {
      const card = document.createElement('article');
      if (state.preorder.displayMode === 'detailed') {
        const [tglOrder, estPengiriman, , product, bulan, name, statusRaw] = item;
        const status = normalizeStatus(statusRaw);
        const est = estPengiriman ? `Estimasi Pengiriman: ${estPengiriman} 20:00 WIB` : '';
        card.className = 'card clickable';
        card.innerHTML = `
          <div class="card-header">
            <div><div class="card-name">${name || 'Tanpa Nama'}</div><div class="card-product">${product || 'N/A'}</div></div>
            <div class="status-badge ${status}">${(statusRaw || 'Pending').toUpperCase()}</div>
          </div>
          ${est ? `<div class="card-date">${est}</div>` : ''}
          <div class="card-details" style="display:none;"></div>
        `;
        card.addEventListener('click', () => card.classList.toggle('expanded'));
      } else {
        const [orderNum, product, statusRaw] = item;
        const status = normalizeStatus(statusRaw);
        card.className = 'card';
        card.innerHTML = `
          <div class="card-header">
            <div><div class="card-name">${orderNum || 'Tanpa Nomor'}</div><div class="card-product">${product || 'N/A'}</div></div>
            <div class="status-badge ${status}">${(statusRaw || 'Pending').toUpperCase()}</div>
          </div>`;
      }
      frag.appendChild(card);
    });
    listContainer.appendChild(frag);
    updatePreorderPagination(state.preorder.currentPage, totalPages);
  }

  async function fetchPreorderData(sheetName) {
    if (preorderFetchController) preorderFetchController.abort();
    preorderFetchController = new AbortController();
    const { listContainer, total } = elements.preorder;
    total.textContent = 'Memuat data...';
    showSkeleton(listContainer, elements.skeletonCardTemplate, 5);
    state.preorder.displayMode = sheetName === config.sheets.preorder.name1 ? 'detailed' : 'simple';
    try {
      const res = await fetch(getSheetUrl(sheetName, 'csv'), { signal: preorderFetchController.signal });
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
      const text = await res.text();
      let rows = text.trim().split('\n').map(r => r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g,'').trim()));
      if (rows.length < 2) state.preorder.allData = [];
      else {
        rows.shift(); // remove header
        const dataRows = rows.filter(r => r && (r[0] || '').trim() !== '');
        state.preorder.allData = sortPreorderData(dataRows, state.preorder.displayMode);
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('Fetch Pre-Order failed:', e);
      state.preorder.allData = []; total.textContent = 'Gagal memuat data.';
    } finally {
      state.preorder.currentPage = 1; renderPreorderCards();
    }
  }

  function initializePreorder() {
    if (state.preorder.initialized) return;
    state.preorder.initialized = true;

    const { searchInput, customSelect, customStatusSelect, statusSelect, prevBtn, nextBtn } = elements.preorder;

    // search & status
    searchInput.addEventListener('input', () => { state.preorder.currentPage = 1; renderPreorderCards(); });

    customStatusSelect.options.querySelectorAll('.custom-select-option').forEach(opt => {
      opt.addEventListener('click', () => {
        customStatusSelect.options.querySelector('.selected')?.classList.remove('selected');
        opt.classList.add('selected');
        customStatusSelect.value.textContent = opt.textContent;
        statusSelect.value = opt.dataset.value;
        toggleCustomSelect(customStatusSelect.wrapper, false);
        state.preorder.currentPage = 1; renderPreorderCards();
      });
    });

    // source switch
    customSelect.options.querySelectorAll('.custom-select-option').forEach(opt => {
      opt.addEventListener('click', () => {
        customSelect.options.querySelector('.selected')?.classList.remove('selected');
        opt.classList.add('selected');
        customSelect.value.textContent = opt.textContent;
        toggleCustomSelect(customSelect.wrapper, false);
        const sheet = opt.dataset.value === '0' ? config.sheets.preorder.name1 : config.sheets.preorder.name2;
        fetchPreorderData(sheet);
      });
    });

    prevBtn.addEventListener('click', () => { state.preorder.currentPage--; renderPreorderCards(); });
    nextBtn.addEventListener('click', () => { state.preorder.currentPage++; renderPreorderCards(); });

    // load initial
    fetchPreorderData(config.sheets.preorder.name1);
  }

  /* =================== ACCOUNTS =================== */
  let accountsFetchController = null;

  function buildAccountCategories(data) {
    const { options, value } = elements.accounts.customSelect;
    const set = new Set(data.map(d => d.category).filter(Boolean));
    const cats = ['Semua Kategori', ...Array.from(set)];
    options.innerHTML = '';
    cats.forEach((label, idx) => {
      const el = document.createElement('div');
      el.className = 'custom-select-option' + (idx === 0 ? ' selected' : '');
      el.dataset.value = label; el.textContent = label;
      el.tabIndex = -1; el.setAttribute('role','option');
      el.addEventListener('click', () => {
        options.querySelector('.selected')?.classList.remove('selected');
        el.classList.add('selected');
        value.textContent = label;
        state.accounts.activeCategory = label;
        toggleCustomSelect(elements.accounts.customSelect.wrapper, false);
        renderAccounts();
      });
      options.appendChild(el);
    });
    value.textContent = 'Semua Kategori';
    state.accounts.activeCategory = 'Semua Kategori';
  }

  function renderAccounts() {
    const { grid, empty, error, countInfo, cardTemplate } = elements.accounts;
    error.style.display = 'none';
    grid.innerHTML = '';

    let list = state.accounts.allData;
    const q = state.accounts.searchQuery.toLowerCase();
    if (state.accounts.activeCategory !== 'Semua Kategori') {
      list = list.filter(x => x.category === state.accounts.activeCategory);
    }
    if (q) list = list.filter(x => x.title.toLowerCase().includes(q) || (x.desc || '').toLowerCase().includes(q));

    if (!list.length) {
      countInfo.textContent = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    countInfo.textContent = `${list.length} akun ditemukan`;

    const frag = document.createDocumentFragment();
    list.forEach(item => {
      const node = cardTemplate.content.cloneNode(true);
      const img = node.querySelector('.account-thumb');
      const title = node.querySelector('.account-title');
      const cat = node.querySelector('.account-cat');
      const price = node.querySelector('.account-price');
      const desc = node.querySelector('.account-desc');
      const waBtn = node.querySelector('.account-wa');

      title.textContent = item.title || 'Akun Game';
      cat.textContent = item.category || '-';
      price.textContent = formatToIdr(item.price || 0);
      desc.textContent = item.desc || '';
      img.src = item.image || 'https://i.imgur.com/9V3a8hA.jpeg'; // placeholder aman
      img.alt = `Akun ${item.title}`;

      const waText = [
        '*Ingin beli akun game*',
        `› Kategori: ${item.category}`,
        `› Judul: ${item.title}`,
        `› Harga: ${formatToIdr(item.price || 0)}`
      ].join('\n');
      const waNumber = (item.contact || '').replace(/\D+/g,'') || config.waNumber;
      waBtn.addEventListener('click', () => {
        window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`,'_blank','noopener');
      });

      frag.appendChild(node);
    });
    grid.appendChild(frag);
  }

  async function loadAccounts() {
    if (accountsFetchController) accountsFetchController.abort();
    accountsFetchController = new AbortController();
    const { grid, error, empty } = elements.accounts;

    try {
      error.style.display = 'none';
      empty.style.display = 'none';
      showSkeleton(grid, elements.skeletonCardTemplate, 6);

      const res = await fetch(getSheetUrl(config.sheets.accounts.name, 'csv'), { signal: accountsFetchController.signal });
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
      const text = await res.text();

      const rows = text.trim().split('\n').map(r => r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g,'').trim()));
      if (rows.length < 2) { state.accounts.allData = []; renderAccounts(); return; }
      const header = rows.shift().map(h => h.toLowerCase());
      const idx = {
        category: header.findIndex(h => /kategori|category/i.test(h)),
        title: header.findIndex(h => /judul|title|nama/i.test(h)),
        price: header.findIndex(h => /harga|price/i.test(h)),
        desc: header.findIndex(h => /deskripsi|desc/i.test(h)),
        image: header.findIndex(h => /gambar|image|thumbnail|thumb/i.test(h)),
        contact: header.findIndex(h => /kontak|contact|wa|whatsapp/i.test(h)),
      };
      const data = rows.filter(r => r && (r[idx.title] || '').trim() !== '')
        .map(r => ({
          category: (r[idx.category] || '').trim() || 'Lainnya',
          title: (r[idx.title] || '').trim(),
          price: Number(r[idx.price] || 0),
          desc: (r[idx.desc] || '').trim(),
          image: (r[idx.image] || '').trim(),
          contact: (r[idx.contact] || '').trim(),
        }));
      state.accounts.allData = data;

      buildAccountCategories(data);
      renderAccounts();
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('Load accounts failed:', e);
      grid.innerHTML = '';
      elements.accounts.countInfo.textContent = '';
      error.style.display = 'block';
      error.textContent = 'Gagal memuat data akun. Coba lagi nanti.';
    }
  }

  function initializeAccounts() {
    if (state.accounts.initialized) return;
    state.accounts.initialized = true;

    // dropdown
    elements.accounts.customSelect.btn.addEventListener('click', (e) => { e.stopPropagation(); toggleCustomSelect(elements.accounts.customSelect.wrapper); });
    // search
    let debounce;
    elements.accounts.searchInput.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { state.accounts.searchQuery = e.target.value.trim(); renderAccounts(); }, 180);
    });

    loadAccounts();
  }

  /* =================== APP INIT =================== */
  function setMode(nextMode) {
    if (nextMode === 'donasi') { window.open('https://saweria.co/playpal','_blank','noopener'); return; }

    const viewMap = { home: elements.viewHome, preorder: elements.viewPreorder, accounts: elements.viewAccounts, perpustakaan: elements.viewPerpustakaan, film: elements.viewFilm };
    const nextView = viewMap[nextMode]; if (!nextView) return;

    document.querySelector('.view-section.active')?.classList.remove('active');
    nextView.classList.add('active');
    elements.sidebar.links.forEach(link => link.classList.toggle('active', link.dataset.mode === nextMode));
    if (window.innerWidth < 769) toggleSidebar(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (nextMode === 'preorder'  && !state.preorder.initialized)  initializePreorder();
    if (nextMode === 'accounts'  && !state.accounts.initialized)  initializeAccounts();
  }

  function setupKeyboardNavForSelect(wrapper) {
    if (!wrapper) return;
    const btn = wrapper.querySelector('.custom-select-btn');
    const optionsEl = wrapper.querySelector('.custom-select-options');
    let focusIndex = -1;

    wrapper.addEventListener('keydown', e => {
      const options = Array.from(optionsEl.querySelectorAll('.custom-select-option'));
      if (!options.length) return;
      const isOpen = wrapper.classList.contains('open');

      if (e.key === 'Escape') { toggleCustomSelect(wrapper, false); btn.focus(); return; }
      if (document.activeElement === btn && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); toggleCustomSelect(wrapper, true);
        focusIndex = Math.max(0, options.findIndex(o => o.classList.contains('selected')));
        options[focusIndex]?.focus();
      }
      if (isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        focusIndex = Math.min(Math.max(0, focusIndex + (e.key === 'ArrowDown' ? 1 : -1)), options.length - 1);
        options[focusIndex]?.focus();
      }
      if (isOpen && (e.key === 'Enter' || e.key === ' ') && document.activeElement.classList.contains('custom-select-option')) {
        e.preventDefault(); document.activeElement.click(); btn.focus();
      }
    });
  }

  function initializeApp() {
    initTheme();
    elements.themeToggle?.addEventListener('click', toggleTheme);
    elements.sidebarThemeBtn?.addEventListener('click', toggleTheme);

    elements.sidebar.burger?.addEventListener('click', () => toggleSidebar());
    elements.sidebar.overlay?.addEventListener('click', () => toggleSidebar(false));
    elements.sidebar.links.forEach(link => link.addEventListener('click', e => { if (link.dataset.mode){ e.preventDefault(); setMode(link.dataset.mode); }}));

    // custom selects toggle
    [elements.home.customSelect.btn, elements.preorder.customSelect.btn, elements.preorder.customStatusSelect.btn, elements.accounts.customSelect.btn]
      .filter(Boolean).forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); toggleCustomSelect(btn.closest('.custom-select-wrapper')); }));
    document.addEventListener('click', () => {
      ['home','preorder','accounts'].forEach(key => {
        const w = elements[key]?.customSelect?.wrapper; if (w) toggleCustomSelect(w, false);
      });
      toggleCustomSelect(elements.preorder.customStatusSelect.wrapper, false);
    });

    // selects keyboard nav
    setupKeyboardNavForSelect(elements.home.customSelect.wrapper);
    setupKeyboardNavForSelect(elements.preorder.customSelect.wrapper);
    setupKeyboardNavForSelect(elements.preorder.customStatusSelect.wrapper);
    setupKeyboardNavForSelect(elements.accounts.customSelect.wrapper);

    // search home
    let debounceHome;
    elements.home.searchInput.addEventListener('input', e => {
      clearTimeout(debounceHome);
      debounceHome = setTimeout(() => { state.home.searchQuery = e.target.value.trim(); renderHomeList(); }, 180);
    });

    // modal handlers
    elements.paymentModal.closeBtn.addEventListener('click', closePaymentModal);
    elements.paymentModal.modal.addEventListener('click', e => { if (e.target === elements.paymentModal.modal) closePaymentModal(); });

    // load initial home
    loadCatalog();
  }

  // Boot
  initializeApp();
})();
