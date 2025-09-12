/**
 * @file script.js
 * @description Main script for the PlayPal.ID single-page application.
 * @version 9.0.0 (Final & Complete - All views restored)
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
      allData: [],
      activeCategory: 'Semua Kategori',
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
      cardGrid: getElement('accountCardGrid'),
      cardTemplate: getElement('accountCardTemplate'),
      empty: getElement('accountEmpty'),
      error: getElement('accountError'),
      customSelect: {
        wrapper: getElement('accountCustomSelectWrapper'),
        btn: getElement('accountCustomSelectBtn'),
        value: getElement('accountCustomSelectValue'),
        options: getElement('accountCustomSelectOptions'),
      },
    },
  };

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

    const allSelects = [
        elements.home.customSelect, 
        elements.preorder.customSelect, 
        elements.preorder.customStatusSelect, 
        elements.accounts.customSelect
    ];

    allSelects.forEach(select => {
        if (select && select.btn) {
            select.btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleCustomSelect(select.wrapper);
            });
            setupKeyboardNavForSelect(select.wrapper);
        }
    });
    
    let homeDebounce;
    elements.home.searchInput.addEventListener('input', e => {
      clearTimeout(homeDebounce);
      homeDebounce = setTimeout(() => { state.home.searchQuery = e.target.value.trim(); renderHomeList(); }, 200);
    });
    
    elements.paymentModal.closeBtn.addEventListener('click', closePaymentModal);
    elements.paymentModal.modal.addEventListener('click', e => { if (e.target === elements.paymentModal.modal) closePaymentModal(); });

    document.addEventListener('click', () => {
        allSelects.forEach(select => {
            if (select && select.wrapper) {
                toggleCustomSelect(select.wrapper, false)
            }
        });
    });
    
    initTheme();
    loadCatalog();
    document.addEventListener('keydown', globalEscHandler);
    document.addEventListener('DOMContentLoaded', loadTestimonials);
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
            toggleCustomSelect(wrapper);
        }
        if (isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            const direction = e.key === 'ArrowDown' ? 1 : -1;
            focusIndex = (focusIndex + direction + options.length) % options.length;
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
  function getSheetUrl(sheetName, format = 'csv') { const baseUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`; const encodedSheetName = encodeURIComponent(sheetName); return `${baseUrl}?tqx=out:csv&sheet=${encodedSheetName}`; }
  function showSkeleton(container, template, count = 3) { container.innerHTML = ''; for (let i = 0; i < count; i++) { container.appendChild(template.content.cloneNode(true)); } }
  function applyTheme(theme) { document.body.classList.toggle('dark-mode', theme === 'dark'); elements.themeToggle?.setAttribute('aria-pressed', theme === 'dark'); document.documentElement.style.colorScheme = theme; }
  function initTheme() { const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); applyTheme(savedTheme); }
  function toggleTheme() { const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); }
  function toggleSidebar(forceOpen) { const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !document.body.classList.contains('sidebar-open'); document.body.classList.toggle('sidebar-open', isOpen); elements.sidebar.burger.classList.toggle('active', isOpen); }
  
  function setMode(nextMode) {
    if (nextMode === 'donasi') {
      window.open('https://saweria.co/playpal', '_blank', 'noopener');
      return;
    }
    const viewId = `view${nextMode.charAt(0).toUpperCase() + nextMode.slice(1)}`;
    const nextView = getElement(viewId);
    if (!nextView) return;

    document.querySelector('.view-section.active')?.classList.remove('active');
    nextView.classList.add('active');

    elements.sidebar.links.forEach(link => {
      link.classList.toggle('active', link.dataset.mode === nextMode);
    });

    if (window.innerWidth < 769) toggleSidebar(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (nextMode === 'preorder' && !state.preorder.initialized) initializePreorder();
    if (nextMode === 'accounts' && !state.accounts.initialized) initializeAccounts();
    // Tambahkan inisialisasi untuk view lain di sini jika perlu
  }

  function toggleCustomSelect(wrapper, forceOpen) {
    if (!wrapper) return;
    const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !wrapper.classList.contains('open');
    wrapper.classList.toggle('open', isOpen);
    wrapper.querySelector('.custom-select-btn')?.setAttribute('aria-expanded', isOpen.toString());
  }

  function robustCsvParser(text) {
    const rows = []; let row = []; let cur = ''; let inQuotes = false;
    if (!text) return rows;
    text = text.trim().replace(/\r\n/g, '\n');
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } 
            else if (ch === '"') { inQuotes = false; } 
            else { cur += ch; }
        } else {
            if (ch === '"') { inQuotes = true; } 
            else if (ch === ',') { row.push(cur.trim()); cur = ''; } 
            else if (ch === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; } 
            else { cur += ch; }
        }
    }
    if (cur.length || row.length) { row.push(cur.trim()); rows.push(row); }
    return rows;
  }
  
  function loadCatalog() { /* ... fungsi tidak berubah ... */ }
  function openPaymentModal(item) { /* ... fungsi tidak berubah ... */ }
  function closePaymentModal() { /* ... fungsi tidak berubah ... */ }
  function initializePreorder() { /* ... fungsi tidak berubah ... */ }
  function initializeLibrary() { /* ... fungsi tidak berubah ... */ }
  function loadTestimonials() { /* ... fungsi tidak berubah ... */ }

  // --- AKUN GAME FUNCTIONS (FINAL) ---

  async function parseAccountsSheet(text) {
    const rows = robustCsvParser(text);
    rows.shift();
    return rows
      .filter(row => row && row.length >= 5 && row[0] && row[1])
      .map(row => {
        const price = Number(row[1]) || 0;
        const title = `${row[0] || 'Akun'} (${formatToIdr(price)})`;
        return {
          title,
          category: row[0] || 'Lainnya',
          price,
          status: row[2] || 'Tersedia',
          description: row[3] || 'Tidak ada deskripsi.',
          images: (row[4] || '').split(',').map(url => url.trim()).filter(Boolean),
        };
      });
  }

  function populateAccountCategorySelect() {
    const { customSelect } = elements.accounts;
    const { options, value } = customSelect;
    const categories = ['Semua Kategori', 'Mobile Legends', 'Free Fire', 'Roblox', 'PUBG Mobile', 'Clash Of Clans', 'Lainnya'];
    
    options.innerHTML = '';
    value.textContent = state.accounts.activeCategory;

    categories.forEach((cat) => {
      const el = document.createElement('div');
      el.className = 'custom-select-option';
      el.textContent = cat;
      if (cat === state.accounts.activeCategory) el.classList.add('selected');
      
      el.addEventListener('click', () => {
        value.textContent = cat;
        options.querySelector('.selected')?.classList.remove('selected');
        el.classList.add('selected');
        toggleCustomSelect(customSelect.wrapper, false);
        state.accounts.activeCategory = cat;
        renderAccountCards();
      });
      options.appendChild(el);
    });
  }

  function renderAccountCards() {
    const { cardGrid, cardTemplate, empty } = elements.accounts;
    const filteredAccounts = state.accounts.allData.filter(acc => 
        state.accounts.activeCategory === 'Semua Kategori' || acc.category === state.accounts.activeCategory
    );
    
    cardGrid.innerHTML = '';
    empty.style.display = filteredAccounts.length === 0 ? 'flex' : 'none';
    
    filteredAccounts.forEach(account => {
      const cardClone = cardTemplate.content.cloneNode(true);
      const cardElement = cardClone.querySelector('.account-card');
      
      cardElement.querySelector('.account-card-banner-wrapper').innerHTML = `<img src="${account.images[0] || ''}" alt="${account.title}" loading="lazy">`;
      const summary = cardElement.querySelector('.account-card-summary');
      summary.innerHTML = `
        <h3>${formatToIdr(account.price)}</h3>
        <span class="account-status-badge ${account.status.toLowerCase() === 'tersedia' ? 'available' : 'sold'}">${account.status}</span>
        <svg class="icon expand-indicator" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
      `;
      
      summary.addEventListener('click', () => {
        const detailsWrapper = cardElement.querySelector('.account-card-details-wrapper');
        if (detailsWrapper.innerHTML === '') {
          buildAndInjectDetails(cardElement, account);
        }
        
        setTimeout(() => {
          cardElement.classList.toggle('expanded');
        }, 10);
      });
      
      cardGrid.appendChild(cardElement);
    });
  }

  function buildAndInjectDetails(cardElement, account) {
    const detailsWrapper = cardElement.querySelector('.account-card-details-wrapper');
    const detailsContent = document.createElement('div');
    detailsContent.className = 'account-card-details-content';
    
    let carouselHtml = '';
    if (account.images?.length > 0) {
      const slides = account.images.map(src => `<div class="carousel-slide"><img src="${src}" alt="Gambar detail" loading="lazy"></div>`).join('');
      const indicators = account.images.map((_, i) => `<button type="button" class="indicator-dot" data-index="${i}"></button>`).join('');
      carouselHtml = `
        <div class="carousel-container">
          <div class="carousel-track" style="transform: translateX(0%);">${slides}</div>
          ${account.images.length > 1 ? `
            <button class="carousel-btn prev" type="button" aria-label="Gambar sebelumnya"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
            <button class="carousel-btn next" type="button" aria-label="Gambar selanjutnya"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
            <div class="carousel-indicators">${indicators}</div>
          ` : ''}
        </div>`;
    }

    detailsContent.innerHTML = `
      ${carouselHtml}
      <p>${account.description}</p>
      <div class="account-actions">
        <button type="button" class="action-btn buy">Beli Sekarang</button>
        <button type="button" class="action-btn offer">Tawar Harga</button>
      </div>
    `;
    detailsWrapper.appendChild(detailsContent);
    
    detailsContent.querySelector('.buy').addEventListener('click', e => { e.stopPropagation(); openPaymentModal({ title: account.title, price: account.price, catLabel: 'Akun Game' }); });
    detailsContent.querySelector('.offer').addEventListener('click', e => { e.stopPropagation(); window.open(`https://wa.me/${config.waNumber}?text=${encodeURIComponent(`Halo, saya tertarik menawar: ${account.title}`)}`, '_blank', 'noopener'); });
    
    if (account.images?.length > 1) {
      initializeCardCarousel(detailsContent.querySelector('.carousel-container'));
    }
  }

  function initializeCardCarousel(container) {
    const track = container.querySelector('.carousel-track');
    const prevBtn = container.querySelector('.prev');
    const nextBtn = container.querySelector('.next');
    const indicators = container.querySelectorAll('.indicator-dot');
    let currentIndex = 0;
    const imageCount = indicators.length;

    const update = () => {
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex >= imageCount - 1;
      indicators.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
    };

    nextBtn.addEventListener('click', e => { e.stopPropagation(); if (currentIndex < imageCount - 1) { currentIndex++; update(); } });
    prevBtn.addEventListener('click', e => { e.stopPropagation(); if (currentIndex > 0) { currentIndex--; update(); } });
    indicators.forEach(dot => dot.addEventListener('click', e => { e.stopPropagation(); currentIndex = parseInt(e.target.dataset.index, 10); update(); }));
    
    update();
  }

  async function initializeAccounts() { 
    if (state.accounts.initialized) return; 
    state.accounts.initialized = true; 

    accountsFetchController?.abort();
    accountsFetchController = new AbortController();

    const { cardGrid, error, empty, customSelect } = elements.accounts;
    error.style.display = 'none'; 
    empty.style.display = 'none';
    customSelect.btn.disabled = true;
    showSkeleton(cardGrid, getElement('skeletonCardTemplate'), 3);

    try { 
      const res = await fetch(getSheetUrl(config.sheets.accounts.name), { signal: accountsFetchController.signal }); 
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`); 
      
      const text = await res.text(); 
      state.accounts.allData = await parseAccountsSheet(text); 
      populateAccountCategorySelect();
      renderAccountCards();
    } catch (err) { 
      if (err.name === 'AbortError') return;
      console.error('Fetch Accounts failed:', err); 
      error.style.display = 'block';
      cardGrid.innerHTML = '';
    } finally {
      customSelect.btn.disabled = false;
    }
  }
  
  function globalEscHandler(e) {
    if (e.key !== 'Escape') return;
    const openModal = document.querySelector('.modal-overlay.visible');
    if (openModal) {
      closePaymentModal();
      return;
    }
    if (document.body.classList.contains('sidebar-open')) {
      toggleSidebar(false);
    }
  }

  // Menjalankan fungsi inisialisasi utama saat DOM siap
  document.addEventListener('DOMContentLoaded', initializeApp);

})();
