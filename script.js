(function () {
  'use strict';

  const config = {
    sheetId: '1B0XPR4uSvRzy9LfzWDjNjwAyMZVtJs6_Kk_r2fh7dTw',
    sheets: { katalog: { name: 'Sheet3' }, preorder: { name1: 'Sheet1', name2: 'Sheet2' }, accounts: { name: 'Sheet5' } },
    waNumber: '6285877001999',
    waGreeting: '*Detail pesanan:*',
    paymentOptions: [
      { id: 'seabank', name: 'Seabank', feeType: 'fixed', value: 0 },
      { id: 'gopay', name: 'Gopay', feeType: 'fixed', value: 0 },
      { id: 'dana', name: 'Dana', feeType: 'fixed', value: 125 },
      { id: 'bank_to_dana', name: 'Bank ke Dana', feeType: 'fixed', value: 500 },
      { id: 'qris', name: 'Qris', feeType: 'percentage', value: 0.01 }
    ]
  };

  const elements = {
    html: document.documentElement,
    body: document.body,
    headerLogoLink: document.getElementById('headerLogoLink'),
    burger: document.getElementById('burgerBtn'),
    sidebar: document.getElementById('sidebarNav'),
    sidebarLinks: Array.from(document.querySelectorAll('.sidebar-link[data-mode]')),
    modeButtons: Array.from(document.querySelectorAll('[data-mode]')),
    views: Array.from(document.querySelectorAll('.view')),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    donateBtn: document.getElementById('donateBtn'),
    catalog: {
      search: document.getElementById('catalogSearchInput'),
      category: document.getElementById('catalogCategorySelect'),
      grid: document.getElementById('catalogGrid'),
      skeleton: document.getElementById('catalogSkeleton'),
      empty: document.getElementById('catalogEmpty')
    },
    preorder: {
      displayMode: document.getElementById('preorderDisplayMode'),
      search: document.getElementById('preorderSearchInput'),
      status: document.getElementById('preorderStatusSelect'),
      list: document.getElementById('preorderListContainer'),
      prev: document.getElementById('preorderPrevBtn'),
      next: document.getElementById('preorderNextBtn'),
      pageInfo: document.getElementById('preorderPageInfo'),
      total: document.getElementById('preorderTotal')
    },
    accountsList: document.getElementById('accountsList'),
    modal: {
      root: document.getElementById('buyModal'),
      backdrop: document.querySelector('#buyModal .modal-backdrop'),
      closeBtn: document.getElementById('modalCloseBtn'),
      title: document.getElementById('modalTitle'),
      price: document.getElementById('modalPrice'),
      username: document.getElementById('modalUsername'),
      qty: document.getElementById('modalQty'),
      paymentOptions: document.getElementById('paymentOptionsContainer'),
      fee: document.getElementById('modalFee'),
      total: document.getElementById('modalTotal'),
      continueBtn: document.getElementById('continueToWaBtn')
    },
    waContactBtn: document.getElementById('waContactBtn')
  };

  let allCatalog = [];
  let preorderDataCompact = [];
  let preorderDataDetailed = [];
  let accountsData = [];
  let currentMode = 'home';
  let currentPage = 1;
  const pageSize = 10;
  let selectedItem = null;
  let selectedPayment = null;

  function setMode(mode) {
    currentMode = mode;
    elements.views.forEach(v => v.classList.toggle('active', v.dataset.view === mode));
    elements.body.classList.remove('sidebar-open');
    elements.burger.setAttribute('aria-expanded', 'false');
    const view = elements.views.find(v => v.dataset.view === mode);
    if (view) view.focus({ preventScroll: true });
    if (mode === 'katalog' && allCatalog.length === 0) loadCatalog();
    if (mode === 'preorder' && preorderDataCompact.length === 0) loadPreorder();
    if (mode === 'akun' && accountsData.length === 0) loadAccounts();
  }

  function toggleSidebar(forceOpen) {
    const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !elements.body.classList.contains('sidebar-open');
    elements.body.classList.toggle('sidebar-open', isOpen);
    elements.burger.setAttribute('aria-expanded', String(isOpen));
  }

  function initNav() {
    elements.burger.addEventListener('click', () => toggleSidebar());
    elements.headerLogoLink.addEventListener('click', e => { e.preventDefault(); setMode('home'); });
    elements.headerLogoLink.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMode('home'); } });
    elements.sidebarLinks.forEach(link => {
      function go(e) { e.preventDefault(); setMode(link.dataset.mode); }
      link.addEventListener('click', go);
      link.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(e); });
    });
    elements.modeButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        const mode = btn.getAttribute('data-mode');
        if (mode) { e.preventDefault(); setMode(mode); }
      });
    });
  }

  function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      elements.html.classList.toggle('light', saved === 'light');
    } else {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      elements.html.classList.toggle('light', prefersLight);
    }
    elements.themeToggleBtn.addEventListener('click', () => {
      const nowLight = !elements.html.classList.contains('light');
      elements.html.classList.toggle('light', nowLight);
      localStorage.setItem('theme', nowLight ? 'light' : 'dark');
      elements.themeToggleBtn.setAttribute('aria-pressed', nowLight ? 'true' : 'false');
    });
  }

  function formatIDR(n) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
  }

  function parseGviz(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1));
  }

  async function fetchGviz(sheetName, signal) {
    const url = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, { signal });
    const txt = await res.text();
    const json = parseGviz(txt);
    if (!json || !json.table || !json.table.rows) return [];
    return json.table.rows.map(r => (r.c || []).map(c => (c ? c.v : '')));
  }

  function buildCategoryOptions(data) {
    const categoryMap = new Map();
    data.forEach(row => {
      const catKey = String(row[2] || '').trim();
      const catLabel = String(row[3] || '').trim() || catKey;
      if (catKey) categoryMap.set(catKey, catLabel);
    });
    const layananCategories = [...categoryMap].map(([key, label]) => ({ key, label }));
    const select = elements.catalog.category;
    select.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = 'Semua Kategori';
    select.appendChild(optAll);
    layananCategories.sort((a, b) => a.label.localeCompare(b.label, 'id')).forEach(({ key, label }) => {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = label;
      select.appendChild(o);
    });
  }

  function renderCatalog(data) {
    const grid = elements.catalog.grid;
    grid.innerHTML = '';
    if (data.length === 0) {
      elements.catalog.empty.hidden = false;
      return;
    }
    elements.catalog.empty.hidden = true;
    data.forEach(row => {
      const title = String(row[0] || '');
      const price = Number(row[1] || 0);
      const catKey = String(row[2] || '');
      const catLabel = String(row[3] || catKey);
      const card = document.createElement('div');
      card.className = 'card';
      const header = document.createElement('div');
      header.className = 'card-header';
      const left = document.createElement('div');
      const t = document.createElement('div');
      t.className = 'card-title';
      t.textContent = title;
      const s = document.createElement('div');
      s.className = 'card-sub';
      s.textContent = catLabel;
      left.appendChild(t);
      left.appendChild(s);
      const actions = document.createElement('div');
      actions.className = 'card-actions';
      const buy = document.createElement('button');
      buy.className = 'btn primary';
      buy.type = 'button';
      buy.textContent = 'Beli';
      buy.addEventListener('click', () => openBuyModal({ title, price, catKey, catLabel }));
      actions.appendChild(buy);
      header.appendChild(left);
      header.appendChild(actions);
      const priceEl = document.createElement('div');
      priceEl.textContent = formatIDR(price);
      card.appendChild(header);
      card.appendChild(priceEl);
      grid.appendChild(card);
    });
  }

  function filterCatalog() {
    const q = elements.catalog.search.value.trim().toLowerCase();
    const cat = elements.catalog.category.value;
    const filtered = allCatalog.filter(row => {
      const title = String(row[0] || '').toLowerCase();
      const catKey = String(row[2] || '').toLowerCase();
      const okCat = cat === 'all' || catKey === cat.toLowerCase();
      const okQ = !q || title.includes(q);
      return okCat && okQ;
    });
    renderCatalog(filtered);
  }

  async function loadCatalog() {
    elements.catalog.skeleton.hidden = false;
    allCatalog = await fetchGviz(config.sheets.katalog.name).catch(() => []);
    elements.catalog.skeleton.hidden = true;
    buildCategoryOptions(allCatalog);
    filterCatalog();
  }

  function normalizeStatus(x) {
    const v = String(x || '').toLowerCase().trim();
    if (['progress', 'proses', 'processing', 'onprogress', 'diproses'].includes(v)) return 'progress';
    if (['pending', 'menunggu', 'wait'].includes(v)) return 'pending';
    if (['success', 'sukses', 'done', 'berhasil', 'selesai'].includes(v)) return 'success';
    if (['failed', 'gagal', 'error'].includes(v)) return 'failed';
    return 'pending';
  }

  function renderPreorder(list) {
    elements.preorder.list.innerHTML = '';
    const start = (currentPage - 1) * pageSize;
    const slice = list.slice(start, start + pageSize);
    slice.forEach(row => {
      const mode = elements.preorder.displayMode.value;
      const card = document.createElement('div');
      card.className = 'card';
      const header = document.createElement('div');
      header.className = 'card-header';
      const left = document.createElement('div');
      const nameEl = document.createElement('div');
      nameEl.className = 'card-title';
      const productEl = document.createElement('div');
      productEl.className = 'card-sub';
      const statusEl = document.createElement('div');
      const statusVal = normalizeStatus(mode === 'detailed' ? row[6] : row[2]);
      statusEl.className = 'status-badge ' + statusVal;
      statusEl.textContent = statusVal.toUpperCase();
      if (mode === 'detailed') {
        nameEl.textContent = row[2] || 'Tanpa Nama';
        productEl.textContent = row[5] || 'N/A';
      } else {
        nameEl.textContent = row[0] || 'Tanpa Nomor';
        productEl.textContent = row[1] || 'N/A';
      }
      left.appendChild(nameEl);
      left.appendChild(productEl);
      header.appendChild(left);
      header.appendChild(statusEl);
      card.appendChild(header);
      if (mode === 'detailed') {
        const g = document.createElement('div');
        g.className = 'grid';
        const fields = [
          ['Tanggal', row[0]],
          ['Invoice', row[1]],
          ['Nama', row[2]],
          ['Kontak', row[3]],
          ['Catatan', row[4]],
          ['Produk', row[5]],
          ['Status', row[6]]
        ];
        fields.forEach(([k, v]) => {
          const f = document.createElement('div');
          const a = document.createElement('div');
          const b = document.createElement('div');
          a.className = 'card-sub';
          a.textContent = k;
          b.textContent = String(v || '');
          f.appendChild(a);
          f.appendChild(b);
          g.appendChild(f);
        });
        card.appendChild(g);
      }
      elements.preorder.list.appendChild(card);
    });
  }

  function filterPreorder() {
    const mode = elements.preorder.displayMode.value;
    const q = elements.preorder.search.value.trim().toLowerCase();
    const st = elements.preorder.status.value;
    const rows = mode === 'detailed' ? preorderDataDetailed : preorderDataCompact;
    const filtered = rows.filter(row => {
      const hay = (row.join(' ') || '').toLowerCase();
      const okQ = !q || hay.includes(q);
      const statusVal = normalizeStatus(mode === 'detailed' ? row[6] : row[2]);
      const okS = st === 'all' || statusVal === st;
      return okQ && okS;
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    elements.preorder.pageInfo.textContent = `${currentPage} / ${totalPages}`;
    elements.preorder.total.textContent = `${filtered.length} data`;
    elements.preorder.prev.disabled = currentPage === 1;
    elements.preorder.next.disabled = currentPage === totalPages;
    renderPreorder(filtered);
  }

  async function loadPreorder() {
    const [c, d] = await Promise.all([
      fetchGviz(config.sheets.preorder.name2).catch(() => []),
      fetchGviz(config.sheets.preorder.name1).catch(() => [])
    ]);
    preorderDataCompact = c;
    preorderDataDetailed = d;
    currentPage = 1;
    filterPreorder();
  }

  async function loadAccounts() {
    accountsData = await fetchGviz(config.sheets.accounts.name).catch(() => []);
    elements.accountsList.innerHTML = '';
    accountsData.forEach(row => {
      const card = document.createElement('div');
      card.className = 'card';
      const h = document.createElement('div');
      h.className = 'card-header';
      const name = document.createElement('div');
      name.className = 'card-title';
      name.textContent = row[0] || '';
      const sub = document.createElement('div');
      sub.className = 'card-sub';
      sub.textContent = row[1] || '';
      const left = document.createElement('div');
      left.appendChild(name);
      left.appendChild(sub);
      h.appendChild(left);
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = row[2] || '';
      h.appendChild(badge);
      card.appendChild(h);
      elements.accountsList.appendChild(card);
    });
  }

  function openBuyModal(item) {
    selectedItem = item;
    selectedPayment = null;
    elements.modal.title.textContent = item.title;
    elements.modal.price.textContent = formatIDR(item.price);
    elements.modal.username.value = '';
    elements.modal.qty.value = '1';
    elements.modal.paymentOptions.innerHTML = '';
    config.paymentOptions.forEach(opt => {
      const row = document.createElement('label');
      row.className = 'payment-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'payment';
      input.value = opt.id;
      input.addEventListener('change', () => { selectedPayment = opt; updatePaymentTotal(); });
      const spanName = document.createElement('span');
      spanName.textContent = opt.name;
      const spanFee = document.createElement('span');
      spanFee.className = 'card-sub';
      spanFee.textContent = opt.feeType === 'fixed' ? formatIDR(opt.value) : `${(opt.value * 100).toFixed(0)}%`;
      row.appendChild(input);
      row.appendChild(spanName);
      row.appendChild(spanFee);
      elements.modal.paymentOptions.appendChild(row);
    });
    elements.modal.fee.textContent = formatIDR(0);
    elements.modal.total.textContent = formatIDR(item.price);
    elements.modal.continueBtn.href = '#';
    elements.modal.root.hidden = false;
  }

  function updatePaymentTotal() {
    if (!selectedItem) return;
    const qty = Math.max(1, parseInt(elements.modal.qty.value || '1', 10));
    const base = selectedItem.price * qty;
    const fee = selectedPayment ? (selectedPayment.feeType === 'fixed' ? selectedPayment.value : Math.round(base * selectedPayment.value)) : 0;
    const total = base + fee;
    elements.modal.fee.textContent = formatIDR(fee);
    elements.modal.total.textContent = formatIDR(total);
    const uname = encodeURIComponent(elements.modal.username.value.trim());
    const title = encodeURIComponent(selectedItem.title);
    const pesan = encodeURIComponent(`${config.waGreeting}\n\n• Produk: ${selectedItem.title}\n• Jumlah: ${qty}\n• Total: ${formatIDR(total)}\n• Pembayaran: ${selectedPayment ? selectedPayment.name : '-'}\n• ID/Nickname: ${elements.modal.username.value.trim() || '-'}`);
    const link = `https://wa.me/${config.waNumber}?text=${pesan}`;
    elements.modal.continueBtn.href = link;
  }

  function closeModal() {
    elements.modal.root.hidden = true;
  }

  function initModal() {
    elements.modal.closeBtn.addEventListener('click', closeModal);
    elements.modal.backdrop.addEventListener('click', closeModal);
    elements.modal.qty.addEventListener('input', updatePaymentTotal);
    elements.modal.username.addEventListener('input', updatePaymentTotal);
  }

  function initCatalogControls() {
    elements.catalog.search.addEventListener('input', filterCatalog);
    elements.catalog.category.addEventListener('change', filterCatalog);
  }

  function initPreorderControls() {
    elements.preorder.displayMode.addEventListener('change', () => { currentPage = 1; filterPreorder(); });
    elements.preorder.search.addEventListener('input', () => { currentPage = 1; filterPreorder(); });
    elements.preorder.status.addEventListener('change', () => { currentPage = 1; filterPreorder(); });
    elements.preorder.prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; filterPreorder(); } });
    elements.preorder.next.addEventListener('click', () => { currentPage++; filterPreorder(); });
  }

  function initContact() {
    if (elements.waContactBtn) {
      const text = encodeURIComponent('Halo kak, saya mau tanya soal pesanan.');
      elements.waContactBtn.href = `https://wa.me/${config.waNumber}?text=${text}`;
    }
  }

  function initDonate() {
    if (elements.donateBtn) {
      elements.donateBtn.addEventListener('click', () => {
        window.open('https://saweria.co/playpal', '_blank', 'noopener,noreferrer');
      });
    }
  }

  function boot() {
    initTheme();
    initNav();
    initCatalogControls();
    initPreorderControls();
    initModal();
    initContact();
    initDonate();
    setMode('home');
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !elements.modal.root.hidden) closeModal();
  });

  document.addEventListener('click', e => {
    const target = e.target.closest('[data-mode]');
    if (target && target.tagName === 'A') e.preventDefault();
  });

  boot();
})();
