(function () {
  'use strict';

  const config = {
    sheetId: '1B0XPR4uSvRzy9LfzWDjNjwAyMZVtJs6_Kk_r2fh7dTw',
    sheets: {
      katalog: { name: 'Sheet3' },
      preorder: { name1: 'Sheet1', name2: 'Sheet2' },
      accounts: { name: 'Sheet5' }
    },
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

  let allCatalogData = [];
  let currentSelectedItem = null;

  const state = {
    layanan: { activeCategory: '', searchQuery: '' },
    home: { searchQuery: '' },
    preorder: { initialized: false, allData: [], currentPage: 1, perPage: 15, displayMode: 'detailed' },
    accounts: { initialized: false, data: [], currentIndex: 0, currentAccount: null }
  };

  function el(id){ return document.getElementById(id); }

  const elements = {
    sidebar: {
      nav: el('sidebarNav'),
      overlay: el('sidebarOverlay'),
      burger: el('burgerBtn'),
      links: document.querySelectorAll('.sidebar-nav .nav-item')
    },
    themeToggle: el('themeToggleBtn'),
    viewHome: el('viewHome'),
    viewLayanan: el('viewLayanan'),
    viewPreorder: el('viewPreorder'),
    viewAccounts: el('viewAccounts'),
    viewPerpustakaan: el('viewPerpustakaan'),
    viewFilm: el('viewFilm'),
    home: {
      listContainer: el('homeListContainer'),
      searchInput: el('homeSearchInput'),
      countInfo: el('homeCountInfo'),
      errorContainer: el('homeErrorContainer')
    },
    layanan: {
      listContainer: el('layananListContainer'),
      searchInput: el('layananSearchInput'),
      countInfo: el('layananCountInfo'),
      errorContainer: el('layananErrorContainer'),
      customSelect: {
        wrapper: el('layananCustomSelectWrapper'),
        btn: el('layananCustomSelectBtn'),
        value: el('layananCustomSelectValue'),
        options: el('layananCustomSelectOptions')
      }
    },
    itemTemplate: el('itemTemplate'),
    skeletonItemTemplate: el('skeletonItemTemplate'),
    skeletonCardTemplate: el('skeletonCardTemplate'),
    paymentModal: {
      modal: el('paymentModal'),
      closeBtn: el('closeModalBtn'),
      itemName: el('modalItemName'),
      itemPrice: el('modalItemPrice'),
      optionsContainer: el('paymentOptionsContainer'),
      fee: el('modalFee'),
      total: el('modalTotal'),
      waBtn: el('continueToWaBtn')
    },
    preorder: {
      searchInput: el('preorderSearchInput'),
      statusSelect: el('preorderStatusSelect'),
      listContainer: el('preorderListContainer'),
      prevBtn: el('preorderPrevBtn'),
      nextBtn: el('preorderNextBtn'),
      pageInfo: el('preorderPageInfo'),
      total: el('preorderTotal'),
      customSelect: {
        wrapper: el('preorderCustomSelectWrapper'),
        btn: el('preorderCustomSelectBtn'),
        value: el('preorderCustomSelectValue'),
        options: el('preorderCustomSelectOptions')
      }
    },
    accounts: {
      display: el('accountDisplay'),
      empty: el('accountEmpty'),
      error: el('accountError'),
      carousel: {
        track: el('carouselTrack'),
        prevBtn: el('carouselPrevBtn'),
        nextBtn: el('carouselNextBtn'),
        indicators: el('carouselIndicators')
      },
      price: el('accountPrice'),
      status: el('accountStatus'),
      description: el('accountDescription'),
      buyBtn: el('buyAccountBtn'),
      offerBtn: el('offerAccountBtn'),
      customSelect: {
        wrapper: el('accountCustomSelectWrapper'),
        btn: el('accountCustomSelectBtn'),
        value: el('accountCustomSelectValue'),
        options: el('accountCustomSelectOptions')
      }
    }
  };

  function formatToIdr(value){
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  }
  function getSheetUrl(sheetName, format='json'){
    const base = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`;
    const s = encodeURIComponent(sheetName);
    return format === 'csv' ? `${base}?tqx=out:csv&sheet=${s}` : `${base}?sheet=${s}&tqx=out:json`;
  }
  function showSkeleton(container, template, count=6){
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i=0;i<count;i++){ frag.appendChild(template.content.cloneNode(true)); }
    container.appendChild(frag);
  }

  function applyTheme(theme){
    document.body.classList.toggle('dark-mode', theme === 'dark');
    elements.themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }
  function initTheme(){
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  }
  function toggleTheme(){
    const isDark = document.body.classList.contains('dark-mode');
    const next = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
  }

  function toggleSidebar(forceOpen){
    const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open', isOpen);
    elements.sidebar.burger.classList.toggle('active', isOpen);
    elements.sidebar.burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    elements.sidebar.overlay.hidden = !isOpen;
  }

  function setMode(nextMode){
    if (nextMode === 'donasi') {
      window.open('https://saweria.co/playpal', '_blank', 'noopener');
      return;
    }
    const map = {
      home: elements.viewHome,
      layanan: elements.viewLayanan,
      preorder: elements.viewPreorder,
      accounts: elements.viewAccounts,
      perpustakaan: elements.viewPerpustakaan,
      film: elements.viewFilm
    };
    const view = map[nextMode];
    if (!view) return;
    document.querySelector('.view-section.active')?.classList.remove('active');
    view.classList.add('active');
    elements.sidebar.links.forEach(link => link.classList.toggle('active', link.dataset.mode === nextMode));
    if (window.innerWidth < 769) toggleSidebar(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (nextMode === 'preorder' && !state.preorder.initialized) initializePreorder();
    if (nextMode === 'accounts' && !state.accounts.initialized) initializeAccounts();
  }

  function parseGvizPairs(text){
    const match = text.match(/\{.*\}/s);
    if (!match) throw new Error('Invalid GViz response.');
    const obj = JSON.parse(match[0]);
    const { rows = [], cols = [] } = obj.table || {};
    const pairs = Array.from({ length: Math.floor(cols.length / 2) }, (_, i) => ({
      iTitle: i * 2,
      iPrice: i * 2 + 1,
      label: cols[i * 2]?.label || ''
    })).filter(p => p.label && cols[p.iPrice]);
    const out = [];
    for (const r of rows){
      const c = r.c || [];
      for (const p of pairs){
        const title = String(c[p.iTitle]?.v || '').trim();
        const priceRaw = c[p.iPrice]?.v;
        const price = priceRaw != null && priceRaw !== '' ? Number(priceRaw) : NaN;
        if (title && !isNaN(price)){
          out.push({ catKey: p.label, catLabel: String(p.label || '').trim().replace(/\s+/g, ' '), title, price });
        }
      }
    }
    return out;
  }

  function toggleCustomSelect(wrapper, forceOpen){
    const btn = wrapper.querySelector('.custom-select-btn');
    const open = typeof forceOpen === 'boolean' ? forceOpen : !wrapper.classList.contains('open');
    wrapper.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function buildLayananCategorySelect(layananData){
    const { options, value } = elements.layanan.customSelect;
    const map = new Map();
    layananData.forEach(item => { if (!map.has(item.catKey)) map.set(item.catKey, item.catLabel); });
    const cats = [...map].map(([key, label]) => ({ key, label }));
    options.innerHTML = '';
    cats.forEach((cat, index) => {
      const opt = document.createElement('div');
      opt.className = 'custom-select-option';
      opt.textContent = cat.label;
      opt.dataset.value = cat.key;
      opt.setAttribute('role', 'option');
      opt.addEventListener('click', () => {
        state.layanan.activeCategory = cat.key;
        value.textContent = cat.label;
        document.querySelector('#layananCustomSelectOptions .custom-select-option.selected')?.classList.remove('selected');
        opt.classList.add('selected');
        toggleCustomSelect(elements.layanan.customSelect.wrapper, false);
        renderLayananList();
      }, { passive: true });
      if (index === 0) opt.classList.add('selected');
      options.appendChild(opt);
    });
    if (cats.length > 0){
      state.layanan.activeCategory = cats[0].key;
      value.textContent = cats[0].label;
    } else {
      value.textContent = 'Data tidak tersedia';
    }
  }

  function renderList(container, countEl, items, emptyText){
    container.innerHTML = '';
    if (items.length === 0){
      container.innerHTML = `<div class="empty"><div class="empty-content"><svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" viewBox="0 0 24 24"><path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg><p>${emptyText}</p></div></div>`;
      countEl.textContent = '';
      return;
    }
    const frag = document.createDocumentFragment();
    const maxAnimated = 20;
    items.forEach((item, index) => {
      const clone = elements.itemTemplate.content.cloneNode(true);
      const btn = clone.querySelector('.list-item');
      if (index < maxAnimated) btn.style.animationDelay = `${index * 50}ms`;
      btn.querySelector('.title').textContent = item.title;
      btn.querySelector('.price').textContent = formatToIdr(item.price);
      btn.addEventListener('click', (e) => { e.stopPropagation(); openPaymentModal(item); });
      frag.appendChild(clone);
    });
    window.requestAnimationFrame(() => container.appendChild(frag));
    countEl.textContent = `${items.length} item ditemukan`;
  }

  function renderHomeList(){
    const q = state.home.searchQuery.toLowerCase();
    const key = allCatalogData.length > 0 ? allCatalogData[0].catKey : null;
    const items = key ? allCatalogData.filter(x => x.catKey === key && (q === '' || x.title.toLowerCase().includes(q) || String(x.price).includes(q))) : [];
    renderList(elements.home.listContainer, elements.home.countInfo, items, 'Tidak ada promo ditemukan.');
  }

  function renderLayananList(){
    const { activeCategory, searchQuery } = state.layanan;
    const q = searchQuery.toLowerCase();
    const items = allCatalogData.filter(x => x.catKey === activeCategory && (q === '' || x.title.toLowerCase().includes(q) || String(x.price).includes(q)));
    renderList(elements.layanan.listContainer, elements.layanan.countInfo, items, 'Tidak ada hasil ditemukan.');
  }

  async function loadCatalog(){
    try{
      [elements.home.errorContainer, elements.layanan.errorContainer].forEach(el => el.style.display = 'none');
      showSkeleton(elements.home.listContainer, elements.skeletonItemTemplate, 6);
      showSkeleton(elements.layanan.listContainer, elements.skeletonItemTemplate, 6);
      const res = await fetch(getSheetUrl(config.sheets.katalog.name));
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
      const text = await res.text();
      allCatalogData = parseGvizPairs(text);
      if (allCatalogData.length === 0) throw new Error('Data is empty or format is incorrect.');
      buildLayananCategorySelect(allCatalogData);
      renderHomeList();
      renderLayananList();
    } catch {
      [elements.home, elements.layanan].forEach(view => {
        view.listContainer.innerHTML = '';
        view.errorContainer.style.display = 'block';
        view.errorContainer.textContent = 'Oops, terjadi kesalahan. Silakan coba lagi nanti.';
      });
    }
  }

  function calculateFee(price, option){
    if (option.feeType === 'fixed') return option.value;
    if (option.feeType === 'percentage') return Math.ceil(price * option.value);
    return 0;
  }
  function updateWaLink(option, fee, total){
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
  function updatePriceDetails(){
    const selectedId = document.querySelector('input[name="payment"]:checked')?.value;
    if (!selectedId) return;
    const opt = config.paymentOptions.find(o => o.id === selectedId);
    if (!currentSelectedItem || !opt) return;
    const price = currentSelectedItem.price;
    const fee = calculateFee(price, opt);
    const total = price + fee;
    elements.paymentModal.fee.textContent = formatToIdr(fee);
    elements.paymentModal.total.textContent = formatToIdr(total);
    updateWaLink(opt, fee, total);
  }
  function openPaymentModal(item){
    currentSelectedItem = item;
    const { modal, itemName, itemPrice, optionsContainer } = elements.paymentModal;
    itemName.textContent = item.title;
    itemPrice.textContent = formatToIdr(item.price);
    optionsContainer.innerHTML = '';
    config.paymentOptions.forEach((option, index) => {
      const fee = calculateFee(item.price, option);
      optionsContainer.insertAdjacentHTML('beforeend',
        `<div class="payment-option">
           <input type="radio" id="${option.id}" name="payment" value="${option.id}" ${index === 0 ? 'checked' : ''}>
           <label for="${option.id}">${option.name}<span style="float:right;">+ ${formatToIdr(fee)}</span></label>
         </div>`
      );
    });
    optionsContainer.querySelectorAll('input[name="payment"]').forEach(input => input.addEventListener('change', updatePriceDetails));
    updatePriceDetails();
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('visible'));
  }
  function closePaymentModal(){
    const { modal } = elements.paymentModal;
    modal.classList.remove('visible');
    setTimeout(() => { modal.style.display = 'none'; currentSelectedItem = null; }, 200);
  }

  function normalizeStatus(raw){
    const s = String(raw || '').trim().toLowerCase();
    if (['success','selesai','berhasil','done'].includes(s)) return 'success';
    if (['progress','proses','diproses','processing'].includes(s)) return 'progress';
    if (['failed','gagal','dibatalkan','cancel','error'].includes(s)) return 'failed';
    return 'pending';
  }
  function filterPreorderData(){
    const { searchInput, statusSelect } = elements.preorder;
    const q = searchInput.value.trim().toLowerCase();
    const statusFilter = statusSelect.value;
    const mode = state.preorder.displayMode;
    return state.preorder.allData.filter(item => {
      const status = normalizeStatus(item[mode === 'detailed' ? 6 : 2]);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (mode === 'detailed'){
        const product = (item[3] || '').toLowerCase();
        const nickname = (item[5] || '').toLowerCase();
        const idGift = (item[7] || '').toLowerCase();
        return product.includes(q) || nickname.includes(q) || idGift.includes(q);
      } else {
        const orderNum = (item[0] || '').toLowerCase();
        const product = (item[1] || '').toLowerCase();
        return orderNum.includes(q) || product.includes(q);
      }
    });
  }
  function updatePreorderPagination(currentPage, totalPages){
    elements.preorder.prevBtn.disabled = currentPage <= 1;
    elements.preorder.nextBtn.disabled = currentPage >= totalPages;
    elements.preorder.pageInfo.textContent = totalPages > 0 ? `Hal ${currentPage} dari ${totalPages}` : '';
  }
  function renderPreorderCards(){
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
    if (pageData.length === 0){
      listContainer.innerHTML = `<div class="empty"><div class="empty-content"><svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" viewBox="0 0 24 24"><path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg><p>Tidak Ada Hasil Ditemukan</p></div></div>`;
      updatePreorderPagination(0, 0);
      return;
    }

    const frag = document.createDocumentFragment();
    pageData.forEach(item => {
      const card = document.createElement('article');
      if (state.preorder.displayMode === 'detailed'){
        const [tglOrder, estPengiriman, , product, bulan, name, statusRaw] = item;
        const status = normalizeStatus(statusRaw);
        const estText = estPengiriman ? `Estimasi Pengiriman: ${estPengiriman} 20:00 WIB` : '';
        const details = [
          { label: 'TGL ORDER', value: tglOrder },
          { label: 'BULAN', value: bulan }
        ];
        const detailsHtml = details.filter(d => d.value && String(d.value).trim() !== '')
          .map(d => `<div class="detail-item"><div class="detail-label">${d.label}</div><div class="detail-value">${d.value}</div></div>`).join('');
        const expandHtml = detailsHtml ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" class="expand-indicator"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>` : '';
        card.className = `card ${detailsHtml ? 'clickable' : ''}`;
        card.innerHTML =
          `<div class="card-header">
             <div>
               <div class="card-name">${name || 'Tanpa Nama'}</div>
               <div class="card-product">${product || 'N/A'}</div>
             </div>
             <div class="status-badge-wrapper">
               <div class="status-badge ${status}">${(statusRaw || 'Pending').toUpperCase()}</div>
               ${expandHtml}
             </div>
           </div>
           ${estText ? `<div class="card-date">${estText}</div>` : ''}
           ${detailsHtml ? `<div class="card-details"><div class="details-grid">${detailsHtml}</div></div>` : ''}`;
        if (detailsHtml) card.addEventListener('click', () => card.classList.toggle('expanded'));
      } else {
        const [orderNum, product, statusRaw] = item;
        const status = normalizeStatus(statusRaw);
        card.className = 'card';
        card.innerHTML =
          `<div class="card-header">
             <div>
               <div class="card-name">${orderNum || 'Tanpa Nomor'}</div>
               <div class="card-product">${product || 'N/A'}</div>
             </div>
             <div class="status-badge ${status}">${(statusRaw || 'Pending').toUpperCase()}</div>
           </div>`;
      }
      frag.appendChild(card);
    });

    listContainer.appendChild(frag);
    updatePreorderPagination(state.preorder.currentPage, totalPages);
  }

  function sortPreorderData(data, mode){
    const order = { progress: 1, pending: 2, success: 3, failed: 4 };
    const idx = mode === 'detailed' ? 6 : 2;
    return data.sort((a, b) => order[normalizeStatus(a[idx])] - order[normalizeStatus(b[idx])]);
  }

  async function fetchPreorderData(sheetName){
    const { listContainer, total } = elements.preorder;
    total.textContent = 'Memuat data...';
    showSkeleton(listContainer, elements.skeletonCardTemplate, 5);
    state.preorder.displayMode = sheetName === config.sheets.preorder.name1 ? 'detailed' : 'simple';
    try{
      const res = await fetch(getSheetUrl(sheetName, 'csv'));
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
      const text = await res.text();
      let rows = robustCsvParser(text);
      if (rows.length < 2){
        state.preorder.allData = [];
      } else {
        rows.shift();
        const dataRows = rows.filter(row => row && (row[0] || '').trim() !== '');
        state.preorder.allData = sortPreorderData(dataRows, state.preorder.displayMode);
      }
    } catch {
      state.preorder.allData = [];
      total.textContent = 'Gagal memuat data.';
    } finally {
      state.preorder.currentPage = 1;
      renderPreorderCards();
    }
  }

  function initializePreorder(){
    if (state.preorder.initialized) return;
    const rebound = () => { state.preorder.currentPage = 1; renderPreorderCards(); };
    const { searchInput, statusSelect, customSelect, prevBtn, nextBtn } = elements.preorder;

    searchInput.addEventListener('input', rebound);
    statusSelect.addEventListener('change', rebound);
    customSelect.options.querySelectorAll('.custom-select-option').forEach(option => {
      option.addEventListener('click', e => {
        const selectedValue = e.target.dataset.value;
        const selectedText = e.target.textContent;
        customSelect.value.textContent = selectedText;
        document.querySelector('#preorderCustomSelectOptions .custom-select-option.selected')?.classList.remove('selected');
        e.target.classList.add('selected');
        const sheet = selectedValue === '0' ? config.sheets.preorder.name1 : config.sheets.preorder.name2;
        fetchPreorderData(sheet);
        toggleCustomSelect(customSelect.wrapper, false);
      }, { passive: true });
    });

    prevBtn.addEventListener('click', () => {
      if (state.preorder.currentPage > 1){
        state.preorder.currentPage--;
        renderPreorderCards();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    nextBtn.addEventListener('click', () => {
      state.preorder.currentPage++;
      renderPreorderCards();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    fetchPreorderData(config.sheets.preorder.name1);
    state.preorder.initialized = true;
  }

  function robustCsvParser(text){
    const normalized = text.trim().replace(/\r\n/g, '\n');
    const rows = [];
    let currentRow = [], currentField = '', inQuoted = false;
    for (let i=0;i<normalized.length;i++){
      const ch = normalized[i];
      if (inQuoted){
        if (ch === '"'){
          if (i + 1 < normalized.length && normalized[i+1] === '"'){ currentField += '"'; i++; }
          else { inQuoted = false; }
        } else { currentField += ch; }
      } else {
        if (ch === '"'){ inQuoted = true; }
        else if (ch === ','){ currentRow.push(currentField); currentField = ''; }
        else if (ch === '\n'){ currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = ''; }
        else { currentField += ch; }
      }
    }
    currentRow.push(currentField);
    rows.push(currentRow);
    return rows;
  }

  async function parseAccountsSheet(text){
    const rows = robustCsvParser(text);
    rows.shift();
    return rows
      .filter(row => row && row.length >= 5 && row[0])
      .map(row => ({
        title: row[0] || 'Tanpa Judul',
        price: Number(row[1]) || 0,
        status: row[2] || 'Tersedia',
        description: row[3] || 'Tidak ada deskripsi.',
        images: (row[4] || '').split(',').map(url => url.trim()).filter(Boolean)
      }));
  }

  function populateAccountSelect(){
    const { customSelect, empty } = elements.accounts;
    const { options, value } = customSelect;
    options.innerHTML = '';
    if (state.accounts.data.length === 0){
      value.textContent = 'Tidak ada akun';
      empty.style.display = 'block';
      return;
    }
    value.textContent = 'Pilih Akun';
    state.accounts.data.forEach((acc, index) => {
      const opt = document.createElement('div');
      opt.className = 'custom-select-option';
      opt.textContent = acc.title;
      opt.dataset.value = index;
      opt.setAttribute('role', 'option');
      opt.addEventListener('click', () => {
        value.textContent = acc.title;
        document.querySelector('#accountCustomSelectOptions .custom-select-option.selected')?.classList.remove('selected');
        opt.classList.add('selected');
        toggleCustomSelect(customSelect.wrapper, false);
        renderAccount(index);
      }, { passive: true });
      options.appendChild(opt);
    });
  }

  function renderAccount(index){
    const { display, empty, price, description, status: statusEl } = elements.accounts;
    const account = state.accounts.data[index];
    state.accounts.currentAccount = account;
    if (!account){
      display.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    display.classList.remove('expanded');
    price.textContent = formatToIdr(account.price);
    description.textContent = account.description;
    statusEl.textContent = account.status;
    statusEl.className = 'account-status-badge';
    statusEl.classList.add(account.status.toLowerCase() === 'tersedia' ? 'available' : 'sold');

    const { track, indicators } = elements.accounts.carousel;
    track.innerHTML = '';
    indicators.innerHTML = '';
    if (account.images && account.images.length > 0){
      account.images.forEach((src, i) => {
        track.insertAdjacentHTML('beforeend', `<div class="carousel-slide"><img src="${src}" alt="Gambar untuk ${account.title}" loading="lazy"></div>`);
        indicators.insertAdjacentHTML('beforeend', `<button class="indicator-dot" data-index="${i}" aria-label="Slide ${i+1}"></button>`);
      });
    } else {
      track.insertAdjacentHTML('beforeend', `<div class="carousel-slide"><div style="display:flex;align-items:center;justify-content:center;height:100%;aspect-ratio:16/9;background:var(--surface-secondary);color:var(--text-tertiary);">Gambar tidak tersedia</div></div>`);
    }
    indicators.querySelectorAll('.indicator-dot').forEach(dot => {
      dot.addEventListener('click', e => {
        e.stopPropagation();
        state.accounts.currentIndex = parseInt(e.target.dataset.index, 10);
        updateCarousel();
      });
    });
    state.accounts.currentIndex = 0;
    updateCarousel();

    empty.style.display = 'none';
    display.style.display = 'block';
  }

  function updateCarousel(){
    const account = state.accounts.currentAccount;
    if (!account) return;
    const { track, prevBtn, nextBtn, indicators } = elements.accounts.carousel;
    const total = account.images.length || 1;
    track.style.transform = `translateX(-${state.accounts.currentIndex * 100}%)`;
    prevBtn.disabled = total <= 1 || state.accounts.currentIndex === 0;
    nextBtn.disabled = total <= 1 || state.accounts.currentIndex >= total - 1;
    indicators.querySelectorAll('.indicator-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === state.accounts.currentIndex);
    });
  }

  function initializeCarousel(){
    const { prevBtn, nextBtn, track } = elements.accounts.carousel;
    prevBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (state.accounts.currentIndex > 0){ state.accounts.currentIndex--; updateCarousel(); }
    });
    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      const account = state.accounts.currentAccount;
      if (!account) return;
      if (state.accounts.currentIndex < account.images.length - 1){ state.accounts.currentIndex++; updateCarousel(); }
    });
    let startX = 0;
    track.addEventListener('touchstart', e => { e.stopPropagation(); startX = e.changedTouches[0].screenX; }, { passive: true });
    track.addEventListener('touchend', e => {
      e.stopPropagation();
      const endX = e.changedTouches[0].screenX;
      if (endX < startX - 50) nextBtn.click();
      if (endX > startX + 50) prevBtn.click();
    }, { passive: true });
  }

  async function initializeAccounts(){
    if (state.accounts.initialized) return;
    const { customSelect, error, empty, display, buyBtn, offerBtn } = elements.accounts;
    error.style.display = 'none';
    try{
      const res = await fetch(getSheetUrl(config.sheets.accounts.name, 'csv'));
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
      const text = await res.text();
      state.accounts.data = await parseAccountsSheet(text);
      populateAccountSelect();
    } catch {
      error.textContent = 'Gagal memuat data akun. Coba lagi nanti.';
      error.style.display = 'block';
      empty.style.display = 'none';
      customSelect.value.textContent = 'Gagal memuat';
    }
    display.addEventListener('click', e => {
      if (!e.target.closest('.action-btn, .carousel-btn, .indicator-dot')) display.classList.toggle('expanded');
    });
    buyBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (state.accounts.currentAccount){
        openPaymentModal({ title: state.accounts.currentAccount.title, price: state.accounts.currentAccount.price, catLabel: 'Akun Game' });
      }
    });
    offerBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (state.accounts.currentAccount){
        const text = `Halo, saya tertarik untuk menawar Akun Game: ${state.accounts.currentAccount.title}`;
        window.open(`https://wa.me/${config.waNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      }
    });
    initializeCarousel();
    state.accounts.initialized = true;
  }

  function initializeApp(){
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());

    elements.themeToggle?.addEventListener('click', toggleTheme);
    elements.sidebar.burger?.addEventListener('click', () => toggleSidebar());
    elements.sidebar.overlay?.addEventListener('click', () => toggleSidebar(false));

    elements.sidebar.links.forEach(link => {
      if (link.dataset.mode){
        link.addEventListener('click', e => {
          e.preventDefault();
          setMode(link.dataset.mode);
        });
      }
    });

    elements.layanan.customSelect.btn.addEventListener('click', () => toggleCustomSelect(elements.layanan.customSelect.wrapper));
    elements.preorder.customSelect.btn.addEventListener('click', () => toggleCustomSelect(elements.preorder.customSelect.wrapper));
    elements.accounts.customSelect.btn.addEventListener('click', () => toggleCustomSelect(elements.accounts.customSelect.wrapper));

    let homeDebounce, layananDebounce;
    elements.home.searchInput.addEventListener('input', e => {
      clearTimeout(homeDebounce);
      homeDebounce = setTimeout(() => { state.home.searchQuery = e.target.value.trim(); renderHomeList(); }, 200);
    });
    elements.layanan.searchInput.addEventListener('input', e => {
      clearTimeout(layananDebounce);
      layananDebounce = setTimeout(() => { state.layanan.searchQuery = e.target.value.trim(); renderLayananList(); }, 200);
    });

    elements.paymentModal.closeBtn.addEventListener('click', closePaymentModal);
    elements.paymentModal.modal.addEventListener('click', e => { if (e.target === elements.paymentModal.modal) closePaymentModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePaymentModal(); });

    initTheme();
    loadCatalog();
  }

  document.addEventListener('DOMContentLoaded', initializeApp);
})();

(function(){
  function install(optionsEl){
    if(!optionsEl) return;
    let abortController;
    function onDown(e){
      if (abortController) abortController.abort();
      abortController = new AbortController();
      let moved = false;
      const threshold = 12 * (window.devicePixelRatio || 1);
      const startX = e.clientX;
      const startY = e.clientY;
      const downTarget = e.target.closest('.custom-select-option');
      function onMove(ev){
        if (Math.abs(ev.clientX - startX) > threshold || Math.abs(ev.clientY - startY) > threshold){
          moved = true; abortController.abort();
        }
      }
      function onUp(){
        if (!moved && downTarget) downTarget.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
        abortController.abort();
      }
      window.addEventListener('pointermove', onMove, { passive: true, signal: abortController.signal });
      window.addEventListener('pointerup', onUp, { once: true, signal: abortController.signal });
    }
    optionsEl.addEventListener('pointerdown', onDown, { passive: true });
  }
  try{
    install(document.getElementById('layananCustomSelectOptions'));
    install(document.getElementById('preorderCustomSelectOptions'));
    install(document.getElementById('accountCustomSelectOptions'));
  } catch{}
})();
