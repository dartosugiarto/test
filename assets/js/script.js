(function () {
  'use strict';

  // --- LOGIKA DARK MODE ---
  const THEME_KEY = 'pp_theme';
  const docHtml = document.documentElement;
  
  function getPreferredTheme() {
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  function setTheme(theme) {
    if (theme === 'dark') {
      docHtml.setAttribute('data-theme', 'dark');
    } else {
      docHtml.setAttribute('data-theme', 'light');
    }
    localStorage.setItem(THEME_KEY, theme);
  }
  
  function toggleTheme() {
    const currentTheme = docHtml.getAttribute('data-theme') || getPreferredTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }
  
  setTheme(getPreferredTheme());
  // --- AKHIR LOGIKA DARK MODE ---

  // --- KONFIGURASI AKHIR (SESUAI KONFIRMASI) ---
  const config = {
    sheetId: '11hRQ9fw5RwfoWUbyMgQ3k2QPEZAAR2EJ4FsyX8oS3zU',
    sheets: {
      // --- Home Page (BARU) ---
      kategori: 'Sheet1',
      produk: 'Sheet2',
      flashSale: 'Sheet3',
      
      // --- Halaman Lain (SESUAI KONFIRMASI) ---
      preorder: { name1: 'Sheet4', name2: 'Sheet5' }, 
      library: 'Sheet6',
      testimonial: 'Sheet7',
      affiliate: 'Sheet8',
      accounts: 'Sheet9' // Akun Game di Sheet9
    },
    // Path config dihapus, kita pakai link langsung
    waNumber: '6285877001999',
    waGreeting: '*Detail pesanan:*',
    paymentOptions: [
      { id: 'seabank', name: 'Seabank', feeType: 'fixed', value: 0 },
      { id: 'shopeepay', name: 'ShopeePay', feeType: 'fixed', value: 0 },
      { id: 'gopay', name: 'Gopay', feeType: 'fixed', value: 0 },
      { id: 'dana', name: 'Dana', feeType: 'fixed', value: 125 },
      { id: 'bank_to_dana', name: 'Bank ke Dana', feeType: 'fixed', value: 500 },
      { id: 'qris', name: 'Qris', feeType: 'percentage', value: 0.01 },
    ],
  };

  // --- STATE APLIKASI ---
  const state = {
    home: { activeFilter: 'Semua Kategori' },
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
    carousell: {
      initialized: false,
      allData: [],
      searchQuery: '',
    }
  };

  // --- Variabel Global ---
  let allKategori = [];
  let allProduk = [];
  let allFlashSale = [];
  let currentSelectedItem = null;
  let preorderFetchController;
  let accountsFetchController;
  let modalFocusTrap = { listener: null, focusableEls: [], firstEl: null, lastEl: null };
  let productModalFocusTrap = { listener: null, focusableEls: [], firstEl: null, lastEl: null };
  let elementToFocusOnModalClose = null;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- PEREBUTAN ELEMEN (DOM) ---
  function getElement(id) {
    return document.getElementById(id);
  }
  const elements = {
    // Navigasi & Header
    sidebar: {
      nav: getElement('sidebarNav'),
      overlay: getElement('sidebarOverlay'),
      burger: getElement('burgerBtn'),
    },
    themeToggle: getElement('themeToggleBtn'),
    navLinks: document.querySelectorAll('[data-mode]'),
    headerStatusIndicator: getElement('headerStatusIndicator'),
    
    // Halaman Home (BARU)
    viewHome: getElement('viewHome'),
    flashSaleSection: getElement('flashSaleSection'),
    flashSaleContainer: getElement('flashSaleContainer'),
    flashSaleCardTemplate: getElement('flashSaleCardTemplate'),
    categoryFilter: {
      wrapper: getElement('categoryFilterWrapper'),
      btn: getElement('categoryFilterBtn'),
      value: getElement('categoryFilterValue'),
      options: getElement('categoryFilterOptions'),
    },
    categoryGridContainer: getElement('categoryGridContainer'),
    categoryCardTemplate: getElement('categoryCardTemplate'),
    categoryEmpty: getElement('categoryEmpty'),

    // Halaman Lain (LAMA)
    viewPreorder: getElement('viewPreorder'),
    viewAccounts: getElement('viewAccounts'),
    viewPerpustakaan: getElement('viewPerpustakaan'),
    viewCarousell: getElement('viewCarousell'),
    
    // Modal Produk (BARU)
    productModal: {
      modal: getElement('productModal'),
      closeBtn: getElement('productModalCloseBtn'),
      title: getElement('productModalTitle'),
      listContainer: getElement('productModalListContainer'),
    },

    // Modal Pembayaran (LAMA, TAPI DIPAKAI)
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

    // Template Lama (untuk halaman lain)
    itemTemplate: getElement('itemTemplate'),
    skeletonItemTemplate: getElement('skeletonItemTemplate'),
    skeletonCardTemplate: getElement('skeletonCardTemplate'),
    accountCardTemplate: getElement('accountCardTemplate'),
    
    // Elemen Halaman Preorder (LAMA)
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
    
    // Elemen Halaman Akun (LAMA)
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

    // Elemen Halaman Carousell (LAMA)
    carousell: {
      gridContainer: getElement('carousellGridContainer'),
      error: getElement('carousellError'),
      searchInput: getElement('carousellSearchInput'), 
      total: getElement('carousellTotal'),
    }
  };
  
  // --- FUNGSI HELPER (Utilitas) ---
  function formatToIdr(value) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }

  function getSheetUrl(sheetName, format = 'json') {
    const baseUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`;
    const encodedSheetName = encodeURIComponent(sheetName);
    return format === 'csv'
      ? `${baseUrl}?tqx=out:csv&sheet=${encodedSheetName}`
      : `${baseUrl}?sheet=${encodedSheetName}&tqx=out:json`;
  }

  // Helper Fetching CSV (DIPAKAI SEMUA)
  async function fetchSheetCached(sheetName, format = 'csv') {
    const url = getSheetUrl(sheetName, format);
    const key = `pp_cache_${sheetName}_${format}`;
    const cached = sessionStorage.getItem(key);
    if (cached) {
      try { fetch(url).then(r => r.text()).then(t => sessionStorage.setItem(key, t)); } catch(e) {}
      return cached;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
    const text = await res.text();
    sessionStorage.setItem(key, text);
    return text;
  }
  
  // Helper Parser 1: CSV (LAMA, TAPI DIPAKAI)
  function robustCsvParser(text) { const normalizedText = text.trim().replace(/\r\n/g, '\n'); const rows = []; let currentRow = []; let currentField = ''; let inQuotedField = false; for (let i = 0; i < normalizedText.length; i++) { const char = normalizedText[i]; if (inQuotedField) { if (char === '"') { if (i + 1 < normalizedText.length && normalizedText[i + 1] === '"') { currentField += '"'; i++; } else { inQuotedField = false; } } else { currentField += char; } } else { if (char === '"') { inQuotedField = true; } else if (char === ',') { currentRow.push(currentField); currentField = ''; } else if (char === '\n') { currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = ''; } else { currentField += char; } } } currentRow.push(currentField); rows.push(currentRow); return rows; }

  // Helper Parser 2: CSV ke JSON (BARU, UNTUK HOME)
  function parseCsvToJson(rows) {
    if (rows.length < 1) return [];
    const header = rows.shift(); // Ambil header
    
    return rows.map(row => {
      const item = {};
      header.forEach((colName, i) => {
        const val = row[i] || null;
        // Cek jika kolom ini harusnya angka
        if (['Harga', 'HargaAsli', 'HargaDiskon'].includes(colName) && val !== null) {
          item[colName] = Number(String(val).replace(/[^0-9]/g, '')) || 0; // Bersihkan & jadikan angka
        } else {
          item[colName] = val;
        }
      });
      return item;
    }).filter(item => {
      // Pastikan baris tidak kosong, cek berdasarkan kolom pertama (header[0])
      return item[header[0]] && item[header[0]].trim() !== '';
    });
  }

  // Helper Lain-lain
  function toggleSidebar(forceOpen) {
    const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open', isOpen);
    elements.sidebar.burger.classList.toggle('active', isOpen);
    const body = document.body;
    if (isOpen) {
      const y = window.scrollY || window.pageYOffset || 0;
      body.dataset.ppLockY = String(y);
      body.style.position = 'fixed';
      body.style.top = `-${y}px`;
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    } else {
      const y = parseInt(body.dataset.ppLockY || '0', 10);
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      body.style.overflow = '';
      window.scrollTo(0, y);
    }
  }

  function updateHeaderStatus() {
    const now = new Date();
    const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false };
    const hour = parseInt(new Intl.DateTimeFormat('en-US', options).format(now), 10);
    const indicator = elements.headerStatusIndicator;
    if (indicator) {
      if (hour >= 8) {
        indicator.textContent = 'BUKA';
        indicator.className = 'status-badge success';
      } else {
        indicator.textContent = 'TUTUP';
        indicator.className = 'status-badge closed';
      }
      indicator.style.display = 'inline-flex';
    }
  }
  
  function showSkeleton(container, template, count = 6) {
    if (!container || !template) return;
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      fragment.appendChild(template.content.cloneNode(true));
    }
    container.appendChild(fragment);
  }

  function toggleCustomSelect(wrapper, forceOpen) {
    if (!wrapper) return;
    const btn = wrapper.querySelector('.custom-select-btn');
    const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !wrapper.classList.contains('open');
    wrapper.classList.toggle('open', isOpen);
    if (btn) btn.setAttribute('aria-expanded', isOpen);
  }

  // --- LOGIKA MODAL (BARU & LAMA) ---

  // Modal 1: Product List (BARU)
  function openProductModal(kategoriID) {
    const kategori = allKategori.find(k => k.KategoriID === kategoriID);
    if (!kategori) return;

    const produkTerkait = allProduk.filter(p => p.KategoriID === kategoriID);
    
    elements.productModal.title.textContent = kategori.Nama || "Pilih Produk";
    const container = elements.productModal.listContainer;
    container.innerHTML = ''; // Kosongkan list

    if (produkTerkait.length === 0) {
      container.innerHTML = `<div class="product-list-item"><span class="title">Produk segera hadir</span></div>`;
    } else {
      const fragment = document.createDocumentFragment();
      produkTerkait.forEach(produk => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'product-list-item';
        item.innerHTML = `
          <div>
            <div class="title">${produk.NamaProduk}</div>
            ${produk.Deskripsi ? `<div class="description">${produk.Deskripsi}</div>` : ''}
          </div>
          <span class="price">${formatToIdr(produk.Harga)}</span>
        `;
        item.addEventListener('click', () => {
          closeProductModal();
          openPaymentModal({
            title: produk.NamaProduk,
            price: produk.Harga,
            catLabel: kategori.Nama 
          });
        });
        fragment.appendChild(item);
      });
      container.appendChild(fragment);
    }
    showModal(elements.productModal.modal, productModalFocusTrap);
  }

  function closeProductModal() {
    hideModal(elements.productModal.modal, productModalFocusTrap);
  }

  // Modal 2: Payment (LAMA)
  function openPaymentModal(item) {
    currentSelectedItem = item;
    const { modal, itemName, itemPrice, optionsContainer } = elements.paymentModal;
    itemName.textContent = item.title;
    itemPrice.textContent = formatToIdr(item.price);
    optionsContainer.innerHTML = '';

    config.paymentOptions.forEach((option, index) => {
      const fee = calculateFee(item.price, option);
      optionsContainer.insertAdjacentHTML(
        'beforeend',
        `<div class="payment-option">
          <input type="radio" id="${option.id}" name="payment" value="${option.id}" ${index === 0 ? 'checked' : ''}>
          <label for="${option.id}" tabindex="0">
            ${option.name}
            <span style="float: right;">+ ${formatToIdr(fee)}</span>
          </label>
        </div>`
      );
    });

    optionsContainer.querySelectorAll('input[name="payment"]').forEach(input => input.addEventListener('change', updatePriceDetails));
    updatePriceDetails();
    showModal(elements.paymentModal.modal, modalFocusTrap);
  }

  function closePaymentModal() {
    hideModal(elements.paymentModal.modal, modalFocusTrap);
    currentSelectedItem = null;
  }
  
  // Helper Modal Generik
  function showModal(modalEl, trap) {
    if (!modalEl) return;
    const pageContainer = getElement('pageContainer');
    if (pageContainer) pageContainer.setAttribute('inert', '');
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    elementToFocusOnModalClose = document.activeElement;

    modalEl.style.display = 'flex';
    setTimeout(() => modalEl.classList.add('visible'), 10);

    const focusableEls = modalEl.querySelectorAll('a[href]:not([disabled]), button:not([disabled]), input[type="radio"]:not([disabled]), .product-list-item');
    trap.focusableEls = Array.from(focusableEls);
    trap.firstEl = trap.focusableEls[0];
    trap.lastEl = trap.focusableEls[trap.focusableEls.length - 1];
    trap.listener = function(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === trap.firstEl) {
          trap.lastEl?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === trap.lastEl) {
          trap.firstEl?.focus();
          e.preventDefault();
        }
      }
    };
    modalEl.addEventListener('keydown', trap.listener);
    setTimeout(() => trap.firstEl?.focus(), 100);
  }

  function hideModal(modalEl, trap) {
    if (!modalEl) return;
    const pageContainer = getElement('pageContainer');
    if (pageContainer) pageContainer.removeAttribute('inert');
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    
    modalEl.classList.remove('visible');
    if (trap.listener) modalEl.removeEventListener('keydown', trap.listener);
    
    setTimeout(() => {
      modalEl.style.display = 'none';
      elementToFocusOnModalClose?.focus();
    }, 200);
  }

  function calculateFee(price, option) {
    if (option.feeType === 'fixed') return option.value;
    if (option.feeType === 'percentage') return Math.ceil(price * option.value);
    return 0;
  }

  function updatePriceDetails() {
    const selectedOptionId = elements.paymentModal.optionsContainer.querySelector('input[name="payment"]:checked')?.value;
    if (!selectedOptionId) return;
    const selectedOption = config.paymentOptions.find(opt => opt.id === selectedOptionId);
    if (!currentSelectedItem || !selectedOption) return;

    const price = currentSelectedItem.price;
    const fee = calculateFee(price, selectedOption);
    const total = price + fee;
    elements.paymentModal.fee.textContent = formatToIdr(fee);
    elements.paymentModal.total.textContent = formatToIdr(total);
    updateWaLink(selectedOption, fee, total);
  }

  function updateWaLink(option, fee, total) {
    const { catLabel = "Produk", title, price } = currentSelectedItem;
    const text = [
      config.waGreeting,
      `\u203A Tipe: ${catLabel}`,
      `\u203A Item: ${title}`,
      `\u203A Pembayaran: ${option.name}`,
      `\u203A Harga: ${formatToIdr(price)}`,
      `\u203A Fee: ${formatToIdr(fee)}`,
      `\u203A Total: ${formatToIdr(total)}`,
    ].join('\n');
    elements.paymentModal.waBtn.href = `https://wa.me/${config.waNumber}?text=${encodeURIComponent(text)}`;
  }
  
  // --- LOGIKA RENDER HALAMAN HOME (PERBAIKAN CSV) ---
  
  async function loadHomePageData() {
    try {
      renderFlashSale([]);
      renderCategoryGrid([]);

      const [textKategori, textProduk, textFlashSale] = await Promise.all([
        fetchSheetCached(config.sheets.kategori, 'csv'),
        fetchSheetCached(config.sheets.produk, 'csv'),
        fetchSheetCached(config.sheets.flashSale, 'csv')
      ]);

      allKategori = parseCsvToJson(robustCsvParser(textKategori));
      allProduk = parseCsvToJson(robustCsvParser(textProduk));
      allFlashSale = parseCsvToJson(robustCsvParser(textFlashSale));

      renderFlashSale(allFlashSale);
      renderCategoryFilter(allKategori);
      renderCategoryGrid(allKategori);

    } catch (err) {
      console.error("Gagal memuat data halaman utama:", err);
      if (elements.categoryGridContainer) {
          elements.categoryGridContainer.innerHTML = `<div class="err" style="grid-column: 1 / -1;">Gagal memuat data. Silakan coba lagi nanti.</div>`;
      }
      if (elements.flashSaleSection) {
          elements.flashSaleSection.style.display = 'none';
      }
    }
  }

  function renderFlashSale(data) {
    if (!elements.flashSaleContainer || !elements.flashSaleCardTemplate) return;
    
    if (data.length === 0 && allFlashSale.length === 0) { 
        showSkeleton(elements.flashSaleContainer, elements.flashSaleCardTemplate, 2);
        elements.flashSaleSection.style.display = 'block';
        return;
    }

    const now = new Date();
    const validFlashSale = data.filter(item => {
      try {
        // ===== PERBAIKAN DI SINI =====
        const waktuBerakhirString = item['WaktuBerakhir(YYYY-MM-DD HH:MM)'];
        // ==============================
        
        const endTime = new Date(String(waktuBerakhirString).replace(" ", "T")); 
        return endTime instanceof Date && !isNaN(endTime) && endTime > now;
      } catch (e) {
        console.warn("Format WaktuBerakhir tidak valid:", item['WaktuBerakhir(YYYY-MM-DD HH:MM)']);
        return false;
      }
    });

    if (validFlashSale.length === 0) {
      elements.flashSaleSection.style.display = 'none';
      return;
    }

    elements.flashSaleSection.style.display = 'block';
    const container = elements.flashSaleContainer;
    container.innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    validFlashSale.forEach(item => {
      const card = elements.flashSaleCardTemplate.content.cloneNode(true).firstElementChild;
      
      card.querySelector('.flash-sale-title').textContent = item.NamaProduk;
      card.querySelector('.flash-sale-subtitle').textContent = item.SubNama;
      
      const img = card.querySelector('img');
      if (item.FileGambar && item.FileGambar.startsWith('http')) {
        img.src = item.FileGambar;
      } else {
        img.style.display = 'none';
      }
      img.alt = item.NamaProduk;

      if (item.HargaAsli > 0) {
        const diskon = Math.round(((item.HargaAsli - item.HargaDiskon) / item.HargaAsli) * 100);
        card.querySelector('.original-price').textContent = formatToIdr(item.HargaAsli);
        card.querySelector('.discount-percent').textContent = `-${diskon}%`;
      } else {
         card.querySelector('.discount-badge').style.display = 'none';
      }

      // ===== PERBAIKAN DI SINI (juga) =====
      const timerBadge = card.querySelector('.timer-badge');
      timerBadge.dataset.timeEnd = item['WaktuBerakhir(YYYY-MM-DD HH:MM)'];
      // ===================================
      
      card.addEventListener('click', () => {
        if (item.KategoriID) {
          openProductModal(item.KategoriID);
        }
      });
      
      fragment.appendChild(card);
    });
    container.appendChild(fragment);
    startFlashSaleTimers();
  }

  function renderCategoryFilter(data) {
    const { btn, value, options } = elements.categoryFilter;
    if (!btn || !options || !value) return;
    
    const filters = ['Semua Kategori', ...new Set(data.map(item => item.Filter).filter(Boolean))];
    
    options.innerHTML = '';
    value.textContent = state.home.activeFilter;
    
    filters.forEach(filter => {
      const el = document.createElement('div');
      el.className = 'custom-select-option';
      el.textContent = filter;
      el.dataset.value = filter;
      if (filter === state.home.activeFilter) el.classList.add('selected');
      
      el.addEventListener('click', () => {
        state.home.activeFilter = filter;
        value.textContent = filter;
        options.querySelector('.selected')?.classList.remove('selected');
        el.classList.add('selected');
        
        const filteredData = (filter === 'Semua Kategori') 
          ? allKategori 
          : allKategori.filter(k => k.Filter === filter);
        renderCategoryGrid(filteredData);
        
        toggleCustomSelect(elements.categoryFilter.wrapper, false);
      });
      options.appendChild(el);
    });
  }

  function renderCategoryGrid(data) {
    const container = elements.categoryGridContainer;
    if (!container || !elements.categoryCardTemplate) return;
    
    if (data.length === 0 && allKategori.length === 0) { 
        showSkeleton(container, elements.categoryCardTemplate, 6);
        elements.categoryEmpty.style.display = 'none';
        return;
    }
    
    container.innerHTML = '';
    
    if (data.length === 0) {
      elements.categoryEmpty.style.display = 'flex';
      return;
    }
    
    elements.categoryEmpty.style.display = 'none';
    const fragment = document.createDocumentFragment();
    
    data.forEach(item => {
      const card = elements.categoryCardTemplate.content.cloneNode(true).firstElementChild;
      
      if (item.FileGambarArt && item.FileGambarArt.startsWith('http')) {
        card.style.backgroundImage = `url('${item.FileGambarArt}')`;
      }
      
      const logoImg = card.querySelector('.category-card-logo');
      
      if (item.FileGambarLogo && item.FileGambarLogo.startsWith('http')) {
        logoImg.src = item.FileGambarLogo;
        logoImg.alt = item.Nama;
      } else {
        logoImg.style.display = 'none';
      }
      
      card.addEventListener('click', () => openProductModal(item.KategoriID));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openProductModal(item.KategoriID);
        }
      });
      
      fragment.appendChild(card);
    });
    container.appendChild(fragment);
  }
  
  // --- LOGIKA TIMER ---
  let timerInterval = null;
  function startFlashSaleTimers() {
    if (timerInterval) clearInterval(timerInterval);

    const timerElements = document.querySelectorAll('.timer-badge[data-time-end]');
    if (timerElements.length === 0) return;

    function updateTimers() {
      const now = new Date().getTime();
      let activeTimers = false;
      
      timerElements.forEach(timerEl => {
          try {
              // ===== PERBAIKAN DI SINI =====
              const waktuBerakhirString = timerEl.dataset.timeEnd;
              // ==============================
              
              const endTime = new Date(waktuBerakhirString.replace(" ", "T")).getTime();
              if (isNaN(endTime)) throw new Error("Invalid date");
              const distance = endTime - now;

              if (distance < 0) {
                  timerEl.querySelector('span').textContent = "Berakhir";
                  const card = timerEl.closest('.flash-sale-card');
                  if (card && !card.classList.contains('ended')) {
                      card.style.opacity = '0.6';
                      card.style.cursor = 'default';
                      card.onclick = null;
                      card.classList.add('ended');
                  }
              } else {
                  activeTimers = true;
                  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                  
                  timerEl.querySelector('span').textContent = 
                    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
              }
          } catch (e) {
              timerEl.querySelector('span').textContent = "Error";
              console.error("Error parsing date for timer:", timerEl.dataset.timeEnd, e);
          }
      });

      if (!activeTimers) {
          clearInterval(timerInterval);
          timerInterval = null;
      }
    }
    updateTimers();
    if (!timerInterval) {
        timerInterval = setInterval(updateTimers, 1000);
    }
  }
  
  // --- FUNGSI HALAMAN LAIN (DARI KODE LAMA) ---
  
  // Helper untuk Halaman Akun & Carousell
  function initializeCarousels(container) {
    if (!container) return;
    container.querySelectorAll('.carousel-container').forEach(carouselContainer => {
      const track = carouselContainer.querySelector('.carousel-track');
      const slides = carouselContainer.querySelectorAll('.carousel-slide');
      const imageCount = slides.length;
      if (imageCount > 1) {
        const prevBtn = carouselContainer.querySelector('.prev');
        const nextBtn = carouselContainer.querySelector('.next');
        const indicators = carouselContainer.querySelectorAll('.indicator-dot');
        let currentIndex = 0;
        const update = () => {
          if (!track || !prevBtn || !nextBtn || !indicators) return;
          track.style.transform = `translateX(-${currentIndex * 100}%)`;
          prevBtn.disabled = currentIndex === 0;
          nextBtn.disabled = currentIndex >= imageCount - 1;
          indicators.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
        };
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (currentIndex < imageCount - 1) { currentIndex++; update(); }
        });
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (currentIndex > 0) { currentIndex--; update(); }
        });
        indicators.forEach(dot => dot.addEventListener('click', (e) => {
          e.stopPropagation();
          currentIndex = parseInt(e.target.dataset.index, 10);
          update();
        }));
        update();
      }
    });
  }

  function setupExpandableCard(card, triggerSelector) {
    const trigger = card.querySelector(triggerSelector);
    if (trigger) {
      const action = (e) => {
        if (e.target.closest('a')) return;
        card.classList.toggle('expanded');
      };
      trigger.addEventListener('click', action);
      trigger.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) {
          e.preventDefault();
          action(e);
        }
      });
    }
  }
  
  function formatDescriptionToHTML(text) {
    if (!text) return '';
    return text.split('||').map(line => {
        const trimmedLine = line.trim();
        if (trimmedLine === '') { return '<br>'; }
        else if (trimmedLine.endsWith(':')) { return `<p class="spec-title">${trimmedLine.slice(0, -1)}</p>`; }
        else if (trimmedLine.startsWith('\u203A')) { return `<p class="spec-item spec-item-arrow">${trimmedLine.substring(1).trim()}</p>`; }
        else if (trimmedLine.startsWith('-')) { return `<p class="spec-item spec-item-dash">${trimmedLine.substring(1).trim()}</p>`; }
        else if (trimmedLine.startsWith('#')) { return `<p class="spec-hashtag">${trimmedLine}</p>`; }
        else { return `<p class="spec-paragraph">${trimmedLine}</p>`; }
    }).join('');
  }

  // --- Preorder (LAMA) ---
  function normalizeStatus(rawStatus) { const s = String(rawStatus || '').trim().toLowerCase(); if (['success', 'selesai', 'berhasil', 'done'].includes(s)) return 'success'; if (['progress', 'proses', 'diproses', 'processing'].includes(s)) return 'progress'; if (['failed', 'gagal', 'dibatalkan', 'cancel', 'error'].includes(s)) return 'failed'; return 'pending'; }
  
  function filterPreorderData() {
    const query = elements.preorder.searchInput?.value.trim().toLowerCase() ?? '';
    const statusFilter = elements.preorder.statusSelect?.value ?? 'all';
    const mode = state.preorder.displayMode;
    return state.preorder.allData.filter(item => {
      const status = normalizeStatus(item[mode === 'detailed' ? 6 : 2]);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (query === '') return true;
      if (mode === 'detailed') return [item[3], item[5], item[7]].some(val => String(val || '').toLowerCase().includes(query));
      return [item[0], item[1]].some(val => String(val || '').toLowerCase().includes(query));
    });
  }
  
  function updatePreorderPagination(currentPage, totalPages) {
    if (elements.preorder.prevBtn) elements.preorder.prevBtn.disabled = currentPage <= 1;
    if (elements.preorder.nextBtn) elements.preorder.nextBtn.disabled = currentPage >= totalPages;
    if (elements.preorder.pageInfo) elements.preorder.pageInfo.textContent = totalPages > 0 ? `Hal ${currentPage} dari ${totalPages}` : '';
  }
  
  function renderPreorderCards() {
    if (!elements.preorder || !elements.preorder.listContainer) return;
    
    const filtered = filterPreorderData();
    const { perPage } = state.preorder;
    const { listContainer, total } = elements.preorder;
    total.textContent = `${state.preorder.allData.length} total pesanan${filtered.length !== state.preorder.allData.length ? `, ${filtered.length} ditemukan` : ''}`;
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    state.preorder.currentPage = Math.min(Math.max(1, state.preorder.currentPage), totalPages);
    const start = (state.preorder.currentPage - 1) * perPage;
    const pageData = filtered.slice(start, start + perPage);
    listContainer.innerHTML = '';
    
    if (pageData.length === 0) {
      listContainer.innerHTML = `<div class="empty"><div class="empty-content"><svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg><p>Tidak Ada Hasil Ditemukan</p></div></div>`;
      updatePreorderPagination(0, 0);
      return;
    }
    
    const fragment = document.createDocumentFragment();
    pageData.forEach(item => {
      const card = document.createElement('article');
      if (state.preorder.displayMode === 'detailed') {
        const [tglOrder, estPengiriman, , product, bulan, name, statusRaw] = item;
        const status = normalizeStatus(statusRaw);
        const details = [{ label: 'TGL ORDER', value: tglOrder }, { label: 'BULAN', value: bulan }];
        const detailsHtml = details.filter(d => d.value && String(d.value).trim()).map(d => `<div class="detail-item"><div class="detail-label">${d.label}</div><div class="detail-value">${d.value}</div></div>`).join('');
        card.className = `card ${detailsHtml ? 'clickable' : ''}`;
        card.innerHTML = `<div class="card-header"><div><div class="card-name">${name || 'Tanpa Nama'}</div><div class="card-product">${product || 'N/A'}</div></div><div class="status-badge-wrapper"><div class="status-badge ${status}">${(statusRaw || 'Pending').toUpperCase()}</div>${detailsHtml ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="expand-indicator"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>` : ''}</div></div>${estPengiriman ? `<div class="card-date">Estimasi Pengiriman: ${estPengiriman} 20:00 WIB</div>` : ''}${detailsHtml ? `<div class="card-details"><div class="details-grid">${detailsHtml}</div></div>` : ''}`;
        if (detailsHtml) card.addEventListener('click', () => card.classList.toggle('expanded'));
      } else {
        const [orderNum, product, statusRaw] = item;
        const status = normalizeStatus(statusRaw);
        card.className = 'card';
        card.innerHTML = `<div class="card-header"><div><div class="card-name">${orderNum || 'Tanpa Nomor'}</div><div class="card-product">${product || 'N/A'}</div></div><div class="status-badge ${status}">${(statusRaw || 'Pending').toUpperCase()}</div></div>`;
      }
      fragment.appendChild(card);
    });
    listContainer.appendChild(fragment);
    updatePreorderPagination(state.preorder.currentPage, totalPages);
  }
  
  async function fetchPreorderData(sheetName) {
    if (!elements.preorder || !elements.preorder.total || !elements.preorder.listContainer || !elements.skeletonCardTemplate) return;
    if (preorderFetchController) preorderFetchController.abort();
    preorderFetchController = new AbortController();
    elements.preorder.total.textContent = 'Memuat data...';
    showSkeleton(elements.preorder.listContainer, elements.skeletonCardTemplate, 5);
    state.preorder.displayMode = sheetName === config.sheets.preorder.name1 ? 'detailed' : 'simple';
    try {
      const text = await fetchSheetCached(sheetName, 'csv');
      let rows = robustCsvParser(text);
      rows.shift();
      const statusOrder = { progress: 1, pending: 2, success: 3, failed: 4 };
      const statusIndex = state.preorder.displayMode === 'detailed' ? 6 : 2;
      state.preorder.allData = rows.filter(row => row && (row[0] || '').trim()).sort((a, b) => statusOrder[normalizeStatus(a[statusIndex])] - statusOrder[normalizeStatus(b[statusIndex])]);
    } catch (e) {
      if (e.name === 'AbortError') return;
      state.preorder.allData = [];
      elements.preorder.total.textContent = 'Gagal memuat data.';
      console.error('Fetch Pre-Order failed:', e);
    } finally {
      state.preorder.currentPage = 1;
      renderPreorderCards();
    }
  }
  
  function initializePreorder() {
    if (!elements.preorder) return;
    if (state.preorder.initialized) return;
    const { searchInput, customSelect, prevBtn, nextBtn, customStatusSelect } = elements.preorder;
    if (!searchInput || !customSelect || !prevBtn || !nextBtn || !customStatusSelect) return;
    
    const rebound = () => { state.preorder.currentPage = 1; renderPreorderCards(); };
    searchInput.addEventListener('input', rebound);
    customSelect.options?.querySelectorAll('.custom-select-option').forEach(option => {
      option.addEventListener('click', e => {
        customSelect.value.textContent = e.target.textContent;
        customSelect.options.querySelector('.selected')?.classList.remove('selected');
        e.target.classList.add('selected');
        fetchPreorderData(e.target.dataset.value === '0' ? config.sheets.preorder.name1 : config.sheets.preorder.name2);
        toggleCustomSelect(customSelect.wrapper, false);
      });
    });
    customStatusSelect.options?.querySelectorAll('.custom-select-option').forEach(option => {
      option.addEventListener('click', e => {
        customStatusSelect.value.textContent = e.target.textContent;
        customStatusSelect.options.querySelector('.selected')?.classList.remove('selected');
        e.target.classList.add('selected');
        if (elements.preorder.statusSelect) elements.preorder.statusSelect.value = e.target.dataset.value;
        toggleCustomSelect(customStatusSelect.wrapper, false);
        rebound();
      });
    });
    prevBtn.addEventListener('click', () => { if (state.preorder.currentPage > 1) { state.preorder.currentPage--; renderPreorderCards(); window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' }); } });
    nextBtn.addEventListener('click', () => { state.preorder.currentPage++; renderPreorderCards(); window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' }); });
    fetchPreorderData(config.sheets.preorder.name1);
    state.preorder.initialized = true;
  }
  
  // --- Akun (LAMA) ---
  function populateAccountCategorySelect() {
    const { customSelect } = elements.accounts;
    if (!customSelect || !customSelect.options || !customSelect.value) return;
    
    const { options, value } = customSelect;
    const categories = ['Semua Kategori', 'Mobile Legends', 'Free Fire', 'Roblox', 'PUBG Mobile', 'Clash Of Clans', 'Lainnya'];
    options.innerHTML = '';
    value.textContent = state.accounts.activeCategory;
    categories.forEach((cat) => {
      const el = document.createElement('div');
      el.className = 'custom-select-option';
      el.textContent = cat;
      el.dataset.value = cat;
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
  
  async function parseAccountsSheet(text) {
    const rows = robustCsvParser(text);
    rows.shift();
    return rows.filter(row => row && row.length >= 5 && row[0]).map(row => ({
      id: `acc_${Date.now()}_${Math.random()}`,
      title: `${row[0] || 'Akun'} (${formatToIdr(Number(row[1]) || 0)})`,
      category: row[0] || 'Lainnya',
      price: Number(row[1]) || 0,
      status: row[2] || 'Tersedia',
      description: row[3] || 'Tidak ada deskripsi.',
      images: (row[4] || '').split(',').map(url => url.trim()).filter(Boolean),
    }));
  }
  
  function renderAccountCards() {
    const { cardGrid, cardTemplate, empty } = elements.accounts;
    if (!cardGrid || !cardTemplate || !empty) return;

    const filteredAccounts = state.accounts.allData.filter(acc => state.accounts.activeCategory === 'Semua Kategori' || acc.category === state.accounts.activeCategory);
    cardGrid.innerHTML = '';
    empty.style.display = filteredAccounts.length === 0 ? 'flex' : 'none';
    if (filteredAccounts.length === 0) return;
    const fragment = document.createDocumentFragment();
    filteredAccounts.forEach(account => {
      const cardClone = cardTemplate.content.cloneNode(true);
      const cardElement = cardClone.querySelector('.account-card');
      const carouselWrapper = cardElement.querySelector('.account-card-carousel-wrapper');
      if (account.images.length > 0) {
        const carouselContainer = document.createElement('div');
        carouselContainer.className = 'carousel-container';
        const slides = account.images.map(src => `<div class="carousel-slide"><img src="${src}" alt="Gambar detail untuk ${account.category}" loading="lazy"></div>`).join('');
        const indicators = account.images.map((_, i) => `<button class="indicator-dot" data-index="${i}"></button>`).join('');
        carouselContainer.innerHTML = `<div class="carousel-track">${slides}</div>${account.images.length > 1 ? `<button class="carousel-btn prev" type="button" aria-label="Gambar sebelumnya" disabled><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button><button class="carousel-btn next" type="button" aria-label="Gambar selanjutnya"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button><div class="carousel-indicators">${indicators}</div>` : ''}`;
        carouselWrapper.appendChild(carouselContainer);
      }
      cardElement.querySelector('h3').textContent = formatToIdr(account.price);
      const statusBadge = cardElement.querySelector('.account-status-badge');
      statusBadge.textContent = account.status;
      statusBadge.className = `account-status-badge ${account.status.toLowerCase() === 'tersedia' ? 'available' : 'sold'}`;
      const specsContainer = cardElement.querySelector('.account-card-specs');
      specsContainer.innerHTML = formatDescriptionToHTML(account.description.replace(/\n/g, '||'));
      
      cardElement.querySelector('.action-btn.buy').addEventListener('click', () => openPaymentModal({ title: account.title, price: account.price, catLabel: 'Akun Game' }));
      cardElement.querySelector('.action-btn.offer').addEventListener('click', () => window.open(`https://wa.me/${config.waNumber}?text=${encodeURIComponent(`Halo, saya tertarik untuk menawar Akun Game: ${account.category} (${formatToIdr(account.price)})`)}`, '_blank', 'noopener'));
      setupExpandableCard(cardElement, '.account-card-main-info');
      fragment.appendChild(cardElement);
    });
    cardGrid.appendChild(fragment);
    initializeCarousels(cardGrid);
  }
  
  async function initializeAccounts() {
    if (!elements.accounts) return;
    if (state.accounts.initialized) return;
    state.accounts.initialized = true;
    const { cardGrid, error, empty } = elements.accounts;
    if (!cardGrid || !error || !empty || !elements.skeletonCardTemplate) return;
    
    error.style.display = 'none'; empty.style.display = 'none';
    showSkeleton(cardGrid, elements.skeletonCardTemplate, 4);
    try {
      const accText = await fetchSheetCached(config.sheets.accounts, 'csv');
      state.accounts.allData = await parseAccountsSheet(accText);
      populateAccountCategorySelect();
      renderAccountCards();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Fetch Accounts failed:', err);
      cardGrid.innerHTML = '';
      error.textContent = 'Gagal memuat data akun. Coba lagi nanti.';
      error.style.display = 'block';
    }
  }

  // --- Perpustakaan (LAMA) ---
  async function initializeLibrary() {
    const container = getElement('libraryGridContainer');
    const errorEl = getElement('libraryError');
    if (!container || !errorEl) return;
    container.innerHTML = ''; errorEl.style.display = 'none';
    try {
      const libText = await fetchSheetCached(config.sheets.library, 'csv');
      const rows = robustCsvParser(libText);
      rows.shift();
      const books = rows.filter(r => r && r[0]).map(r => ({ title: r[0], coverUrl: r[1], bookUrl: r[2] }));
      if (!books || books.length === 0) { container.innerHTML = '<div class="empty">Belum ada buku yang ditambahkan.</div>'; return; }
      const fragment = document.createDocumentFragment();
      books.forEach(book => {
        const card = document.createElement('a');
        card.className = 'book-card';
        card.href = book.bookUrl;
        card.target = '_blank';
        card.rel = 'noopener';
        card.innerHTML = `<img src="${book.coverUrl}" alt="${book.title}" class="cover" decoding="async" loading="lazy"><div class="overlay"></div><div class="title">${book.title}</div>`;
        fragment.appendChild(card);
      });
      container.appendChild(fragment);
    } catch (err) {
      console.error('Failed to load library:', err);
      errorEl.textContent = 'Gagal memuat perpustakaan. Coba lagi nanti.';
      errorEl.style.display = 'block';
    }
  }

  // --- Carousell (LAMA) ---
  async function initializeCarousell() {
    if (!elements.carousell) return;
    if (state.carousell.initialized) return;
    const { gridContainer, error, searchInput, total } = elements.carousell;
    if (!gridContainer || !error || !searchInput || !total) return;
    
    gridContainer.innerHTML = '';
    error.style.display = 'none';
    
    let searchDebounce;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            state.carousell.searchQuery = e.target.value.trim();
            renderCarousellGrid(state.carousell.allData);
        }, 200);
    });
    
    try {
        const carText = await fetchSheetCached(config.sheets.affiliate, 'csv');
        const rows = robustCsvParser(carText);
        rows.shift();
        const products = rows.filter(r => r && r[0] && r[3]).map(r => ({
            name: r[0],
            price: Number(r[1]) || 0,
            images: (r[2] || '').split(',').map(url => url.trim()).filter(Boolean),
            linkUrl: r[3],
            description: r[4] || 'Klik untuk melihat detail produk.',
            platform: r[5] || '',
            productNumber: r[6] || ''
        }));
        state.carousell.allData = products;
        renderCarousellGrid(products);
    } catch (err) {
        console.error('Failed to load Carousell products:', err);
        error.textContent = 'Gagal memuat produk Carousell. Coba lagi nanti.';
        error.style.display = 'block';
    } finally {
        state.carousell.initialized = true;
    }
  }
  
  function renderCarousellGrid(products) {
      const container = elements.carousell.gridContainer;
      const totalEl = elements.carousell.total;
      if (!container || !totalEl) return;

      const query = state.carousell.searchQuery || '';
      const filteredProducts = query
          ? products.filter(p => String(p.productNumber).includes(query))
          : products;
      
      if (products.length > 0) {
        totalEl.textContent = `${products.length} total produk${query ? `, ${filteredProducts.length} ditemukan` : ''}`;
        totalEl.style.display = 'block';
      } else {
        totalEl.style.display = 'none';
      }
      
      if (!filteredProducts || filteredProducts.length === 0) {
          container.innerHTML = '<div class="empty">Belum ada produk di Carousell.</div>';
          return;
      }
      
      container.innerHTML = '';
      const fragment = document.createDocumentFragment();
      filteredProducts.forEach(product => {
          const card = document.createElement('div');
          card.className = 'affiliate-card';
          let imagesHTML = '';
          if (product.images.length > 0) {
            const slides = product.images.map(src => `<div class="carousel-slide"><img src="${src}" alt="Gambar produk ${product.name}" loading="lazy"></div>`).join('');
            const indicators = product.images.map((_, i) => `<button class="indicator-dot" data-index="${i}"></button>`).join('');
            imagesHTML = `<div class="carousel-container"><div class="carousel-track">${slides}</div>${product.images.length > 1 ? `<button class="carousel-btn prev" type="button" aria-label="Gambar sebelumnya" disabled><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button><button class="carousel-btn next" type="button" aria-label="Gambar selanjutnya"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button><div class="carousel-indicators">${indicators}</div>` : ''}</div>`;
          } else {
            imagesHTML = `<div class="affiliate-card-img-container"></div>`;
          }
          const platformHTML = product.platform ? `<p class="affiliate-card-platform">${product.platform}</p>` : ''
          const formattedProductNumber = product.productNumber ? String(product.productNumber).padStart(3, '0') : '';
          const productNumberHTML = formattedProductNumber ? `<span class="affiliate-card-number">#${formattedProductNumber}</span>` : '';
          card.innerHTML = `
            ${productNumberHTML}
            ${imagesHTML}
            <div class="affiliate-card-body" role="button" tabindex="0">
                <div class="affiliate-card-main-info">
                  <h3 class="affiliate-card-title">${product.name}</h3>
                  <svg class="expand-indicator" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
                </div>
                ${platformHTML}
                <p class="affiliate-card-price">${formatToIdr(product.price)}</p>
                <div class="affiliate-card-details-wrapper">
                  <div class="affiliate-card-desc">${formatDescriptionToHTML(product.description)}</div>
                </div>
                <a href="${product.linkUrl}" target="_blank" rel="noopener" class="affiliate-card-button">Beli Sekarang</a>
            </div>
          `;
          setupExpandableCard(card, '.affiliate-card-body');
          fragment.appendChild(card);
      });
      container.appendChild(fragment);
      initializeCarousels(container);
  }

  // --- Testimoni (LAMA) ---
  function pp_makeNodes(list) {
    const frag = document.createDocumentFragment();
    list.forEach(({ name, url }) => {
      const li = document.createElement('li');
      li.className = 'testi-item';
      li.innerHTML = `<figure class="testi-fig"><img src="${url}" alt="Testimoni ${name.replace(/"/g,'&quot;')}" decoding="async" loading="lazy"></figure><figcaption class="testi-caption">&mdash; ${name.replace(/</g,'&lt;')}</figcaption>`;
      frag.appendChild(li);
    });
    return frag;
  }
  
  async function initializeTestimonialMarquee() {
    const section = document.getElementById('testimonialSection');
    if (!section) return;
    const marquee = section.querySelector('.testi-marquee');
    const track = section.querySelector('#testiTrack');
    if (!marquee || !track) return;

    try {
      const csv = await fetchSheetCached(config.sheets.testimonial, 'csv');
      const rows = robustCsvParser(csv);
      if (rows.length <= 1) {
        section.style.display = 'none';
        return;
      }
      const items = rows.slice(1).filter(r => r && r[0] && r[1]).map(r => ({ name: String(r[0]).trim(), url: String(r[1]).trim() }));
      if (!items.length) {
        section.style.display = 'none';
        return;
      }
      track.innerHTML = '';
      track.appendChild(pp_makeNodes(items));
      track.appendChild(pp_makeNodes(items));

      let pos = 0;
      let isDragging = false;
      let startX = 0;
      let startPos = 0;
      let animationFrameId;
      const speed = 0.5;
      const firstHalfWidth = track.scrollWidth / 2;

      function animate() {
        if (prefersReducedMotion || document.hidden) { return; }
        if (!isDragging) { pos -= speed; }
        if (pos <= -firstHalfWidth) { pos += firstHalfWidth; }
        track.style.transform = `translateX(${pos}px)`;
        animationFrameId = requestAnimationFrame(animate);
      }
      function onDragStart(e) {
        isDragging = true;
        marquee.classList.add('is-grabbing');
        startX = e.pageX || e.touches[0].pageX;
        startPos = pos;
        cancelAnimationFrame(animationFrameId);
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('touchmove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
        window.addEventListener('touchend', onDragEnd);
      }
      function onDragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const currentX = e.pageX || e.touches[0].pageX;
        const diff = currentX - startX;
        pos = startPos + diff;
        track.style.transform = `translateX(${pos}px)`;
      }
      function onDragEnd() {
        isDragging = false;
        marquee.classList.remove('is-grabbing');
        const trackWidth = track.scrollWidth / 2;
        pos = pos % trackWidth;
        animate();
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('touchmove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
        window.removeEventListener('touchend', onDragEnd);
      }
      marquee.addEventListener('mousedown', onDragStart);
      document.addEventListener('visibilitychange', ()=>{ if (document.hidden) { cancelAnimationFrame(animationFrameId); } else { animate(); } });
      marquee.addEventListener('touchstart', onDragStart, { passive: true });
      animate();
    } catch (err) {
      console.error('Testimonials error:', err);
      if (section) section.style.display = 'none';
    }
  }

  // --- Inisialisasi Aplikasi (UTAMA) ---
  function initializeApp() {
    // Listener utama
    elements.sidebar.burger?.addEventListener('click', () => toggleSidebar());
    elements.sidebar.overlay?.addEventListener('click', () => toggleSidebar(false));
    elements.themeToggle?.addEventListener('click', toggleTheme);

    // Listener Modal
    elements.paymentModal.closeBtn?.addEventListener('click', closePaymentModal);
    elements.paymentModal.modal?.addEventListener('click', e => { if (e.target === elements.paymentModal.modal) closePaymentModal(); });
    elements.productModal.closeBtn?.addEventListener('click', closeProductModal);
    elements.productModal.modal?.addEventListener('click', e => { if (e.target === elements.productModal.modal) closeProductModal(); });

    // Listener Navigasi Donasi
    elements.navLinks.forEach(link => {
      link.addEventListener('click', e => {
        if (link.dataset.mode === 'donasi') {
          e.preventDefault();
          window.open('https://saweria.co/playpal', '_blank', 'noopener');
        }
      });
    });

    // Listener untuk semua custom select
    [elements.categoryFilter, elements.accounts?.customSelect, elements.preorder?.customSelect, elements.preorder?.customStatusSelect]
      .filter(select => select && select.btn)
      .forEach(select => {
        select.btn.addEventListener('click', (e) => { e.stopPropagation(); toggleCustomSelect(select.wrapper); });
        // enhanceCustomSelectKeyboard(select.wrapper); // (Fungsi ini bisa ditambahkan kembali)
      });

    // Tutup select jika klik di luar
    document.addEventListener('click', (e) => {
      [elements.categoryFilter?.wrapper, elements.accounts?.customSelect?.wrapper, elements.preorder?.customSelect?.wrapper, elements.preorder?.customStatusSelect?.wrapper]
        .filter(wrapper => wrapper && wrapper.classList.contains('open'))
        .forEach(wrapper => toggleCustomSelect(wrapper, false));
    });

    // Inisialisasi berdasarkan halaman saat ini
    if (elements.viewHome) {
      loadHomePageData();
    }
    if (elements.viewPreorder) {
      initializePreorder();
    }
    if (elements.viewAccounts) {
      initializeAccounts();
    }
    if (elements.viewPerpustakaan) {
      initializeLibrary();
    }
    if (elements.viewCarousell) {
      initializeCarousell();
    }
    
    // Inisialisasi Testimoni (hanya di halaman yang ada)
    if (document.getElementById('testimonialSection')) {
      initializeTestimonialMarquee();
    }
    
    updateHeaderStatus();
    setInterval(updateHeaderStatus, 60000);
  }
  
  // --- Jalankan Aplikasi ---
  document.addEventListener('DOMContentLoaded', initializeApp);

})();
