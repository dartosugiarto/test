/**
 * @file script.js
 * @description Main script for the PlayPal.ID single-page application.
 * @version 8.0.0 (Final - Implemented Correct Expandable Card List)
 */
'use strict';

(function () {

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

  const state = {
    home: { activeCategory: '', searchQuery: '' },
    preorder: {
      initialized: false,
      allData: [],
      currentPage: 1,
      perPage: 15,
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
    // ... sisa elemen untuk view lain
  };

  function initializeApp() {
    // Event listeners utama seperti theme, sidebar, dll.
    // ... (kode ini tidak berubah dan panjang, jadi saya persingkat di sini untuk fokus pada perbaikan)
    // Anda bisa salin-tempel dari versi sebelumnya atau gunakan kode lengkap di bawah.
  }
  
  // ... (kode helper yang tidak berubah seperti formatToIdr, getSheetUrl, dll.)
  
  // --- AKUN GAME FUNCTIONS (FINAL) ---

  function robustCsvParser(text) {
    const normalizedText = text.trim().replace(/\r\n/g, '\n');
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotedField = false;
    for (let i = 0; i < normalizedText.length; i++) {
      const char = normalizedText[i];
      if (inQuotedField) {
        if (char === '"' && (i + 1 < normalizedText.length && normalizedText[i + 1] === '"')) {
          currentField += '"';
          i++;
        } else if (char === '"') {
          inQuotedField = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotedField = true;
        } else if (char === ',') {
          currentRow.push(currentField);
          currentField = '';
        } else if (char === '\n') {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }
    currentRow.push(currentField);
    rows.push(currentRow);
    return rows;
  }
  
  async function parseAccountsSheet(text) {
    const rows = robustCsvParser(text);
    rows.shift(); // Hapus header
    return rows
      .filter(row => row && row.length >= 5 && row[0] && row[1]) // Pastikan ada kategori dan harga
      .map(row => {
        const price = Number(row[1]) || 0;
        const title = `${row[0] || 'Akun'} (${formatToIdr(price)})`;
        return {
          title: title,
          category: row[0] || 'Lainnya',
          price: price,
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
      el.dataset.value = cat;
      if (cat === state.accounts.activeCategory) el.classList.add('selected');
      
      el.addEventListener('click', () => {
        value.textContent = cat;
        options.querySelector('.selected')?.classList.remove('selected');
        el.classList.add('selected');
        // toggleCustomSelect is a helper function you already have
        // toggleCustomSelect(customSelect.wrapper, false); 
        state.accounts.activeCategory = cat;
        renderAccountCards();
      });
      options.appendChild(el);
    });
  }

  function renderAccountCards() {
    const { cardGrid, cardTemplate, empty } = elements.accounts;
    const { activeCategory } = state.accounts;
    
    const filteredAccounts = state.accounts.allData.filter(acc => 
        activeCategory === 'Semua Kategori' || acc.category === activeCategory
    );
    
    cardGrid.innerHTML = '';
    
    if (filteredAccounts.length === 0) {
      empty.style.display = 'flex';
      return;
    }
    
    empty.style.display = 'none';
    filteredAccounts.forEach(account => {
      const cardClone = cardTemplate.content.cloneNode(true);
      const cardElement = cardClone.querySelector('.account-card');
      
      // Populate banner and summary (bagian yang selalu terlihat)
      cardElement.querySelector('.account-card-banner-wrapper').innerHTML = `<img src="${account.images[0] || ''}" alt="${account.title}" loading="lazy">`;
      const summary = cardElement.querySelector('.account-card-summary');
      summary.innerHTML = `
        <h3>${formatToIdr(account.price)}</h3>
        <span class="account-status-badge ${account.status.toLowerCase() === 'tersedia' ? 'available' : 'sold'}">${account.status}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="icon expand-indicator">
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      `;
      
      summary.addEventListener('click', () => {
        const detailsWrapper = cardElement.querySelector('.account-card-details-wrapper');
        if (detailsWrapper.innerHTML === '') {
          buildAndInjectDetails(cardElement, account);
        }
        
        // Timeout kecil untuk memastikan transisi berjalan setelah konten di-render
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
    if (account.images && account.images.length > 0) {
      const slides = account.images.map(src => `<div class="carousel-slide"><img src="${src}" alt="Gambar detail untuk ${account.title}" loading="lazy"></div>`).join('');
      const indicators = account.images.map((_, i) => `<button type="button" class="indicator-dot" data-index="${i}"></button>`).join('');
      carouselHtml = `
        <div class="carousel-container">
          <div class="carousel-track" style="transform: translateX(0%);">${slides}</div>
          <button class="carousel-btn prev" type="button" aria-label="Gambar sebelumnya" disabled>&lt;</button>
          <button class="carousel-btn next" type="button" aria-label="Gambar selanjutnya">&gt;</button>
          <div class="carousel-indicators">${indicators}</div>
        </div>
      `;
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
    
    detailsContent.querySelector('.buy').addEventListener('click', (e) => {
        e.stopPropagation();
        openPaymentModal({ title: account.title, price: account.price, catLabel: 'Akun Game' });
    });
    detailsContent.querySelector('.offer').addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(`https://wa.me/${config.waNumber}?text=${encodeURIComponent(`Halo, saya tertarik untuk menawar Akun Game: ${account.title}`)}`, '_blank', 'noopener');
    });
    
    if (account.images && account.images.length > 1) {
      initializeCardCarousel(detailsContent.querySelector('.carousel-container'), account.images.length);
    }
  }

  function initializeCardCarousel(container, imageCount) {
    const track = container.querySelector('.carousel-track');
    const prevBtn = container.querySelector('.prev');
    const nextBtn = container.querySelector('.next');
    const indicators = container.querySelectorAll('.indicator-dot');
    let currentIndex = 0;

    const update = () => {
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex >= imageCount - 1;
      indicators.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
    };

    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); if (currentIndex < imageCount - 1) { currentIndex++; update(); } });
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); if (currentIndex > 0) { currentIndex--; update(); } });
    indicators.forEach(dot => dot.addEventListener('click', (e) => { e.stopPropagation(); currentIndex = parseInt(e.target.dataset.index, 10); update(); }));
    
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
    cardGrid.innerHTML = '';
    customSelect.btn.disabled = true;

    try { 
      const res = await fetch(getSheetUrl(config.sheets.accounts.name, 'csv'), { signal: accountsFetchController.signal }); 
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`); 
      
      const text = await res.text(); 
      state.accounts.allData = await parseAccountsSheet(text); 
      populateAccountCategorySelect();
      renderAccountCards();
    } catch (err) { 
      if (err.name === 'AbortError') return;
      console.error('Fetch Accounts failed:', err); 
      error.style.display = 'block';
    } finally {
        customSelect.btn.disabled = false;
    }
  }

  // --- Sisa Fungsi (Pre-order, Library, Testimonials, dll.) ---
  // Kode ini sama seperti versi sebelumnya, jadi untuk keringkasan tidak saya tampilkan lagi.
  // Pastikan Anda menyalin seluruh fungsi dari file JS Anda sebelumnya untuk bagian ini.
  // Ini termasuk `initializePreorder`, `initializeLibrary`, `loadTestimonials`, dll.

})();
