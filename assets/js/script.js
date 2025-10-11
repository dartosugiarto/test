/**
 * PlayPal.ID Refactored Application
 *
 * Architecture: Modular, State-driven
 * Features:
 * - Centralized State Management
 * - Component-based UI Rendering
 * - Simple Client-side Router
 * - API Abstraction for Google Sheets
 * - Modern JS (ESM, Async/Await)
 */
(function () {
  'use strict';

  // --- 1. CONFIGURATION ---
  const CONFIG = {
    googleSheetId: '1B0XPR4uSvRzy9LfzWDjNjwAyMZVtJs6_Kk_r2fh7dTw',
    sheets: {
      catalog: 'Sheet3',
      preorderStarlight: 'Sheet1',
      preorderGeneral: 'Sheet2',
      accounts: 'Sheet5',
      library: 'Sheet6',
      testimonials: 'Sheet7',
      carousell: 'Sheet8',
    },
    whatsappNumber: '6285877001999',
    paymentOptions: [
      { id: 'seabank', name: 'Seabank', feeType: 'fixed', value: 0 },
      { id: 'gopay', name: 'Gopay', feeType: 'fixed', value: 0 },
      { id: 'dana', name: 'Dana', feeType: 'fixed', value: 125 },
      { id: 'bank_to_dana', name: 'Bank ke Dana', feeType: 'fixed', value: 500 },
      { id: 'qris', name: 'QRIS', feeType: 'percentage', value: 0.01 },
    ],
  };

  // --- 2. STATE MANAGEMENT ---
  const state = {
    currentPage: null,
    catalog: {
      all: [],
      categories: [],
      activeCategory: null,
      searchQuery: '',
      isLoading: true,
    },
    preorder: {
      data: [],
      searchQuery: '',
      statusFilter: 'all',
      type: 'starlight', // 'starlight' or 'general'
      currentPage: 1,
      itemsPerPage: 15,
      isLoading: true,
    },
    // ... other states for accounts, carousell, etc.
  };

  // --- 3. UTILITIES ---
  const
 
utils = {
    getElement: (selector) => document.querySelector(selector),
    getAllElements: (selector) => document.querySelectorAll(selector),
    formatToIdr: (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value),
    debounce: (func, delay = 250) => {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
      };
    },
    parseCsv: (text) => {
      const rows = text.trim().replace(/\r\n/g, '\n').split('\n');
      return rows.map(row => {
          const result = [];
          let current = '';
          let inQuote = false;
          for (let i = 0; i < row.length; i++) {
              const char = row[i];
              if (char === '"') {
                  if (inQuote && row[i+1] === '"') {
                      current += '"';
                      i++;
                  } else {
                      inQuote = !inQuote;
                  }
              } else if (char === ',' && !inQuote) {
                  result.push(current.trim());
                  current = '';
              } else {
                  current += char;
              }
          }
          result.push(current.trim());
          return result;
      });
    },
  };

  // --- 4. API SERVICE ---
  const api = {
    _getSheetUrl: (sheetName, format = 'csv') => `https://docs.google.com/spreadsheets/d/${CONFIG.googleSheetId}/gviz/tq?tqx=out:${format}&sheet=${encodeURIComponent(sheetName)}`,
    
    _fetchSheet: async (sheetName) => {
      try {
        const response = await fetch(this._getSheetUrl(sheetName));
        if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
        const csvText = await response.text();
        const data = utils.parseCsv(csvText);
        data.shift(); // Remove header row
        return data.filter(row => row.some(cell => cell)); // Filter out empty rows
      } catch (error) {
        console.error(`Failed to fetch sheet "${sheetName}":`, error);
        return null;
      }
    },

    getCatalog: async () => {
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.googleSheetId}/gviz/tq?sheet=${CONFIG.sheets.catalog}&tqx=out:json`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
            const text = await response.text();
            const json = JSON.parse(text.match(/\{.*\}/s)[0]);
            const data = [];
            const cols = json.table.cols;
            json.table.rows.forEach(r => {
                for (let i = 0; i < cols.length; i += 2) {
                    const category = cols[i].label;
                    const titleCell = r.c[i];
                    const priceCell = r.c[i + 1];
                    if (category && titleCell && titleCell.v && priceCell && priceCell.v !== null) {
                        data.push({
                            category: category.trim(),
                            title: String(titleCell.v).trim(),
                            price: Number(priceCell.v),
                        });
                    }
                }
            });
            return data;
        } catch (error) {
            console.error('Failed to fetch catalog:', error);
            return null;
        }
    },
    
    getPreorderData: (type) => {
      const sheetName = type === 'starlight' ? CONFIG.sheets.preorderStarlight : CONFIG.sheets.preorderGeneral;
      return this._fetchSheet(sheetName);
    },
  };

  // --- 5. UI COMPONENTS & RENDERING ---
  const ui = {
    mainContent: utils.getElement('#mainContent'),
    
    renderPage: function(pageId, content) {
      this.mainContent.innerHTML = `<div class="container page" id="${pageId}">${content}</div>`;
    },

    renderHomePage: function() {
        const { categories, activeCategory } = state.catalog;
        const categoryOptions = categories.map(cat => 
            `<div class="custom-select__option ${cat === activeCategory ? 'is-selected' : ''}" data-value="${cat}">${cat}</div>`
        ).join('');
        
        const content = `
            <header class="page-header">
                <h1 class="page-header__title">Katalog Produk</h1>
                <p class="page-header__subtitle">Temukan item game favoritmu dengan harga terbaik.</p>
            </header>
            <div class="form-controls">
                <div class="custom-select" id="categorySelect">
                    <button class="input custom-select__button" type="button" aria-haspopup="listbox" aria-expanded="false">
                        <span id="categorySelectValue">${activeCategory || 'Pilih Kategori'}</span>
                        <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
                    </button>
                    <div class="custom-select__options" role="listbox">${categoryOptions}</div>
                </div>
                <div class="input-group">
                    <svg class="input-group__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                    <input id="searchInput" type="search" class="input input--with-icon" placeholder="Cari item..." />
                </div>
            </div>
            <div class="info-bar" id="itemCountInfo"></div>
            <div class="grid grid--2-cols" id="itemListContainer"></div>
        `;
        this.renderPage('homePage', content);
        this.renderCatalogList();
    },
    
    renderCatalogList: function() {
        const container = utils.getElement('#itemListContainer');
        if (!container) return;

        const { all, activeCategory, searchQuery, isLoading } = state.catalog;
        
        if (isLoading) {
            container.innerHTML = Array(8).fill(this._getSkeletonCardHTML()).join('');
            return;
        }

        const filteredItems = all.filter(item => 
            item.category === activeCategory &&
            (item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
             String(item.price).includes(searchQuery))
        );

        utils.getElement('#itemCountInfo').textContent = `${filteredItems.length} item ditemukan.`;

        if (filteredItems.length === 0) {
            container.innerHTML = this._getEmptyStateHTML('Item Tidak Ditemukan', 'Coba kata kunci atau kategori lain.');
            return;
        }

        container.innerHTML = filteredItems.map(item => `
            <button class="card__clickable" data-item='${JSON.stringify(item)}'>
                <span class="card__title">${item.title}</span>
                <span class="card__price">${utils.formatToIdr(item.price)}</span>
            </button>
        `).join('');
    },

    renderPreorderPage: function() {
      // ... logic to render the preorder page similar to home
      this.renderPage('preorderPage', '<h1>Pre-Order Page</h1><p>Content goes here...</p>');
    },

    openModal: function(title, body, footer) {
        const modal = utils.getElement('#paymentModal');
        modal.hidden = false;
        setTimeout(() => modal.classList.add('is-open'), 10);
        
        utils.getElement('#paymentModalTitle').textContent = title;
        utils.getElement('#modalBody').innerHTML = body;
        utils.getElement('#modalCloseBtn').focus();
        document.body.classList.add('overflow-hidden');
    },

    closeModal: function() {
        const modal = utils.getElement('#paymentModal');
        modal.classList.remove('is-open');
        setTimeout(() => {
            modal.hidden = true;
            document.body.classList.remove('overflow-hidden');
        }, 300);
    },

    _getSkeletonCardHTML: () => `
        <div class="card card__clickable skeleton">
            <span class="skeleton--text" style="width: 60%;"></span>
            <span class="skeleton--text" style="width: 25%;"></span>
        </div>`,
        
    _getEmptyStateHTML: (title, message) => `
        <div class="empty-state">
            <svg class="empty-state__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <h3>${title}</h3>
            <p>${message}</p>
        </div>`,
  };

  // --- 6. PAGE LOGIC & CONTROLLERS ---
  const pages = {
    home: {
      init: async function() {
        state.catalog.isLoading = true;
        ui.renderHomePage();
        
        const data = await api.getCatalog();
        if (data) {
            state.catalog.all = data;
            const categories = [...new Set(data.map(item => item.category))];
            state.catalog.categories = categories;
            state.catalog.activeCategory = categories[0] || null;
        }
        state.catalog.isLoading = false;
        ui.renderHomePage(); // Re-render with data
      },
      addListeners: function() {
          const container = utils.getElement('#homePage');
          container.addEventListener('click', this.handleClick);
          container.querySelector('#searchInput').addEventListener('input', this.handleSearch);
      },
      handleClick: (e) => {
          const itemButton = e.target.closest('.card__clickable');
          if (itemButton) {
              const itemData = JSON.parse(itemButton.dataset.item);
              pages.home.showPaymentModal(itemData);
              return;
          }

          const selectBtn = e.target.closest('.custom-select__button');
          if (selectBtn) {
              selectBtn.parentElement.classList.toggle('is-open');
              return;
          }

          const option = e.target.closest('.custom-select__option');
          if (option) {
              state.catalog.activeCategory = option.dataset.value;
              utils.getElement('#categorySelectValue').textContent = option.dataset.value;
              utils.getElement('.custom-select__option.is-selected')?.classList.remove('is-selected');
              option.classList.add('is-selected');
              option.closest('.custom-select').classList.remove('is-open');
              ui.renderCatalogList();
              return;
          }
      },
      handleSearch: utils.debounce((e) => {
          state.catalog.searchQuery = e.target.value;
          ui.renderCatalogList();
      }),
      showPaymentModal: (item) => {
          const optionsHTML = CONFIG.paymentOptions.map((opt, index) => {
              const fee = opt.feeType === 'fixed' ? opt.value : Math.ceil(item.price * opt.value);
              return `
                  <div class="payment-option">
                      <input type="radio" id="${opt.id}" name="payment" value="${opt.id}" data-price="${item.price}" ${index === 0 ? 'checked' : ''}>
                      <label for="${opt.id}">
                          <span>${opt.name}</span>
                          <span class="payment-option__fee">+ ${utils.formatToIdr(fee)}</span>
                      </label>
                  </div>`;
          }).join('');

          const body = `
              <div class="payment-recap">
                  <div class="payment-recap__item">
                      <span class="payment-recap__label">Item:</span>
                      <span class="payment-recap__value">${item.title}</span>
                  </div>
                  <div class="payment-recap__item">
                      <span class="payment-recap__label">Harga:</span>
                      <span class="payment-recap__value" id="modalBasePrice">${utils.formatToIdr(item.price)}</span>
                  </div>
              </div>
              <div class="payment-options__group">${optionsHTML}</div>
              <div class="payment-total" id="paymentTotalContainer"></div>
          `;
          ui.openModal('Pilih Pembayaran', body);
          pages.home.updatePaymentTotal();
      },
      updatePaymentTotal: () => {
          const selectedOptionEl = utils.getElement('input[name="payment"]:checked');
          if (!selectedOptionEl) return;
          
          const optionId = selectedOptionEl.value;
          const basePrice = Number(selectedOptionEl.dataset.price);
          const optionConfig = CONFIG.paymentOptions.find(o => o.id === optionId);

          const fee = optionConfig.feeType === 'fixed' ? optionConfig.value : Math.ceil(basePrice * optionConfig.value);
          const total = basePrice + fee;

          const totalHTML = `
              <div class="payment-total__row">
                  <span class="payment-total__label">Fee:</span>
                  <span class="payment-total__value">${utils.formatToIdr(fee)}</span>
              </div>
              <div class="payment-total__row payment-total__row--grand">
                  <span class="payment-total__label">Total:</span>
                  <span class="payment-total__value">${utils.formatToIdr(total)}</span>
              </div>
          `;
          utils.getElement('#paymentTotalContainer').innerHTML = totalHTML;
          // Update WA button link
      }
    },
    preorder: {
      init: function() {
        ui.renderPreorderPage();
      },
      addListeners: function() {}
    },
    // ... other page controllers
  };

  // --- 7. ROUTER ---
  const router = {
    routes: {
      '/': pages.home,
      '/preorder': pages.preorder,
      '/akun-game': { init: () => ui.renderPage('akunPage', '<h1>Akun Game</h1>') },
      '/perpustakaan': { init: () => ui.renderPage('perpustakaanPage', '<h1>Perpustakaan</h1>') },
      '/carousell': { init: () => ui.renderPage('carousellPage', '<h1>Carousell</h1>') },
    },
    
    navigate: async function(path, fromPopState = false) {
      const page = this.routes[path] || this.routes['/'];
      state.currentPage = page;

      if (!fromPopState) {
          history.pushState({ path }, '', path);
      }
      
      document.title = `PlayPal.ID - ${path.substring(1).replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Home'}`;
      utils.getAllElements('.sidebar__link.is-active').forEach(l => l.classList.remove('is-active'));
      utils.getElement(`.sidebar__link[href="${path}"]`)?.classList.add('is-active');

      if (page.init) await page.init();
      if (page.addListeners) page.addListeners();
      
      if (app.isSidebarOpen()) app.toggleSidebar(false);
      window.scrollTo(0, 0);
    },

    init: function() {
      window.addEventListener('popstate', e => {
        const path = e.state ? e.state.path : '/';
        this.navigate(path, true);
      });
      document.body.addEventListener('click', e => {
        const navLink = e.target.closest('[data-nav-link]');
        if (navLink) {
          e.preventDefault();
          this.navigate(navLink.getAttribute('href'));
        }
      });
      this.navigate(window.location.pathname);
    }
  };

  // --- 8. MAIN APPLICATION ---
  const app = {
    init: function() {
      this.setupHeader();
      this.setupSidebar();
      this.setupModal();
      router.init();
    },
    setupHeader: function() {
      const indicator = utils.getElement('#headerStatusIndicator');
      const updateStatus = () => {
        const hour = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false });
        if (parseInt(hour, 10) >= 8) {
            indicator.textContent = 'Buka';
            indicator.className = 'header__status is-open';
        } else {
            indicator.textContent = 'Tutup';
            indicator.className = 'header__status is-closed';
        }
      };
      updateStatus();
      setInterval(updateStatus, 60000);
    },
    setupSidebar: function() {
      const toggleBtn = utils.getElement('#menuToggleBtn');
      const sidebar = utils.getElement('#sidebar');
      const overlay = utils.getElement('#sidebarOverlay');
      
      toggleBtn.addEventListener('click', () => this.toggleSidebar());
      overlay.addEventListener('click', () => this.toggleSidebar(false));
    },
    toggleSidebar: function(forceOpen) {
        const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !this.isSidebarOpen();
        utils.getElement('#sidebar').classList.toggle('is-open', isOpen);
        utils.getElement('#sidebarOverlay').classList.toggle('is-visible', isOpen);
        utils.getElement('#menuToggleBtn').setAttribute('aria-expanded', isOpen);
        document.body.classList.toggle('overflow-hidden', isOpen);
    },
    isSidebarOpen: () => utils.getElement('#sidebar').classList.contains('is-open'),
    setupModal: function() {
        const modal = utils.getElement('#paymentModal');
        modal.addEventListener('click', e => {
            if (e.target.id === 'modalOverlay' || e.target.closest('.modal__close')) {
                ui.closeModal();
            }
            if (e.target.name === 'payment') {
                pages.home.updatePaymentTotal();
            }
        });
    }
  };

  // --- INITIALIZE ON DOM CONTENT LOADED ---
  document.addEventListener('DOMContentLoaded', () => app.init());

})();
