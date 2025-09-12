/**
 * @file script.js
 * @description Main script for the PlayPal.ID single-page application.
 * @version 4.1.0 (Refactored Home View)
 */

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
    waGreeting: '*Detail pesanan:*',
    paymentOptions: [
      { id: 'seabank', name: 'Seabank', feeType: 'fixed', value: 0 },
      { id: 'gopay', name: 'Gopay', feeType: 'fixed', value: 0 },
      { id: 'dana', name: 'Dana', feeType: 'fixed', value: 125 },
      { id: 'bank_to_dana', name: 'Bank ke Dana', feeType: 'fixed', value: 500 },
      { id: 'qris', name: 'Qris', feeType: 'percentage', value: 0.01 },
    ],
  };

  let allCatalogData = [];
  let currentSelectedItem = null;
  let catalogFetchController;
  let preorderFetchController;
  let accountsFetchController;
  let modalFocusTrap = { listener: null, focusableEls: [], firstEl: null, lastEl: null };
  let sidebarFocusTrap = { listener: null, focusableEls: [], firstEl: null, lastEl: null };
  let elementToFocusOnModalClose = null;

  const state = {
    home: { activeCategory: '', searchQuery: '' },
    preorder: {
      initialized: false,
      allData: [],
      currentPage: 1,
      perPage: 15,
      displayMode: 'detailed',
    },
    accounts: {
      initialized: false,
      data: [],
      currentIndex: 0,
      currentAccount: null,
    },
  };

  function getElement(id) {
    return document.getElementById(id);
  }

  const elements = {
    sidebar: {
      nav: getElement('sidebarNav'),
      overlay: getElement('sidebarOverlay'),
      burger: getElement('burgerBtn'),
      links: document.querySelectorAll('.sidebar-nav .nav-item'),
    },
    themeToggle: getElement('themeToggleBtn'),
    viewHome: getElement('viewHome'),
    viewPreorder: getElement('viewPreorder'),
    viewAccounts: getElement('viewAccounts'),
    viewPerpustakaan: getElement('viewPerpustakaan'),
    viewFilm: getElement('viewFilm'),
    home: {
      listContainer: getElement('homeListContainer'),
      searchInput: getElement('homeSearchInput'),
      countInfo: getElement('homeCountInfo'),
      errorContainer: getElement('homeErrorContainer'),
      customSelect: {
        wrapper: getElement('homeCustomSelectWrapper'),
        btn: getElement('homeCustomSelectBtn'),
        value: getElement('homeCustomSelectValue'),
        options: getElement('homeCustomSelectOptions'),
      },
    },
    itemTemplate: getElement('itemTemplate'),
    skeletonItemTemplate: getElement('skeletonItemTemplate'),
    skeletonCardTemplate: getElement('skeletonCardTemplate'),
    paymentModal: {
      modal: getElement('paymentModal'),
      closeBtn: getElement('closeModalBtn'),
      itemName: getElement('modalItemName'),
      itemPrice: getElement('modalItemPrice'),
      optionsContainer: getElement('paymentOptionsContainer'),
      fee: getElement('modalFee'),
      total: getElement('modalTotal'),
      waBtn: getElement('continueToWaBtn'),
    },
    preorder: {
      searchInput: getElement('preorderSearchInput'),
      statusSelect: getElement('preorderStatusSelect'),
      listContainer: getElement('preorderListContainer'),
      prevBtn: getElement('preorderPrevBtn'),
      nextBtn: getElement('preorderNextBtn'),
      pageInfo: getElement('preorderPageInfo'),
      total: getElement('preorderTotal'),
      customSelect: {
        wrapper: getElement('preorderCustomSelectWrapper'),
        btn: getElement('preorderCustomSelectBtn'),
        value: getElement('preorderCustomSelectValue'),
        options: getElement('preorderCustomSelectOptions'),
      },
      customStatusSelect: {
        wrapper: getElement('preorderStatusCustomSelectWrapper'),
        btn: getElement('preorderStatusCustomSelectBtn'),
        value: getElement('preorderStatusCustomSelectValue'),
        options: getElement('preorderStatusCustomSelectOptions'),
      }
    },
    accounts: {
      display: getElement('accountDisplay'),
      empty: getElement('accountEmpty'),
      error: getElement('accountError'),
      carousel: {
        track: getElement('carouselTrack'),
        prevBtn: getElement('carouselPrevBtn'),
        nextBtn: getElement('carouselNextBtn'),
        indicators: getElement('carouselIndicators'),
      },
      price: getElement('accountPrice'),
      status: getElement('accountStatus'),
      description: getElement('accountDescription'),
      buyBtn: getElement('buyAccountBtn'),
      offerBtn: getElement('offerAccountBtn'),
      customSelect: {
        wrapper: getElement('accountCustomSelectWrapper'),
        btn: getElement('accountCustomSelectBtn'),
        value: getElement('accountCustomSelectValue'),
        options: getElement('accountCustomSelectOptions'),
      },
    },
  };

  /**
   * Main application entry point.
   */
  function initializeApp() {
    elements.themeToggle?.addEventListener('click', toggleTheme);
    elements.sidebar.burger?.addEventListener('click', () => toggleSidebar());
    elements.sidebar.overlay?.addEventListener('click', () => toggleSidebar(false));
    
    elements.sidebar.links.forEach(link => {
      link.addEventListener('click', e => {
        if (link.dataset.mode) {
          e.preventDefault();
          setMode(link.dataset.mode);
        }
      });
    });

    elements.home.customSelect.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCustomSelect(elements.home.customSelect.wrapper);
    });
    elements.preorder.customSelect.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCustomSelect(elements.preorder.customSelect.wrapper);
    });
    elements.preorder.customStatusSelect.btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCustomSelect(elements.preorder.customStatusSelect.wrapper);
    });
    elements.accounts.customSelect.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCustomSelect(elements.accounts.customSelect.wrapper);
    });
    
    let homeDebounce;
    elements.home.searchInput.addEventListener('input', e => {
      clearTimeout(homeDebounce);
      homeDebounce = setTimeout(() => { state.home.searchQuery = e.target.value.trim(); renderHomeList(); }, 200);
    });
    
    elements.paymentModal.closeBtn.addEventListener('click', closePaymentModal);
    elements.paymentModal.modal.addEventListener('click', e => { if (e.target === elements.paymentModal.modal) closePaymentModal(); });

    document.addEventListener('click', () => {
      toggleCustomSelect(elements.home.customSelect.wrapper, false);
      toggleCustomSelect(elements.preorder.customSelect.wrapper, false);
      if (elements.preorder.customStatusSelect.wrapper) {
        toggleCustomSelect(elements.preorder.customStatusSelect.wrapper, false);
      }
      toggleCustomSelect(elements.accounts.customSelect.wrapper, false);
    });

    setupKeyboardNavForSelect(elements.home.customSelect.wrapper);
    setupKeyboardNavForSelect(elements.preorder.customSelect.wrapper);
    setupKeyboardNavForSelect(elements.preorder.customStatusSelect.wrapper);
    setupKeyboardNavForSelect(elements.accounts.customSelect.wrapper);
    
    initTheme();
    loadCatalog();
  }
  
  function setupKeyboardNavForSelect(wrapper) {
    if (!wrapper) return;
    const btn = wrapper.querySelector('.custom-select-btn');
    const optionsEl = wrapper.querySelector('.custom-select-options');
    let focusIndex = -1;

    wrapper.addEventListener('keydown', e => {
        const options = Array.from(optionsEl.querySelectorAll('.custom-select-option'));
        if (options.length === 0) return;

        const isOpen = wrapper.classList.contains('open');
        
        if (e.key === 'Escape') {
            toggleCustomSelect(wrapper, false);
            btn.focus();
            return;
        }

        if (document.activeElement === btn && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleCustomSelect(wrapper, true);
            focusIndex = options.findIndex(opt => opt.classList.contains('selected'));
            if(focusIndex === -1) focusIndex = 0;
            options[focusIndex]?.focus();
        }
        
        if (isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            if (e.key === 'ArrowDown') {
                focusIndex = Math.min(focusIndex + 1, options.length - 1);
            } else { // ArrowUp
                focusIndex = Math.max(focusIndex - 1, 0);
            }
            options[focusIndex]?.focus();
        }

        if (isOpen && (e.key === 'Enter' || e.key === ' ') && document.activeElement.classList.contains('custom-select-option')) {
            e.preventDefault();
            document.activeElement.click();
            btn.focus();
        }
    });
  }

  function formatToIdr(value) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }
  function getSheetUrl(sheetName, format = 'json') { const baseUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`; const encodedSheetName = encodeURIComponent(sheetName); return format === 'csv' ? `${baseUrl}?tqx=out:csv&sheet=${encodedSheetName}` : `${baseUrl}?sheet=${encodedSheetName}&tqx=out:json`; }
  function showSkeleton(container, template, count = 6) { container.innerHTML = ''; const fragment = document.createDocumentFragment(); for (let i = 0; i < count; i++) { fragment.appendChild(template.content.cloneNode(true)); } container.appendChild(fragment); }
  function applyTheme(theme) { document.body.classList.toggle('dark-mode', theme === 'dark'); const btn = elements.themeToggle; if (btn) btn.setAttribute('aria-pressed', theme === 'dark'); document.documentElement.style.colorScheme = (theme === 'dark') ? 'dark' : 'light'; }
  function initTheme() { const savedTheme = localStorage.getItem('theme'); const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light'); applyTheme(currentTheme); }
  function toggleTheme() { const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); }
  function toggleSidebar(forceOpen) { const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !document.body.classList.contains('sidebar-open'); document.body.classList.toggle('sidebar-open', isOpen); elements.sidebar.burger.classList.toggle('active', isOpen); }
  
  let setMode = function(nextMode) {
    if (nextMode === 'donasi') {
      window.open('https://saweria.co/playpal', '_blank', 'noopener');
      return;
    }
    const viewMap = {
      home: elements.viewHome,
      preorder: elements.viewPreorder,
      accounts: elements.viewAccounts,
      perpustakaan: elements.viewPerpustakaan,
      film: elements.viewFilm,
    };
    const nextView = viewMap[nextMode];
    if (!nextView) return;
    document.querySelector('.view-section.active')?.classList.remove('active');
    nextView.classList.add('active');
    elements.sidebar.links.forEach(link => {
      link.classList.toggle('active', link.dataset.mode === nextMode);
    });
    if (window.innerWidth < 769) {
      toggleSidebar(false);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (nextMode === 'preorder' && !state.preorder.initialized) initializePreorder();
    if (nextMode === 'accounts' && !state.accounts.initialized) initializeAccounts();
  }

  function parseGvizPairs(jsonText) { const match = jsonText.match(/\{.*\}/s); if (!match) throw new Error('Invalid GViz response.'); const obj = JSON.parse(match[0]); const { rows = [], cols = [] } = obj.table || {}; const pairs = Array.from({ length: Math.floor(cols.length / 2) }, (_, i) => ({ iTitle: i * 2, iPrice: i * 2 + 1, label: cols[i * 2]?.label || '', })).filter(p => p.label && cols[p.iPrice]); const out = []; for (const r of rows) { const c = r.c || []; for (const p of pairs) { const title = String(c[p.iTitle]?.v || '').trim(); const priceRaw = c[p.iPrice]?.v; const price = priceRaw != null && priceRaw !== '' ? Number(priceRaw) : NaN; if (title && !isNaN(price)) { out.push({ catKey: p.label, catLabel: String(p.label || '').trim().replace(/\s+/g, ' '), title, price, }); } } } return out; }
  function toggleCustomSelect(wrapper, forceOpen) { const btn = wrapper.querySelector('.custom-select-btn'); const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !wrapper.classList.contains('open'); wrapper.classList.toggle('open', isOpen); btn.setAttribute('aria-expanded', isOpen); }
  function buildHomeCategorySelect(catalogData) { const { options, value } = elements.home.customSelect; const categoryMap = new Map(); catalogData.forEach(item => { if (!categoryMap.has(item.catKey)) { categoryMap.set(item.catKey, item.catLabel); } }); const categories = [...categoryMap].map(([key, label]) => ({ key, label })); options.innerHTML = ''; categories.forEach((cat, index) => { const el = document.createElement('div'); el.className = 'custom-select-option'; el.textContent = cat.label; el.dataset.value = cat.key; el.setAttribute('role', 'option'); el.setAttribute('tabindex', '-1'); if (index === 0) el.classList.add('selected'); el.addEventListener('click', () => { state.home.activeCategory = cat.key; value.textContent = cat.label; document.querySelector('#homeCustomSelectOptions .custom-select-option.selected')?.classList.remove('selected'); el.classList.add('selected'); toggleCustomSelect(elements.home.customSelect.wrapper, false); renderHomeList(); }); options.appendChild(el); }); if (categories.length > 0) { state.home.activeCategory = categories[0].key; value.textContent = categories[0].label; } else { value.textContent = 'Data tidak tersedia'; } }
  function renderList(container, countInfoEl, items, emptyText) { container.innerHTML = ''; if (items.length === 0) { container.innerHTML = `<div class="empty"><div class="empty-content"><svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg><p>${emptyText}</p></div></div>`; countInfoEl.textContent = ''; return; } const fragment = document.createDocumentFragment(); for (const item of items) { const clone = elements.itemTemplate.content.cloneNode(true); const buttonEl = clone.querySelector('.list-item'); buttonEl.querySelector('.title').textContent = item.title; buttonEl.querySelector('.price').textContent = formatToIdr(item.price); buttonEl.addEventListener('click', () => openPaymentModal(item)); fragment.appendChild(clone); } container.appendChild(fragment); countInfoEl.textContent = `${items.length} item ditemukan`; }
  function renderHomeList() { const { activeCategory, searchQuery } = state.home; const query = searchQuery.toLowerCase(); const items = allCatalogData.filter(x => x.catKey === activeCategory && (query === '' || x.title.toLowerCase().includes(query) || String(x.price).includes(query))); renderList(elements.home.listContainer, elements.home.countInfo, items, 'Tidak ada item ditemukan.'); }
  
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
      if (allCatalogData.length === 0) throw new Error('Data is empty or format is incorrect.'); 
      
      buildHomeCategorySelect(allCatalogData); 
      renderHomeList(); 
    } catch (err) { 
      if (err.name === 'AbortError') { return; }
      console.error('Failed to load catalog:', err); 
      const view = elements.home;
      view.listContainer.innerHTML = ''; 
      view.errorContainer.style.display = 'block'; 
      view.errorContainer.textContent = 'Oops, terjadi kesalahan. Silakan coba lagi nanti.';
    } 
  }

  function calculateFee(price, option) { if (option.feeType === 'fixed') return option.value; if (option.feeType === 'percentage') return Math.ceil(price * option.value); return 0; }
  function updatePriceDetails() { const selectedOptionId = document.querySelector('input[name="payment"]:checked')?.value; if (!selectedOptionId) return; const selectedOption = config.paymentOptions.find(opt => opt.id === selectedOptionId); if (!currentSelectedItem || !selectedOption) return; const price = currentSelectedItem.price; const fee = calculateFee(price, selectedOption); const total = price + fee; elements.paymentModal.fee.textContent = formatToIdr(fee); elements.paymentModal.total.textContent = formatToIdr(total); updateWaLink(selectedOption, fee, total); }
  function updateWaLink(option, fee, total) { const { catLabel = "Produk", title, price } = currentSelectedItem; const text = [ config.waGreeting, `› Tipe: ${catLabel}`, `› Item: ${title}`, `› Pembayaran: ${option.name}`, `› Harga: ${formatToIdr(price)}`, `› Fee: ${formatToIdr(fee)}`, `› Total: ${formatToIdr(total)}`, ].join('\n'); elements.paymentModal.waBtn.href = `https://wa.me/${config.waNumber}?text=${encodeURIComponent(text)}`; }
  
  function openPaymentModal(item) { document.documentElement.style.overflow = "hidden"; document.body.style.overflow = "hidden";
    elementToFocusOnModalClose = document.activeElement;
    currentSelectedItem = item;
    const { modal, itemName, itemPrice, optionsContainer } = elements.paymentModal;
    itemName.textContent = item.title;
    itemPrice.textContent = formatToIdr(item.price);
    optionsContainer.innerHTML = '';
    config.paymentOptions.forEach((option, index) => {
      const fee = calculateFee(item.price, option);
      optionsContainer.insertAdjacentHTML('beforeend', ` <div class="payment-option"> <input type="radio" id="${option.id}" name="payment" value="${option.id}" ${index === 0 ? 'checked' : ''}> <label for="${option.id}"> ${option.name} <span style="float: right;">+ ${formatToIdr(fee)}</span> </label> </div>`);
    });
    optionsContainer.querySelectorAll('input[name="payment"]').forEach(input => input.addEventListener('change', updatePriceDetails));
    updatePriceDetails();
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10);

    const focusableEls = modal.querySelectorAll('a[href]:not([disabled]), button:not([disabled]), input[type="radio"]:not([disabled])');
    modalFocusTrap.focusableEls = Array.from(focusableEls);
    modalFocusTrap.firstEl = modalFocusTrap.focusableEls[0];
    modalFocusTrap.lastEl = modalFocusTrap.focusableEls[modalFocusTrap.focusableEls.length - 1];
    
    modalFocusTrap.listener = function(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) { 
        if (document.activeElement === modalFocusTrap.firstEl) {
          modalFocusTrap.lastEl.focus();
          e.preventDefault();
        }
      } else { 
        if (document.activeElement === modalFocusTrap.lastEl) {
          modalFocusTrap.firstEl.focus();
          e.preventDefault();
        }
      }
    };
    modal.addEventListener('keydown', modalFocusTrap.listener);
    setTimeout(() => modalFocusTrap.firstEl.focus(), 100);
  }

  function closePaymentModal() { document.documentElement.style.overflow = ""; document.body.style.overflow = "";
    const { modal } = elements.paymentModal;
    modal.classList.remove('visible');
    
    if (modalFocusTrap.listener) {
      modal.removeEventListener('keydown', modalFocusTrap.listener);
    }

    setTimeout(() => {
      modal.style.display = 'none';
      currentSelectedItem = null;
      if (elementToFocusOnModalClose) {
        elementToFocusOnModalClose.focus();
      }
    }, 200);
  }

  function normalizeStatus(rawStatus) { const s = String(rawStatus || '').trim().toLowerCase(); if (['success', 'selesai', 'berhasil', 'done'].includes(s)) return 'success'; if (['progress', 'proses', 'diproses', 'processing'].includes(s)) return 'progress'; if (['failed', 'gagal', 'dibatalkan', 'cancel', 'error'].includes(s)) return 'failed'; return 'pending'; }
  function filterPreorderData() { const { searchInput, statusSelect } = elements.preorder; const query = searchInput.value.trim().toLowerCase(); const statusFilter = statusSelect.value; const currentMode = state.preorder.displayMode; return state.preorder.allData.filter(item => { const status = normalizeStatus(item[currentMode === 'detailed' ? 6 : 2]); if (statusFilter !== 'all' && status !== statusFilter) return false; if (currentMode === 'detailed') { const product = (item[3] || '').toLowerCase(); const nickname = (item[5] || '').toLowerCase(); const idGift = (item[7] || '').toLowerCase(); return product.includes(query) || nickname.includes(query) || idGift.includes(query); } else { const orderNum = (item[0] || '').toLowerCase(); const product = (item[1] || '').toLowerCase(); return orderNum.includes(query) || product.includes(query); } }); }
  function updatePreorderPagination(currentPage, totalPages) { elements.preorder.prevBtn.disabled = currentPage <= 1; elements.preorder.nextBtn.disabled = currentPage >= totalPages; elements.preorder.pageInfo.textContent = totalPages > 0 ? `Hal ${currentPage} dari ${totalPages}` : ''; }
  function renderPreorderCards() { const filtered = filterPreorderData(); const totalItems = state.preorder.allData.length; const { perPage } = state.preorder; const { listContainer, total } = elements.preorder; total.textContent = `${totalItems} total pesanan${filtered.length !== totalItems ? `, ${filtered.length} ditemukan` : ''}`; const totalPages = Math.max(1, Math.ceil(filtered.length / perPage)); state.preorder.currentPage = Math.min(Math.max(1, state.preorder.currentPage), totalPages); const start = (state.preorder.currentPage - 1) * perPage; const pageData = filtered.slice(start, start + perPage); listContainer.innerHTML = ''; if (pageData.length === 0) { listContainer.innerHTML = `<div class="empty"><div class="empty-content"><svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg><p>Tidak Ada Hasil Ditemukan</p></div></div>`; updatePreorderPagination(0, 0); return; } const fragment = document.createDocumentFragment(); pageData.forEach(item => { const card = document.createElement('article'); if (state.preorder.displayMode === 'detailed') { const [tglOrder, estPengiriman, , product, bulan, name, statusRaw] = item; const status = normalizeStatus(statusRaw); const estDeliveryText = estPengiriman ? `Estimasi Pengiriman: ${estPengiriman} 20:00 WIB` : ''; const details = [{ label: 'TGL ORDER', value: tglOrder }, { label: 'BULAN', value: bulan }]; const detailsHtml = details.filter(d => d.value && String(d.value).trim() !== '').map(d => `<div class="detail-item"><div class="detail-label">${d.label}</div><div class="detail-value">${d.value}</div></div>`).join(''); const expandIndicatorHtml = detailsHtml ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="expand-indicator"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>` : ''; card.className = `card ${detailsHtml ? 'clickable' : ''}`; card.innerHTML = `<div class="card-header"><div><div class="card-name">${name || 'Tanpa Nama'}</div><div class="card-product">${product || 'N/A'}</div></div><div class="status-badge-wrapper"><div class="status-badge ${status}">${(statusRaw || 'Pending').toUpperCase()}</div>${expandIndicatorHtml}</div></div>${estDeliveryText ? `<div class="card-date">${estDeliveryText}</div>` : ''}${detailsHtml ? `<div class="card-details"><div class="details-grid">${detailsHtml}</div></div>` : ''}`; if (detailsHtml) card.addEventListener('click', () => card.classList.toggle('expanded')); } else { const [orderNum, product, statusRaw] = item; const status = normalizeStatus(statusRaw); card.className = 'card'; card.innerHTML = `<div class="card-header"><div><div class="card-name">${orderNum || 'Tanpa Nomor'}</div><div class="card-product">${product || 'N/A'}</div></div><div class="status-badge ${status}">${(statusRaw || 'Pending').toUpperCase()}</div></div>`; } fragment.appendChild(card); }); listContainer.appendChild(fragment); updatePreorderPagination(state.preorder.currentPage, totalPages); }
  function sortPreorderData(data, mode) { const statusOrder = { progress: 1, pending: 2, success: 3, failed: 4 }; const statusIndex = mode === 'detailed' ? 6 : 2; return data.sort((a, b) => statusOrder[normalizeStatus(a[statusIndex])] - statusOrder[normalizeStatus(b[statusIndex])]); }
  
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
      let rows = text.trim().split('\n').map(r => r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim())); 
      if (rows.length < 2) { 
        state.preorder.allData = []; 
      } else { 
        rows.shift(); 
        const dataRows = rows.filter(row => row && (row[0] || '').trim() !== ''); 
        state.preorder.allData = sortPreorderData(dataRows, state.preorder.displayMode); 
      } 
    } catch (e) { 
      if (e.name === 'AbortError') { return; }
      state.preorder.allData = []; 
      total.textContent = 'Gagal memuat data.'; 
      console.error('Fetch Pre-Order failed:', e); 
    } finally { 
      state.preorder.currentPage = 1; 
      renderPreorderCards(); 
    } 
  }

  function initializePreorder() {
    if (state.preorder.initialized) return;
  
    const rebound = () => {
      state.preorder.currentPage = 1;
      renderPreorderCards();
    };
  
    const { searchInput, statusSelect, customSelect, prevBtn, nextBtn, customStatusSelect } = elements.preorder;
  
    searchInput.addEventListener('input', rebound);

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
      });
    });
  
    customStatusSelect.options.querySelectorAll('.custom-select-option').forEach(option => {
      option.addEventListener('click', e => {
        const selectedValue = e.target.dataset.value;
        const selectedText = e.target.textContent;
        customStatusSelect.value.textContent = selectedText;
        document.querySelector('#preorderStatusCustomSelectOptions .custom-select-option.selected')?.classList.remove('selected');
        e.target.classList.add('selected');
        statusSelect.value = selectedValue;
        toggleCustomSelect(customStatusSelect.wrapper, false);
        rebound();
      });
    });
  
    prevBtn.addEventListener('click', () => {
      if (state.preorder.currentPage > 1) {
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

  function robustCsvParser(text) { const normalizedText = text.trim().replace(/\r\n/g, '\n'); const rows = []; let currentRow = []; let currentField = ''; let inQuotedField = false; for (let i = 0; i < normalizedText.length; i++) { const char = normalizedText[i]; if (inQuotedField) { if (char === '"') { if (i + 1 < normalizedText.length && normalizedText[i + 1] === '"') { currentField += '"'; i++; } else { inQuotedField = false; } } else { currentField += char; } } else { if (char === '"') { inQuotedField = true; } else if (char === ',') { currentRow.push(currentField); currentField = ''; } else if (char === '\n') { currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = ''; } else { currentField += char; } } } currentRow.push(currentField); rows.push(currentRow); return rows; }
  async function parseAccountsSheet(text) { const rows = robustCsvParser(text); rows.shift(); return rows.filter(row => row && row.length >= 5 && row[0]).map(row => ({ title: row[0] || 'Tanpa Judul', price: Number(row[1]) || 0, status: row[2] || 'Tersedia', description: row[3] || 'Tidak ada deskripsi.', images: (row[4] || '').split(',').map(url => url.trim()).filter(Boolean), })); }
  function populateAccountSelect() { const { customSelect, empty } = elements.accounts; const { options, value } = customSelect; options.innerHTML = ''; if (state.accounts.data.length === 0) { value.textContent = 'Tidak ada akun'; empty.style.display = 'block'; return; } value.textContent = 'Pilih Akun'; state.accounts.data.forEach((acc, index) => { const el = document.createElement('div'); el.className = 'custom-select-option'; el.textContent = acc.title; el.dataset.value = index; el.setAttribute('role', 'option'); el.setAttribute('tabindex', '-1'); el.addEventListener('click', () => { value.textContent = acc.title; document.querySelector('#accountCustomSelectOptions .custom-select-option.selected')?.classList.remove('selected'); el.classList.add('selected'); toggleCustomSelect(customSelect.wrapper, false); renderAccount(index); }); options.appendChild(el); }); }
  function renderAccount(index) { const { display, empty, price, description, status: statusEl } = elements.accounts; const account = state.accounts.data[index]; state.accounts.currentAccount = account; if (!account) { display.style.display = 'none'; empty.style.display = 'block'; return; } display.classList.remove('expanded'); price.textContent = formatToIdr(account.price); description.textContent = account.description; statusEl.textContent = account.status; statusEl.className = 'account-status-badge'; statusEl.classList.add(account.status.toLowerCase() === 'tersedia' ? 'available' : 'sold'); const { track, indicators } = elements.accounts.carousel; track.innerHTML = ''; indicators.innerHTML = ''; if (account.images && account.images.length > 0) { account.images.forEach((src, i) => { track.insertAdjacentHTML('beforeend', `<div class="carousel-slide"><img src="${src}" alt="Gambar untuk ${account.title}" decoding="async" loading="lazy"></div>`); indicators.insertAdjacentHTML('beforeend', `<button class="indicator-dot" data-index="${i}"></button>`); }); } else { track.insertAdjacentHTML('beforeend', `<div class="carousel-slide"><div style="display:flex;align-items:center;justify-content:center;height:100%;aspect-ratio:16/9;background-color:var(--surface-secondary);color:var(--text-tertiary);">Gambar tidak tersedia</div></div>`); } indicators.querySelectorAll('.indicator-dot').forEach(dot => { dot.addEventListener('click', e => { e.stopPropagation(); state.accounts.currentIndex = parseInt(e.target.dataset.index); updateCarousel(); }); }); state.accounts.currentIndex = 0; updateCarousel(); empty.style.display = 'none'; display.style.display = 'block'; }
  function updateCarousel() { const account = state.accounts.currentAccount; if (!account) return; const { track, prevBtn, nextBtn, indicators } = elements.accounts.carousel; const totalSlides = account.images.length || 1; track.style.transform = `translateX(-${state.accounts.currentIndex * 100}%)`; prevBtn.disabled = totalSlides <= 1 || state.accounts.currentIndex === 0; nextBtn.disabled = totalSlides <= 1 || state.accounts.currentIndex >= totalSlides - 1; indicators.querySelectorAll('.indicator-dot').forEach((dot, i) => { dot.classList.toggle('active', i === state.accounts.currentIndex); }); }
  function initializeCarousel() { const { prevBtn, nextBtn, track } = elements.accounts.carousel; prevBtn.addEventListener('click', e => { e.stopPropagation(); if (state.accounts.currentIndex > 0) { state.accounts.currentIndex--; updateCarousel(); } }); nextBtn.addEventListener('click', e => { e.stopPropagation(); const account = state.accounts.currentAccount; if (!account) return; if (state.accounts.currentIndex < account.images.length - 1) { state.accounts.currentIndex++; updateCarousel(); } }); let touchStartX = 0; track.addEventListener('touchstart', e => { e.stopPropagation(); touchStartX = e.changedTouches[0].screenX; }, { passive: true }); track.addEventListener('touchend', e => { e.stopPropagation(); const touchEndX = e.changedTouches[0].screenX; if (touchEndX < touchStartX - 50) nextBtn.click(); if (touchEndX > touchStartX + 50) prevBtn.click(); }, { passive: true }); }
  
  async function initializeAccounts() { 
    if (state.accounts.initialized) return; 
    if (accountsFetchController) accountsFetchController.abort();
    accountsFetchController = new AbortController();

    const { customSelect, error, empty, display, buyBtn, offerBtn } = elements.accounts; 
    error.style.display = 'none'; 
    try { 
      const res = await fetch(getSheetUrl(config.sheets.accounts.name, 'csv'), { signal: accountsFetchController.signal }); 
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`); 
      
      const text = await res.text(); 
      state.accounts.data = await parseAccountsSheet(text); 
      populateAccountSelect(); 
    } catch (err) { 
      if (err.name === 'AbortError') { return; }
      console.error('Fetch Accounts failed:', err); 
      error.textContent = 'Gagal memuat data akun. Coba lagi nanti.'; 
      error.style.display = 'block'; 
      empty.style.display = 'none'; 
      customSelect.value.textContent = 'Gagal memuat'; 
    } 
    
    display.addEventListener('click', e => { if (!e.target.closest('.action-btn, .carousel-btn, .indicator-dot')) display.classList.toggle('expanded'); }); 
    buyBtn.addEventListener('click', e => { e.stopPropagation(); if (state.accounts.currentAccount) { openPaymentModal({ title: state.accounts.currentAccount.title, price: state.accounts.currentAccount.price, catLabel: 'Akun Game' }); } }); 
    offerBtn.addEventListener('click', e => { e.stopPropagation(); if (state.accounts.currentAccount) { const text = `Halo, saya tertarik untuk menawar Akun Game: ${state.accounts.currentAccount.title}`; window.open(`https://wa.me/${config.waNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); } }); 
    
    initializeCarousel(); 
    state.accounts.initialized = true; 
  }

  // --- START: Library Functions ---

  async function initializeLibrary() {
    const container = getElement('libraryGridContainer');
    const errorEl = getElement('libraryError');
    
    container.innerHTML = '<p>Memuat buku...</p>';
    errorEl.style.display = 'none';

    try {
      const sheetName = 'Sheet6'; 
      const res = await fetch(getSheetUrl(sheetName, 'csv'));
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
      
      const text = await res.text();
      const rows = robustCsvParser(text);
      rows.shift(); 
      
      const books = rows
        .filter(row => row && row[0]) 
        .map(row => ({
          title: row[0],
          coverUrl: row[1],
          bookUrl: row[2]
        }));
      
      renderLibraryGrid(books);

    } catch (err) {
      console.error('Failed to load library:', err);
      container.innerHTML = '';
      errorEl.textContent = 'Gagal memuat perpustakaan. Coba lagi nanti.';
      errorEl.style.display = 'block';
    }
  }

  function renderLibraryGrid(books) {
    const container = getElement('libraryGridContainer');
    if (!books || books.length === 0) {
      container.innerHTML = '<div class="empty">Belum ada buku yang ditambahkan.</div>';
      return;
    }

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    books.forEach(book => {
      const card = document.createElement('a');
      card.className = 'book-card';
      card.href = book.bookUrl;
      card.target = '_blank';
      card.rel = 'noopener';
      card.innerHTML = `
        <img src="${book.coverUrl}" alt="${book.title}" class="cover" decoding="async" loading="lazy">
        <div class="overlay"></div>
        <div class="title">${book.title}</div>
      `;
      fragment.appendChild(card);
    });
    container.appendChild(fragment);
  }
  
  // --- END: Library Functions ---

  // Panggil fungsi initializeLibrary saat menu perpustakaan diklik
  const originalSetMode = setMode;
  setMode = function(nextMode) {
    originalSetMode(nextMode); 
    if (nextMode === 'perpustakaan') {
      initializeLibrary();
    }
  };
  
  document.addEventListener('DOMContentLoaded', initializeApp);

  // ===== BEGIN: Testimonials (Sheet7: Nama | MediaURL) — v2 with manual drag + auto scroll =====
function pp_csvParse(text) {
  const rows = []; let row = []; let cur = ''; let inQuotes = false;
  for (let i=0; i<text.length; i++) {
    const ch = text[i], next = text[i+1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* ignore */ }
      else { cur += ch; }
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function pp_getCsvUrl(sheetName) {
  const sheetId = '1B0XPR4uSvRzy9LfzWDjNjwAyMZVtJs6_Kk_r2fh7dTw';
  return 'https://docs.google.com/spreadsheets/d/' + sheetId + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(sheetName);
}

function pp_makeNodes(list) {
  const frag = document.createDocumentFragment();
  list.forEach(({ name, url }) => {
    const li = document.createElement('li');
    li.className = 'testi-item';
    li.innerHTML = '<figure class="testi-fig">\
      <img src="' + url + '" alt="Testimoni ' + name.replace(/"/g,'&quot;') + '" decoding="async" loading="lazy" referrerpolicy="no-referrer">\
    </figure>\
    <figcaption class="testi-caption">— ' + name.replace(/</g,'&lt;') + '</figcaption>';
    frag.appendChild(li);
  });
  return frag;
}

async function loadTestimonials() {
  const track = document.getElementById('testiTrack');
  const section = document.getElementById('testimonialSection');
  if (!track || !section) return;

  try {
    const res = await fetch(pp_getCsvUrl('Sheet7'));
    if (!res.ok) throw new Error('Network: ' + res.status);
    const csv = await res.text();
    const rows = pp_csvParse(csv);
    if (!rows.length) { section.style.display = 'none'; return; }

    const header = rows[0].map(x => (x||'').toLowerCase().trim());
    let data = rows;
    if (header[0].includes('nama') || header[1].includes('media')) data = rows.slice(1);

    const items = data.filter(r => r && r[0] && r[1])
                      .map(r => ({ name: String(r[0]).trim(), url: String(r[1]).trim() }));

    if (!items.length) { section.style.display = 'none'; return; }

    track.innerHTML = '';
    track.appendChild(pp_makeNodes(items));
    track.appendChild(pp_makeNodes(items)); // duplicate for seamless loop

    // ----- Motion engine (manual drag + auto) -----
    let pos = 0;                         // current translateX
    let speed = 85;                      // px/s (faster than before)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const marquee = section.querySelector('.testi-marquee');
    let halfWidth = 0;
    let dragging = false;
    let startX = 0, startPos = 0;
    let pausedByHover = false;
    let rafId = null, lastTs = 0;

    function measure() {
      // track.scrollWidth is total length; duplicated list => half of it
      halfWidth = Math.max(1, Math.round(track.scrollWidth / 2));
    }
    measure();
    // recalc after images load
    Array.from(track.querySelectorAll('img')).forEach(img => {
      img.addEventListener('load', measure, { once: true });
      img.addEventListener('error', measure, { once: true });
    });

    function applyTransform() {
      // keep pos within [-halfWidth, 0]
      while (pos <= -halfWidth) pos += halfWidth;
      while (pos > 0) pos -= halfWidth;
      track.style.transform = 'translateX(' + pos + 'px)';
    }

    function step(ts) {
      if (!lastTs) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      if (!dragging && !pausedByHover && !reduceMotion) {
        pos -= speed * dt;
        applyTransform();
      }
      rafId = requestAnimationFrame(step);
    }
    cancelAnimationFrame(rafId); rafId = requestAnimationFrame(step);

    // Hover pause (desktop)
    marquee.addEventListener('mouseenter', () => { pausedByHover = true; });
    marquee.addEventListener('mouseleave', () => { pausedByHover = false; });

    // Pointer-based dragging (works for mouse & touch in modern browsers)
    function onPointerDown(e) {
      dragging = true;
      track.classList.add('dragging');
      startX = (e.touches ? e.touches[0].clientX : e.clientX);
      startPos = pos;
      marquee.setPointerCapture && marquee.setPointerCapture(e.pointerId || 1);
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
      pos = startPos + (x - startX);
      applyTransform();
    }
    function onPointerUp(e) {
      dragging = false;
      track.classList.remove('dragging');
      marquee.releasePointerCapture && marquee.releasePointerCapture(e.pointerId || 1);
    }

    // Register events (Pointer + Touch fallback)
    marquee.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    // iOS 12 fallback: touch events
    marquee.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp, { passive: true });

  } catch (err) {
    console.error('Testimonials error:', err);
    if (section) section.style.display = 'none';
  }
}

  const originalSetMode2 = setMode;
  setMode = function(nextMode) {
    originalSetMode2(nextMode);
    elements.sidebar.links.forEach(link => {
      const active = link.dataset.mode === nextMode;
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
  };

  function __ppEscHandler(e) {
    if (e.key === 'Escape') {
      if (elements.paymentModal.modal && elements.paymentModal.modal.classList.contains('visible')) {
        closePaymentModal();
        elements.paymentModal.closeBtn && elements.paymentModal.closeBtn.focus();
      } else if (document.body.classList.contains('sidebar-open')) {
        toggleSidebar(false);
        elements.sidebar.burger && elements.sidebar.burger.focus();
      }
    }
  }
  document.addEventListener('keydown', __ppEscHandler);
document.addEventListener('DOMContentLoaded', loadTestimonials);
// ===== END: Testimonials =====

})();
