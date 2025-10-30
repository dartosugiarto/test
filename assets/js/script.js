(function () {
  'use strict';

  // --- LOGIKA DARK MODE (TETAP) ---
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

  // --- KONFIGURASI ---
  const config = {
    // ID Google Sheet BARU Anda
    sheetId: '11hRQ9fw5RwfoWUbyMgQ3k2QPEZAAR2EJ4FsyX8oS3zU',
    sheets: {
      kategori: 'Sheet1',
      produk: 'Sheet2',
      flashSale: 'Sheet3'
    },
    // Path folder gambar lokal
    paths: {
      art: '/assets/images/art/',
      logos: '/assets/images/logos/'
    },
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
  let allKategori = [];
  let allProduk = [];
  let allFlashSale = [];
  let currentSelectedItem = null;
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

    // Halaman Lain (TETAP)
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
    
    // Halaman Akun (TETAP)
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
    // ... (Elemen Preorder, Carousell, dll. tetap ada)
  };
  
  // --- FUNGSI HELPER (Utilitas) ---
  function formatToIdr(value) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }

  function getSheetUrl(sheetName) {
    const baseUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`;
    return `${baseUrl}?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`;
  }

  async function fetchSheetData(sheetName) {
    const url = getSheetUrl(sheetName);
    const key = `pp_cache_${sheetName}`;
    
    try {
      // Coba ambil dari cache dulu
      const cached = sessionStorage.getItem(key);
      if (cached) {
        // Jika ada cache, langsung parse
        return parseGvizJson(cached);
      }
      
      // Jika tidak ada cache, fetch baru
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
      
      const text = await res.text();
      sessionStorage.setItem(key, text); // Simpan ke cache
      return parseGvizJson(text);
      
    } catch (err) {
      console.error(`Gagal mengambil data dari ${sheetName}:`, err);
      // Jika gagal, coba ambil dari cache (jika ada) tanpa revalidasi
      const cached = sessionStorage.getItem(key);
      if (cached) {
        return parseGvizJson(cached);
      }
      throw err; // Lempar error jika cache juga tidak ada
    }
  }

  function parseGvizJson(jsonText) {
    const match = jsonText.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
    if (!match || !match[1]) {
      throw new Error('Format Respons GViz tidak valid');
    }
    const obj = JSON.parse(match[1]);
    const table = obj.table;
    if (!table) return [];

    const cols = table.cols.map(col => col.label || col.id);
    const rows = table.rows.map(row => {
      const item = {};
      row.c.forEach((cell, i) => {
        const colName = cols[i];
        if (cell) {
          item[colName] = cell.v;
        }
      });
      return item;
    });
    return rows;
  }
  
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
          // Buka modal payment (LAMA) dengan data produk ini
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

    const focusableEls = modalEl.querySelectorAll('a[href]:not([disabled]), button:not([disabled]), input[type="radio"]:not([disabled])');
    trap.focusableEls = Array.from(focusableEls);
    trap.firstEl = trap.focusableEls[0];
    trap.lastEl = trap.focusableEls[trap.focusableEls.length - 1];
    trap.listener = function(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === trap.firstEl) {
          trap.lastEl.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === trap.lastEl) {
          trap.firstEl.focus();
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
  
  // --- LOGIKA RENDER HALAMAN HOME (BARU) ---
  
  async function loadHomePageData() {
    try {
      // Ambil semua data secara paralel
      const [kategoriData, produkData, flashSaleData] = await Promise.all([
        fetchSheetData(config.sheets.kategori),
        fetchSheetData(config.sheets.produk),
        fetchSheetData(config.sheets.flashSale)
      ]);

      allKategori = kategoriData;
      allProduk = produkData;
      allFlashSale = flashSaleData;

      // Render semua bagian
      renderFlashSale(allFlashSale);
      renderCategoryFilter(allKategori);
      renderCategoryGrid(allKategori);

    } catch (err) {
      console.error("Gagal memuat data halaman utama:", err);
      elements.categoryGridContainer.innerHTML = `<div class="err" style="grid-column: 1 / -1;">Gagal memuat data. Silakan coba lagi nanti.</div>`;
    }
  }

  function renderFlashSale(data) {
    if (!elements.flashSaleContainer) return;
    
    // Filter hanya flash sale yang masih valid
    const now = new Date();
    const validFlashSale = data.filter(item => {
      const endTime = new Date(item.WaktuBerakhir);
      return endTime > now;
    });

    if (validFlashSale.length === 0) {
      elements.flashSaleSection.style.display = 'none'; // Sembunyikan seluruh section
      return;
    }

    elements.flashSaleSection.style.display = 'block'; // Tampilkan section
    const container = elements.flashSaleContainer;
    container.innerHTML = ''; // Hapus skeleton
    
    const fragment = document.createDocumentFragment();
    validFlashSale.forEach(item => {
      const card = elements.flashSaleCardTemplate.content.cloneNode(true).firstElementChild;
      
      card.querySelector('.flash-sale-title').textContent = item.NamaProduk;
      card.querySelector('.flash-sale-subtitle').textContent = item.SubNama;
      
      const img = card.querySelector('img');
      img.src = config.paths.logos + item.FileGambar; // Asumsi gambar ada di folder logos
      img.alt = item.NamaProduk;

      // Harga
      const diskon = Math.round(((item.HargaAsli - item.HargaDiskon) / item.HargaAsli) * 100);
      card.querySelector('.original-price').textContent = formatToIdr(item.HargaAsli);
      card.querySelector('.discount-percent').textContent = `-${diskon}%`;

      // Timer
      const timerBadge = card.querySelector('.timer-badge');
      timerBadge.dataset.timeEnd = item.WaktuBerakhir; // Simpan waktu berakhir untuk timer
      
      // Tambahkan klik
      card.addEventListener('click', () => {
        // Jika itemnya punya KategoriID, buka modal produk
        if (item.KategoriID) {
          openProductModal(item.KategoriID);
        }
      });
      
      fragment.appendChild(card);
    });
    container.appendChild(fragment);
    startFlashSaleTimers(); // Nyalakan semua timer
  }

  function renderCategoryFilter(data) {
    const { btn, value, options } = elements.categoryFilter;
    if (!btn) return;
    
    const filters = ['Semua Kategori', ...new Set(data.map(item => item.Filter).filter(Boolean))];
    
    options.innerHTML = '';
    filters.forEach(filter => {
      const el = document.createElement('div');
      el.className = 'custom-select-option';
      el.textContent = filter;
      el.dataset.value = filter;
      if (filter === 'Semua Kategori') el.classList.add('selected');
      
      el.addEventListener('click', () => {
        value.textContent = filter;
        options.querySelector('.selected')?.classList.remove('selected');
        el.classList.add('selected');
        
        // Logika filter grid
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
    if (!container) return;
    
    container.innerHTML = ''; // Hapus skeleton
    
    if (data.length === 0) {
      elements.categoryEmpty.style.display = 'flex';
      return;
    }
    
    elements.categoryEmpty.style.display = 'none';
    const fragment = document.createDocumentFragment();
    
    data.forEach(item => {
      const card = elements.categoryCardTemplate.content.cloneNode(true).firstElementChild;
      
      // Set background art
      card.style.backgroundImage = `url('${config.paths.art}${item.FileGambarArt}')`;
      
      // Set logo overlay
      const logoImg = card.querySelector('.category-card-logo');
      logoImg.src = `${config.paths.logos}${item.FileGambarLogo}`;
      logoImg.alt = item.Nama;
      
      // Tambahkan klik
      card.addEventListener('click', () => openProductModal(item.KategoriID));
      
      fragment.appendChild(card);
    });
    container.appendChild(fragment);
  }
  
  // --- LOGIKA TIMER ---
  let timerInterval = null;
  function startFlashSaleTimers() {
    if (timerInterval) clearInterval(timerInterval); // Hapus timer lama jika ada

    const timerElements = document.querySelectorAll('.timer-badge[data-time-end]');
    if (timerElements.length === 0) return;

    function updateTimers() {
      const now = new Date().getTime();
      timerElements.forEach(timerEl => {
        const endTime = new Date(timerEl.dataset.timeEnd).getTime();
        const distance = endTime - now;

        if (distance < 0) {
          timerEl.querySelector('span').textContent = "Berakhir";
          // Hapus card-nya jika sudah berakhir
          timerEl.closest('.flash-sale-card')?.remove();
        } else {
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          
          timerEl.querySelector('span').textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
      });
    }
    updateTimers(); // Jalankan sekali
    timerInterval = setInterval(updateTimers, 1000); // Ulangi setiap detik
  }
  
  // --- Inisialisasi Aplikasi ---
  function initializeApp() {
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
    [elements.categoryFilter, elements.accounts?.customSelect]
      .filter(select => select && select.btn)
      .forEach(select => {
        select.btn.addEventListener('click', (e) => { e.stopPropagation(); toggleCustomSelect(select.wrapper); });
        // enhanceCustomSelectKeyboard(select.wrapper); // (Fungsi ini ada di kode lama, bisa ditambahkan jika perlu)
      });

    // Tutup select jika klik di luar
    document.addEventListener('click', (e) => {
      [elements.categoryFilter?.wrapper, elements.accounts?.customSelect?.wrapper]
        .filter(wrapper => wrapper && wrapper.classList.contains('open'))
        .forEach(wrapper => toggleCustomSelect(wrapper, false));
    });

    // Inisialisasi berdasarkan halaman saat ini
    if (elements.viewHome) {
      loadHomePageData();
    }
    if (elements.viewPreorder) {
      // initializePreorder(); // (Fungsi dari kode lama, masih ada)
    }
    if (elements.viewAccounts) {
      // initializeAccounts(); // (Fungsi dari kode lama, masih ada)
    }
    if (elements.viewPerpustakaan) {
      // initializeLibrary(); // (Fungsi dari kode lama, masih ada)
    }
    if (elements.viewCarousell) {
      // initializeCarousell(); // (Fungsi dari kode lama, masih ada)
    }
    
    // Inisialisasi Testimoni (jika ada di halaman)
    if (document.getElementById('testimonialSection')) {
      // initializeTestimonialMarquee(); // (Fungsi dari kode lama, masih ada)
    }
    
    updateHeaderStatus();
    setInterval(updateHeaderStatus, 60000);
  }

  // --- Salin fungsi-fungsi lama yang masih relevan (Preorder, Accounts, Testimoni, dll.) ---
  // ... (Salin semua fungsi seperti initializePreorder, initializeAccounts, initializeLibrary, 
  //      initializeCarousell, initializeTestimonialMarquee, dll. dari script.js lama Anda ke sini)
  // ... (Saya akan tambahkan fungsi 'toggleCustomSelect' dari kode lama Anda agar dropdown berfungsi)

  function toggleCustomSelect(wrapper, forceOpen) {
    if (!wrapper) return;
    const btn = wrapper.querySelector('.custom-select-btn');
    const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !wrapper.classList.contains('open');
    wrapper.classList.toggle('open', isOpen);
    if (btn) btn.setAttribute('aria-expanded', isOpen);
  }
  
  // (Pastikan fungsi-fungsi lain seperti `initializeTestimonialMarquee` ada di sini)
  
  // --- Jalankan Aplikasi ---
  document.addEventListener('DOMContentLoaded', initializeApp);

})();
