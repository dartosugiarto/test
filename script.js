/**
 * @file script.js
 * @description Main script for the PlayPal.ID single-page application.
 * @version 5.0.0 (Performance & Security Enhanced)
 * @author PlayPal.ID Development Team
 * @license MIT
 */

(function () {
  'use strict';

  // Configuration with environment-specific settings
  const config = {
    sheetId: '1B0XPR4uSvRzy9LfzWDjNjwAyMZVtJs6_Kk_r2fh7dTw',
    sheets: {
      katalog: { name: 'Sheet3' },
      preorder: { name1: 'Sheet1', name2: 'Sheet2' },
      accounts: { name: 'Sheet5' },
      library: { name: 'Sheet6' }
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
    // Performance settings
    debounceDelay: 300,
    skeletonCount: 6,
    pagination: {
      perPage: 15,
      maxPages: 100
    },
    // Error messages
    messages: {
      networkError: 'Koneksi bermasalah. Periksa internet Anda dan coba lagi.',
      dataEmpty: 'Data kosong atau format tidak sesuai.',
      genericError: 'Terjadi kesalahan. Silakan coba lagi nanti.',
      loadingData: 'Memuat data...',
      noResults: 'Tidak ada hasil ditemukan.'
    }
  };

  // Global state management
  const state = {
    currentMode: 'home',
    controllers: new Map(), // For AbortController instances
    home: { 
      activeCategory: '', 
      searchQuery: '',
      isLoading: false,
      lastFetch: 0
    },
    preorder: {
      initialized: false,
      allData: [],
      currentPage: 1,
      perPage: config.pagination.perPage,
      displayMode: 'detailed',
      isLoading: false
    },
    accounts: {
      initialized: false,
      data: [],
      currentIndex: 0,
      currentAccount: null,
      isLoading: false
    },
    library: {
      initialized: false,
      data: [],
      isLoading: false
    }
  };

  // Global variables
  let allCatalogData = [];
  let currentSelectedItem = null;
  let modalFocusTrap = { 
    listener: null, 
    focusableEls: [], 
    firstEl: null, 
    lastEl: null 
  };
  let elementToFocusOnModalClose = null;

  /**
   * Utility function to safely get DOM element
   * @param {string} id - Element ID
   * @returns {Element|null}
   */
  function getElement(id) {
    try {
      return document.getElementById(id);
    } catch (error) {
      console.warn(`Element with ID '${id}' not found:`, error);
      return null;
    }
  }

  /**
   * Utility function to create element safely
   * @param {string} tagName - HTML tag name
   * @param {Object} options - Element options
   * @returns {Element}
   */
  function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    
    if (options.className) element.className = options.className;
    if (options.textContent) element.textContent = options.textContent;
    if (options.innerHTML) element.innerHTML = options.innerHTML;
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        element.dataset[key] = value;
      });
    }
    
    return element;
  }

  /**
   * Debounce function to limit API calls
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function}
   */
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Enhanced error handling with user-friendly messages
   * @param {Error} error - Error object
   * @param {string} context - Context where error occurred
   * @returns {string} User-friendly error message
   */
  function handleError(error, context = 'Operation') {
    console.error(`${context} failed:`, error);
    
    if (error.name === 'AbortError') {
      return null; // Don't show message for cancelled requests
    }
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return config.messages.networkError;
    }
    
    if (error.message.includes('Network error')) {
      return config.messages.networkError;
    }
    
    return config.messages.genericError;
  }

  // Cache DOM elements for better performance
  const elements = {
    sidebar: {
      nav: getElement('sidebarNav'),
      overlay: getElement('sidebarOverlay'),
      burger: getElement('burgerBtn'),
      links: null // Will be populated on init
    },
    themeToggle: getElement('themeToggleBtn'),
    views: {
      home: getElement('viewHome'),
      preorder: getElement('viewPreorder'),
      accounts: getElement('viewAccounts'),
      perpustakaan: getElement('viewPerpustakaan'),
      film: getElement('viewFilm')
    },
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
    templates: {
      item: getElement('itemTemplate'),
      skeletonItem: getElement('skeletonItemTemplate'),
      skeletonCard: getElement('skeletonCardTemplate')
    },
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
    library: {
      container: getElement('libraryGridContainer'),
      error: getElement('libraryError')
    }
  };

  /**
   * Enhanced fetch with abort controller management
   * @param {string} url - URL to fetch
   * @param {string} controllerId - Unique ID for abort controller
   * @param {Object} options - Fetch options
   * @returns {Promise}
   */
  async function safeFetch(url, controllerId, options = {}) {
    // Abort previous request if exists
    if (state.controllers.has(controllerId)) {
      state.controllers.get(controllerId).abort();
    }

    const controller = new AbortController();
    state.controllers.set(controllerId, controller);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } finally {
      state.controllers.delete(controllerId);
    }
  }

  /**
   * Main application entry point with enhanced error handling
   */
  function initializeApp() {
    try {
      // Cache sidebar links
      elements.sidebar.links = document.querySelectorAll('.sidebar-nav .nav-item');
      
      // Initialize event listeners with error handling
      initializeEventListeners();
      initializeKeyboardNavigation();
      initializeTheme();
      
      // Load initial data
      loadCatalog();
      
      // Set initial mode
      state.currentMode = 'home';
      
      console.info('PlayPal.ID application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      showGlobalError('Gagal memuat aplikasi. Silakan refresh halaman.');
    }
  }

  /**
   * Initialize all event listeners with error boundaries
   */
  function initializeEventListeners() {
    // Theme toggle
    elements.themeToggle?.addEventListener('click', handleThemeToggle);
    
    // Sidebar controls
    elements.sidebar.burger?.addEventListener('click', () => toggleSidebar());
    elements.sidebar.overlay?.addEventListener('click', () => toggleSidebar(false));
    
    // Navigation links
    if (elements.sidebar.links) {
      elements.sidebar.links.forEach(link => {
        link.addEventListener('click', e => handleNavigation(e, link));
      });
    }

    // Custom select toggles
    const selectElements = [
      elements.home.customSelect,
      elements.preorder.customSelect,
      elements.preorder.customStatusSelect,
      elements.accounts.customSelect
    ].filter(el => el?.btn);

    selectElements.forEach(select => {
      select.btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCustomSelect(select.wrapper);
      });
    });
    
    // Search input with debouncing
    const debouncedSearch = debounce((query) => {
      state.home.searchQuery = query.trim();
      renderHomeList();
    }, config.debounceDelay);

    elements.home.searchInput?.addEventListener('input', e => {
      debouncedSearch(e.target.value);
    });
    
    // Payment modal
    elements.paymentModal.closeBtn?.addEventListener('click', closePaymentModal);
    elements.paymentModal.modal?.addEventListener('click', e => {
      if (e.target === elements.paymentModal.modal) closePaymentModal();
    });

    // Global click handler for custom selects
    document.addEventListener('click', handleGlobalClick);
    
    // Global keyboard handler
    document.addEventListener('keydown', handleGlobalKeydown);
  }

  /**
   * Handle navigation with error boundaries
   */
  function handleNavigation(e, link) {
    try {
      if (link.dataset.mode) {
        e.preventDefault();
        setMode(link.dataset.mode);
      }
    } catch (error) {
      console.error('Navigation failed:', error);
    }
  }

  /**
   * Handle theme toggle with validation
   */
  function handleThemeToggle() {
    try {
      toggleTheme();
    } catch (error) {
      console.error('Theme toggle failed:', error);
    }
  }

  /**
   * Global click handler for custom selects
   */
  function handleGlobalClick() {
    const selectWrappers = [
      elements.home.customSelect.wrapper,
      elements.preorder.customSelect.wrapper,
      elements.preorder.customStatusSelect.wrapper,
      elements.accounts.customSelect.wrapper
    ].filter(Boolean);

    selectWrappers.forEach(wrapper => {
      toggleCustomSelect(wrapper, false);
    });
  }

  /**
   * Global keyboard handler for accessibility
   */
  function handleGlobalKeydown(e) {
    // Escape key closes modals and selects
    if (e.key === 'Escape') {
      if (elements.paymentModal.modal.style.display === 'flex') {
        closePaymentModal();
      }
      
      const openSelects = document.querySelectorAll('.custom-select-wrapper.open');
      openSelects.forEach(select => toggleCustomSelect(select, false));
    }
  }

  /**
   * Initialize keyboard navigation for custom selects
   */
  function initializeKeyboardNavigation() {
    const selectWrappers = [
      elements.home.customSelect.wrapper,
      elements.preorder.customSelect.wrapper,
      elements.preorder.customStatusSelect.wrapper,
      elements.accounts.customSelect.wrapper
    ].filter(Boolean);

    selectWrappers.forEach(wrapper => setupKeyboardNavForSelect(wrapper));
  }

  /**
   * Enhanced keyboard navigation for select elements
   */
  function setupKeyboardNavForSelect(wrapper) {
    if (!wrapper) return;
    
    const btn = wrapper.querySelector('.custom-select-btn');
    const optionsEl = wrapper.querySelector('.custom-select-options');
    let focusIndex = -1;

    if (!btn || !optionsEl) return;

    wrapper.addEventListener('keydown', e => {
      try {
        const options = Array.from(optionsEl.querySelectorAll('.custom-select-option'));
        if (options.length === 0) return;

        const isOpen = wrapper.classList.contains('open');
        
        switch (e.key) {
          case 'Escape':
            if (isOpen) {
              e.preventDefault();
              toggleCustomSelect(wrapper, false);
              btn.focus();
            }
            break;
            
          case 'Enter':
          case ' ':
            if (document.activeElement === btn) {
              e.preventDefault();
              toggleCustomSelect(wrapper, true);
              focusIndex = options.findIndex(opt => opt.classList.contains('selected'));
              if (focusIndex === -1) focusIndex = 0;
              options[focusIndex]?.focus();
            } else if (isOpen && document.activeElement.classList.contains('custom-select-option')) {
              e.preventDefault();
              document.activeElement.click();
              btn.focus();
            }
            break;
            
          case 'ArrowDown':
            if (isOpen) {
              e.preventDefault();
              focusIndex = Math.min(focusIndex + 1, options.length - 1);
              options[focusIndex]?.focus();
            }
            break;
            
          case 'ArrowUp':
            if (isOpen) {
              e.preventDefault();
              focusIndex = Math.max(focusIndex - 1, 0);
              options[focusIndex]?.focus();
            }
            break;
        }
      } catch (error) {
        console.error('Keyboard navigation error:', error);
      }
    });
  }

  /**
   * Show global error message
   */
  function showGlobalError(message) {
    // Create or update global error element
    let errorEl = document.querySelector('.global-error');
    if (!errorEl) {
      errorEl = createElement('div', {
        className: 'global-error',
        attributes: { 
          role: 'alert',
          'aria-live': 'assertive'
        }
      });
      document.body.appendChild(errorEl);
    }
    
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5000);
  }

  // Utility functions with enhanced error handling
  function formatToIdr(value) {
    try {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
      }).format(value);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return `Rp ${value.toLocaleString('id-ID')}`;
    }
  }

  function getSheetUrl(sheetName, format = 'json') {
    try {
      const baseUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`;
      const encodedSheetName = encodeURIComponent(sheetName);
      return format === 'csv'
        ? `${baseUrl}?tqx=out:csv&sheet=${encodedSheetName}`
        : `${baseUrl}?sheet=${encodedSheetName}&tqx=out:json`;
    } catch (error) {
      console.error('Sheet URL generation error:', error);
      throw new Error('Failed to generate sheet URL');
    }
  }

  function showSkeleton(container, template, count = config.skeletonCount) {
    if (!container || !template) return;
    
    try {
      container.innerHTML = '';
      const fragment = document.createDocumentFragment();
      
      for (let i = 0; i < count; i++) {
        const clone = template.content.cloneNode(true);
        fragment.appendChild(clone);
      }
      
      container.appendChild(fragment);
    } catch (error) {
      console.error('Skeleton rendering error:', error);
    }
  }

  // Theme functions with validation
  function applyTheme(theme) {
    try {
      document.body.classList.toggle('dark-mode', theme === 'dark');
      
      // Update theme-color meta tag
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.content = theme === 'dark' ? '#1a1a1a' : '#ffffff';
      }
    } catch (error) {
      console.error('Theme application error:', error);
    }
  }

  function initTheme() {
    try {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
      applyTheme(currentTheme);
    } catch (error) {
      console.error('Theme initialization error:', error);
      applyTheme('light'); // Fallback to light theme
    }
  }

  function toggleTheme() {
    try {
      const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      applyTheme(newTheme);
    } catch (error) {
      console.error('Theme toggle error:', error);
    }
  }

  function toggleSidebar(forceOpen) {
    try {
      const isOpen = typeof forceOpen === 'boolean' 
        ? forceOpen 
        : !document.body.classList.contains('sidebar-open');
      
      document.body.classList.toggle('sidebar-open', isOpen);
      elements.sidebar.burger?.classList.toggle('active', isOpen);
      
      // Update ARIA attributes
      if (elements.sidebar.burger) {
        elements.sidebar.burger.setAttribute('aria-expanded', isOpen);
      }
    } catch (error) {
      console.error('Sidebar toggle error:', error);
    }
  }

  /**
   * Enhanced mode switching with loading states
   */
  function setMode(nextMode) {
    try {
      if (nextMode === 'donasi') {
        window.open('https://saweria.co/playpal', '_blank', 'noopener,noreferrer');
        return;
      }

      const viewMap = {
        home: elements.views.home,
        preorder: elements.views.preorder,
        accounts: elements.views.accounts,
        perpustakaan: elements.views.perpustakaan,
        film: elements.views.film,
      };

      const nextView = viewMap[nextMode];
      if (!nextView) {
        console.warn(`Unknown mode: ${nextMode}`);
        return;
      }

      // Update active view
      document.querySelector('.view-section.active')?.classList.remove('active');
      nextView.classList.add('active');

      // Update active navigation
      if (elements.sidebar.links) {
        elements.sidebar.links.forEach(link => {
          const isActive = link.dataset.mode === nextMode;
          link.classList.toggle('active', isActive);
          link.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
      }

      // Close sidebar on mobile
      if (window.innerWidth < 769) {
        toggleSidebar(false);
      }

      // Smooth scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Initialize mode-specific data
      state.currentMode = nextMode;
      
      switch (nextMode) {
        case 'preorder':
          if (!state.preorder.initialized) initializePreorder();
          break;
        case 'accounts':
          if (!state.accounts.initialized) initializeAccounts();
          break;
        case 'perpustakaan':
          if (!state.library.initialized) initializeLibrary();
          break;
      }
    } catch (error) {
      console.error('Mode switching error:', error);
      showGlobalError('Gagal mengubah halaman. Silakan coba lagi.');
    }
  }

  /**
   * Enhanced CSV parsing with better error handling
   */
  function robustCsvParser(text) {
    try {
      const normalizedText = text.trim().replace(/\r\n/g, '\n');
      const rows = [];
      let currentRow = [];
      let currentField = '';
      let inQuotedField = false;
      
      for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText[i];
        
        if (inQuotedField) {
          if (char === '"') {
            if (i + 1 < normalizedText.length && normalizedText[i + 1] === '"') {
              currentField += '"';
              i++; // Skip next quote
            } else {
              inQuotedField = false;
            }
          } else {
            currentField += char;
          }
        } else {
          if (char === '"') {
            inQuotedField = true;
          } else if (char === ',') {
            currentRow.push(currentField.trim());
            currentField = '';
          } else if (char === '\n') {
            currentRow.push(currentField.trim());
            if (currentRow.some(field => field !== '')) {
              rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
          } else {
            currentField += char;
          }
        }
      }
      
      // Add last field and row
      if (currentField !== '' || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field !== '')) {
          rows.push(currentRow);
        }
      }
      
      return rows.filter(row => row.length > 0);
    } catch (error) {
      console.error('CSV parsing error:', error);
      throw new Error('Failed to parse CSV data');
    }
  }

  /**
   * Enhanced GViz parsing with validation
   */
  function parseGvizPairs(jsonText) {
    try {
      const match = jsonText.match(/\{.*\}/s);
      if (!match) {
        throw new Error('Invalid GViz response format');
      }

      const obj = JSON.parse(match[0]);
      const { rows = [], cols = [] } = obj.table || {};

      if (!rows.length || !cols.length) {
        return [];
      }

      const pairs = Array.from({ length: Math.floor(cols.length / 2) }, (_, i) => ({
        iTitle: i * 2,
        iPrice: i * 2 + 1,
        label: cols[i * 2]?.label || '',
      })).filter(p => p.label && cols[p.iPrice]);

      const out = [];
      for (const r of rows) {
        const c = r.c || [];
        for (const p of pairs) {
          const title = String(c[p.iTitle]?.v || '').trim();
          const priceRaw = c[p.iPrice]?.v;
          const price = priceRaw != null && priceRaw !== '' ? Number(priceRaw) : NaN;
          
          if (title && !isNaN(price) && price > 0) {
            out.push({
              catKey: p.label,
              catLabel: String(p.label || '').trim().replace(/\s+/g, ' '),
              title,
              price,
            });
          }
        }
      }
      
      return out;
    } catch (error) {
      console.error('GViz parsing error:', error);
      throw new Error('Failed to parse GViz data');
    }
  }

  function toggleCustomSelect(wrapper, forceOpen) {
    if (!wrapper) return;
    
    try {
      const btn = wrapper.querySelector('.custom-select-btn');
      const isOpen = typeof forceOpen === 'boolean' 
        ? forceOpen 
        : !wrapper.classList.contains('open');
      
      wrapper.classList.toggle('open', isOpen);
      if (btn) {
        btn.setAttribute('aria-expanded', isOpen);
      }
    } catch (error) {
      console.error('Custom select toggle error:', error);
    }
  }

  /**
   * Enhanced category select builder with validation
   */
  function buildHomeCategorySelect(catalogData) {
    try {
      const { options, value } = elements.home.customSelect;
      if (!options || !value) return;

      const categoryMap = new Map();
      catalogData.forEach(item => {
        if (item.catKey && !categoryMap.has(item.catKey)) {
          categoryMap.set(item.catKey, item.catLabel);
        }
      });

      const categories = [...categoryMap].map(([key, label]) => ({ key, label }));
      
      options.innerHTML = '';
      
      if (categories.length === 0) {
        value.textContent = 'Tidak ada kategori';
        return;
      }

      categories.forEach((cat, index) => {
        const el = createElement('div', {
          className: `custom-select-option ${index === 0 ? 'selected' : ''}`,
          textContent: cat.label,
          attributes: {
            'role': 'option',
            'tabindex': '-1',
            'aria-selected': index === 0 ? 'true' : 'false'
          },
          dataset: { value: cat.key }
        });

        el.addEventListener('click', () => {
          try {
            state.home.activeCategory = cat.key;
            value.textContent = cat.label;
            
            // Update selection
            options.querySelectorAll('.custom-select-option').forEach(opt => {
              opt.classList.remove('selected');
              opt.setAttribute('aria-selected', 'false');
            });
            el.classList.add('selected');
            el.setAttribute('aria-selected', 'true');
            
            toggleCustomSelect(elements.home.customSelect.wrapper, false);
            renderHomeList();
          } catch (error) {
            console.error('Category selection error:', error);
          }
        });

        options.appendChild(el);
      });

      // Set initial selection
      if (categories.length > 0) {
        state.home.activeCategory = categories[0].key;
        value.textContent = categories[0].label;
      }
    } catch (error) {
      console.error('Category select building error:', error);
      if (elements.home.customSelect.value) {
        elements.home.customSelect.value.textContent = 'Error loading categories';
      }
    }
  }

  /**
   * Enhanced list rendering with better error handling
   */
  function renderList(container, countInfoEl, items, emptyText) {
    if (!container) return;
    
    try {
      container.innerHTML = '';
      
      if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = `
          <div class="empty" role="status">
            <div class="empty-content">
              <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p>${emptyText}</p>
            </div>
          </div>
        `;
        if (countInfoEl) countInfoEl.textContent = '';
        return;
      }

      const fragment = document.createDocumentFragment();
      
      for (const item of items) {
        if (!elements.templates.item) continue;
        
        const clone = elements.templates.item.content.cloneNode(true);
        const buttonEl = clone.querySelector('.list-item');
        
        if (buttonEl) {
          const titleEl = buttonEl.querySelector('.title');
          const priceEl = buttonEl.querySelector('.price');
          
          if (titleEl) titleEl.textContent = item.title || 'Tanpa judul';
          if (priceEl) priceEl.textContent = formatToIdr(item.price || 0);
          
          buttonEl.setAttribute('aria-label', `${item.title} - ${formatToIdr(item.price)}`);
          buttonEl.addEventListener('click', () => {
            try {
              openPaymentModal(item);
            } catch (error) {
              console.error('Payment modal error:', error);
              showGlobalError('Gagal membuka dialog pembayaran.');
            }
          });
          
          fragment.appendChild(clone);
        }
      }
      
      container.appendChild(fragment);
      
      if (countInfoEl) {
        countInfoEl.textContent = `${items.length} item ditemukan`;
      }
    } catch (error) {
      console.error('List rendering error:', error);
      if (container) {
        container.innerHTML = `<div class="error" role="alert">${config.messages.genericError}</div>`;
      }
    }
  }

  function renderHomeList() {
    try {
      if (state.home.isLoading) return;
      
      const { activeCategory, searchQuery } = state.home;
      const query = searchQuery.toLowerCase();
      
      const items = allCatalogData.filter(item => {
        const matchesCategory = item.catKey === activeCategory;
        const matchesSearch = query === '' || 
          item.title.toLowerCase().includes(query) || 
          String(item.price).includes(query);
        
        return matchesCategory && matchesSearch;
      });

      renderList(
        elements.home.listContainer, 
        elements.home.countInfo, 
        items, 
        'Tidak ada item ditemukan.'
      );
    } catch (error) {
      console.error('Home list rendering error:', error);
      if (elements.home.errorContainer) {
        elements.home.errorContainer.textContent = config.messages.genericError;
        elements.home.errorContainer.style.display = 'block';
      }
    }
  }

  /**
   * Enhanced catalog loading with caching and retry logic
   */
  async function loadCatalog() {
    if (state.home.isLoading) return;
    
    state.home.isLoading = true;
    
    try {
      if (elements.home.errorContainer) {
        elements.home.errorContainer.style.display = 'none';
      }
      
      if (elements.home.listContainer && elements.templates.skeletonItem) {
        showSkeleton(elements.home.listContainer, elements.templates.skeletonItem, 6);
      }

      const response = await safeFetch(
        getSheetUrl(config.sheets.katalog.name),
        'catalog'
      );
      
      const text = await response.text();
      allCatalogData = parseGvizPairs(text);
      
      if (allCatalogData.length === 0) {
        throw new Error(config.messages.dataEmpty);
      }

      buildHomeCategorySelect(allCatalogData);
      renderHomeList();
      
      state.home.lastFetch = Date.now();
      
    } catch (error) {
      const errorMessage = handleError(error, 'Catalog loading');
      if (errorMessage) {
        console.error('Catalog loading failed:', error);
        
        if (elements.home.listContainer) {
          elements.home.listContainer.innerHTML = '';
        }
        
        if (elements.home.errorContainer) {
          elements.home.errorContainer.textContent = errorMessage;
          elements.home.errorContainer.style.display = 'block';
        }
      }
    } finally {
      state.home.isLoading = false;
    }
  }

  // Payment modal functions with enhanced validation
  function calculateFee(price, option) {
    try {
      if (!price || !option) return 0;
      
      if (option.feeType === 'fixed') {
        return option.value || 0;
      }
      
      if (option.feeType === 'percentage') {
        return Math.ceil(price * (option.value || 0));
      }
      
      return 0;
    } catch (error) {
      console.error('Fee calculation error:', error);
      return 0;
    }
  }

  function updatePriceDetails() {
    try {
      const selectedInput = document.querySelector('input[name="payment"]:checked');
      if (!selectedInput || !currentSelectedItem) return;

      const selectedOption = config.paymentOptions.find(opt => opt.id === selectedInput.value);
      if (!selectedOption) return;

      const price = currentSelectedItem.price || 0;
      const fee = calculateFee(price, selectedOption);
      const total = price + fee;

      if (elements.paymentModal.fee) {
        elements.paymentModal.fee.textContent = formatToIdr(fee);
      }
      
      if (elements.paymentModal.total) {
        elements.paymentModal.total.textContent = formatToIdr(total);
      }

      updateWaLink(selectedOption, fee, total);
    } catch (error) {
      console.error('Price details update error:', error);
    }
  }

  function updateWaLink(option, fee, total) {
    try {
      if (!currentSelectedItem || !option || !elements.paymentModal.waBtn) return;

      const { catLabel = "Produk", title, price } = currentSelectedItem;
      
      const text = [
        config.waGreeting,
        `› Tipe: ${catLabel}`,
        `› Item: ${title}`,
        `› Pembayaran: ${option.name}`,
        `› Harga: ${formatToIdr(price)}`,
        `› Fee: ${formatToIdr(fee)}`,
        `› Total: ${formatToIdr(total)}`,
      ].join('\n');

      const waUrl = `https://wa.me/${config.waNumber}?text=${encodeURIComponent(text)}`;
      elements.paymentModal.waBtn.href = waUrl;
    } catch (error) {
      console.error('WhatsApp link update error:', error);
    }
  }

  /**
   * Enhanced payment modal with better accessibility
   */
  function openPaymentModal(item) {
    try {
      if (!item || !elements.paymentModal.modal) return;

      elementToFocusOnModalClose = document.activeElement;
      currentSelectedItem = item;

      const { modal, itemName, itemPrice, optionsContainer } = elements.paymentModal;

      // Update modal content
      if (itemName) itemName.textContent = item.title || 'Tanpa judul';
      if (itemPrice) itemPrice.textContent = formatToIdr(item.price || 0);

      // Build payment options
      if (optionsContainer) {
        optionsContainer.innerHTML = '';
        
        config.paymentOptions.forEach((option, index) => {
          const fee = calculateFee(item.price, option);
          const optionEl = createElement('div', {
            className: 'payment-option',
            innerHTML: `
              <input type="radio" id="${option.id}" name="payment" value="${option.id}" ${index === 0 ? 'checked' : ''}>
              <label for="${option.id}">
                ${option.name}
                <span style="float: right;">+ ${formatToIdr(fee)}</span>
              </label>
            `
          });
          
          const input = optionEl.querySelector('input');
          if (input) {
            input.addEventListener('change', updatePriceDetails);
          }
          
          optionsContainer.appendChild(optionEl);
        });
      }

      updatePriceDetails();

      // Show modal with animation
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => modal.classList.add('visible'), 10);

      // Setup focus trap
      setupModalFocusTrap(modal);

    } catch (error) {
      console.error('Payment modal opening error:', error);
      showGlobalError('Gagal membuka dialog pembayaran.');
    }
  }

  /**
   * Setup focus trap for modal
   */
  function setupModalFocusTrap(modal) {
    try {
      const focusableSelector = 'a[href]:not([disabled]), button:not([disabled]), input[type="radio"]:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusableEls = modal.querySelectorAll(focusableSelector);
      
      modalFocusTrap.focusableEls = Array.from(focusableEls);
      modalFocusTrap.firstEl = modalFocusTrap.focusableEls[0];
      modalFocusTrap.lastEl = modalFocusTrap.focusableEls[modalFocusTrap.focusableEls.length - 1];

      modalFocusTrap.listener = function(e) {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === modalFocusTrap.firstEl) {
            modalFocusTrap.lastEl?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === modalFocusTrap.lastEl) {
            modalFocusTrap.firstEl?.focus();
            e.preventDefault();
          }
        }
      };

      modal.addEventListener('keydown', modalFocusTrap.listener);
      
      // Focus first element
      setTimeout(() => modalFocusTrap.firstEl?.focus(), 100);
    } catch (error) {
      console.error('Focus trap setup error:', error);
    }
  }

  function closePaymentModal() {
    try {
      const { modal } = elements.paymentModal;
      if (!modal) return;

      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');

      if (modalFocusTrap.listener) {
        modal.removeEventListener('keydown', modalFocusTrap.listener);
        modalFocusTrap.listener = null;
      }

      setTimeout(() => {
        modal.style.display = 'none';
        currentSelectedItem = null;
        
        if (elementToFocusOnModalClose) {
          elementToFocusOnModalClose.focus();
          elementToFocusOnModalClose = null;
        }
      }, 200);
    } catch (error) {
      console.error('Modal closing error:', error);
    }
  }

  // Pre-order functions (enhanced versions of existing functions)
  function normalizeStatus(rawStatus) {
    try {
      const s = String(rawStatus || '').trim().toLowerCase();
      
      if (['success', 'selesai', 'berhasil', 'done', 'completed'].includes(s)) {
        return 'success';
      }
      if (['progress', 'proses', 'diproses', 'processing', 'ongoing'].includes(s)) {
        return 'progress';
      }
      if (['failed', 'gagal', 'dibatalkan', 'cancel', 'cancelled', 'error'].includes(s)) {
        return 'failed';
      }
      
      return 'pending';
    } catch (error) {
      console.error('Status normalization error:', error);
      return 'pending';
    }
  }

  function filterPreorderData() {
    try {
      const { searchInput, statusSelect } = elements.preorder;
      if (!searchInput || !statusSelect) return [];

      const query = searchInput.value.trim().toLowerCase();
      const statusFilter = statusSelect.value;
      const currentMode = state.preorder.displayMode;

      return state.preorder.allData.filter(item => {
        if (!Array.isArray(item) || item.length === 0) return false;

        // Filter by status
        const statusIndex = currentMode === 'detailed' ? 6 : 2;
        const status = normalizeStatus(item[statusIndex]);
        
        if (statusFilter !== 'all' && status !== statusFilter) {
          return false;
        }

        // Filter by search query
        if (query === '') return true;

        if (currentMode === 'detailed') {
          const product = (item[3] || '').toLowerCase();
          const nickname = (item[5] || '').toLowerCase();
          const idGift = (item[7] || '').toLowerCase();
          
          return product.includes(query) || 
                 nickname.includes(query) || 
                 idGift.includes(query);
        } else {
          const orderNum = (item[0] || '').toLowerCase();
          const product = (item[1] || '').toLowerCase();
          
          return orderNum.includes(query) || product.includes(query);
        }
      });
    } catch (error) {
      console.error('Preorder filtering error:', error);
      return [];
    }
  }

  function updatePreorderPagination(currentPage, totalPages) {
    try {
      const { prevBtn, nextBtn, pageInfo } = elements.preorder;
      
      if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.setAttribute('aria-disabled', currentPage <= 1);
      }
      
      if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.setAttribute('aria-disabled', currentPage >= totalPages);
      }
      
      if (pageInfo) {
        pageInfo.textContent = totalPages > 0 
          ? `Hal ${currentPage} dari ${totalPages}` 
          : '';
      }
    } catch (error) {
      console.error('Pagination update error:', error);
    }
  }

  function renderPreorderCards() {
    try {
      const filtered = filterPreorderData();
      const totalItems = state.preorder.allData.length;
      const { perPage } = state.preorder;
      const { listContainer, total } = elements.preorder;

      if (!listContainer) return;

      // Update total info
      if (total) {
        const totalText = `${totalItems} total pesanan`;
        const filteredText = filtered.length !== totalItems 
          ? `, ${filtered.length} ditemukan` 
          : '';
        total.textContent = totalText + filteredText;
      }

      // Calculate pagination
      const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
      state.preorder.currentPage = Math.min(
        Math.max(1, state.preorder.currentPage), 
        totalPages
      );

      const start = (state.preorder.currentPage - 1) * perPage;
      const pageData = filtered.slice(start, start + perPage);

      listContainer.innerHTML = '';

      if (pageData.length === 0) {
        listContainer.innerHTML = `
          <div class="empty" role="status">
            <div class="empty-content">
              <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p>${config.messages.noResults}</p>
            </div>
          </div>
        `;
        updatePreorderPagination(0, 0);
        return;
      }

      const fragment = document.createDocumentFragment();

      pageData.forEach(item => {
        try {
          const card = createElement('article', { className: 'card' });
          
          if (state.preorder.displayMode === 'detailed') {
            renderDetailedPreorderCard(card, item);
          } else {
            renderSimplePreorderCard(card, item);
          }
          
          fragment.appendChild(card);
        } catch (error) {
          console.error('Card rendering error:', error);
        }
      });

      listContainer.appendChild(fragment);
      updatePreorderPagination(state.preorder.currentPage, totalPages);
      
    } catch (error) {
      console.error('Preorder cards rendering error:', error);
      if (elements.preorder.listContainer) {
        elements.preorder.listContainer.innerHTML = `
          <div class="error" role="alert">${config.messages.genericError}</div>
        `;
      }
    }
  }

  function renderDetailedPreorderCard(card, item) {
    const [tglOrder, estPengiriman, , product, bulan, name, statusRaw] = item;
    const status = normalizeStatus(statusRaw);
    const estDeliveryText = estPengiriman 
      ? `Estimasi Pengiriman: ${estPengiriman} 20:00 WIB` 
      : '';

    const details = [
      { label: 'TGL ORDER', value: tglOrder },
      { label: 'BULAN', value: bulan }
    ].filter(d => d.value && String(d.value).trim() !== '');

    const detailsHtml = details
      .map(d => `
        <div class="detail-item">
          <div class="detail-label">${d.label}</div>
          <div class="detail-value">${d.value}</div>
        </div>
      `).join('');

    const expandIndicatorHtml = detailsHtml ? `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="expand-indicator" aria-hidden="true">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
      </svg>
    ` : '';

    card.className = `card ${detailsHtml ? 'clickable' : ''}`;
    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-name">${name || 'Tanpa Nama'}</div>
          <div class="card-product">${product || 'N/A'}</div>
        </div>
        <div class="status-badge-wrapper">
          <div class="status-badge ${status}" role="status" aria-label="Status: ${statusRaw || 'Pending'}">
            ${(statusRaw || 'Pending').toUpperCase()}
          </div>
          ${expandIndicatorHtml}
        </div>
      </div>
      ${estDeliveryText ? `<div class="card-date">${estDeliveryText}</div>` : ''}
      ${detailsHtml ? `<div class="card-details"><div class="details-grid">${detailsHtml}</div></div>` : ''}
    `;

    if (detailsHtml) {
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-expanded', 'false');
      
      const toggleCard = () => {
        const isExpanded = card.classList.toggle('expanded');
        card.setAttribute('aria-expanded', isExpanded);
      };
      
      card.addEventListener('click', toggleCard);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCard();
        }
      });
    }
  }

  function renderSimplePreorderCard(card, item) {
    const [orderNum, product, statusRaw] = item;
    const status = normalizeStatus(statusRaw);

    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-name">${orderNum || 'Tanpa Nomor'}</div>
          <div class="card-product">${product || 'N/A'}</div>
        </div>
        <div class="status-badge ${status}" role="status" aria-label="Status: ${statusRaw || 'Pending'}">
          ${(statusRaw || 'Pending').toUpperCase()}
        </div>
      </div>
    `;
  }

  function sortPreorderData(data, mode) {
    try {
      const statusOrder = { progress: 1, pending: 2, success: 3, failed: 4 };
      const statusIndex = mode === 'detailed' ? 6 : 2;

      return [...data].sort((a, b) => {
        const statusA = normalizeStatus(a[statusIndex]);
        const statusB = normalizeStatus(b[statusIndex]);
        
        return statusOrder[statusA] - statusOrder[statusB];
      });
    } catch (error) {
      console.error('Preorder sorting error:', error);
      return data || [];
    }
  }

  /**
   * Enhanced preorder data fetching with retry logic
   */
  async function fetchPreorderData(sheetName) {
    if (state.preorder.isLoading) return;
    
    state.preorder.isLoading = true;

    try {
      const { listContainer, total } = elements.preorder;
      
      if (total) total.textContent = config.messages.loadingData;
      if (listContainer && elements.templates.skeletonCard) {
        showSkeleton(listContainer, elements.templates.skeletonCard, 5);
      }

      state.preorder.displayMode = sheetName === config.sheets.preorder.name1 
        ? 'detailed' 
        : 'simple';

      const response = await safeFetch(
        getSheetUrl(sheetName, 'csv'),
        'preorder'
      );
      
      const text = await response.text();
      let rows = robustCsvParser(text);

      if (rows.length < 2) {
        state.preorder.allData = [];
      } else {
        rows.shift(); // Remove header
        const dataRows = rows.filter(row => 
          row && Array.isArray(row) && (row[0] || '').trim() !== ''
        );
        state.preorder.allData = sortPreorderData(dataRows, state.preorder.displayMode);
      }

    } catch (error) {
      const errorMessage = handleError(error, 'Preorder data fetching');
      if (errorMessage) {
        state.preorder.allData = [];
        if (elements.preorder.total) {
          elements.preorder.total.textContent = errorMessage;
        }
      }
    } finally {
      state.preorder.currentPage = 1;
      renderPreorderCards();
      state.preorder.isLoading = false;
    }
  }

  function initializePreorder() {
    if (state.preorder.initialized) return;

    try {
      const rebound = debounce(() => {
        state.preorder.currentPage = 1;
        renderPreorderCards();
      }, config.debounceDelay);

      const { searchInput, customSelect, prevBtn, nextBtn, customStatusSelect } = elements.preorder;

      // Search input
      if (searchInput) {
        searchInput.addEventListener('input', rebound);
      }

      // Member type selector
      if (customSelect?.options) {
        customSelect.options.querySelectorAll('.custom-select-option').forEach(option => {
          option.addEventListener('click', e => {
            try {
              const selectedValue = e.target.dataset.value;
              const selectedText = e.target.textContent;
              
              if (customSelect.value) {
                customSelect.value.textContent = selectedText;
              }
              
              // Update selection
              customSelect.options.querySelectorAll('.custom-select-option').forEach(opt => {
                opt.classList.remove('selected');
                opt.setAttribute('aria-selected', 'false');
              });
              e.target.classList.add('selected');
              e.target.setAttribute('aria-selected', 'true');

              const sheet = selectedValue === '0' 
                ? config.sheets.preorder.name1 
                : config.sheets.preorder.name2;
              
              fetchPreorderData(sheet);
              toggleCustomSelect(customSelect.wrapper, false);
            } catch (error) {
              console.error('Member type selection error:', error);
            }
          });
        });
      }

      // Status filter
      if (customStatusSelect?.options && elements.preorder.statusSelect) {
        customStatusSelect.options.querySelectorAll('.custom-select-option').forEach(option => {
          option.addEventListener('click', e => {
            try {
              const selectedValue = e.target.dataset.value;
              const selectedText = e.target.textContent;
              
              if (customStatusSelect.value) {
                customStatusSelect.value.textContent = selectedText;
              }
              
              // Update selection
              customStatusSelect.options.querySelectorAll('.custom-select-option').forEach(opt => {
                opt.classList.remove('selected');
                opt.setAttribute('aria-selected', 'false');
              });
              e.target.classList.add('selected');
              e.target.setAttribute('aria-selected', 'true');

              elements.preorder.statusSelect.value = selectedValue;
              toggleCustomSelect(customStatusSelect.wrapper, false);
              rebound();
            } catch (error) {
              console.error('Status selection error:', error);
            }
          });
        });
      }

      // Pagination buttons
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          if (state.preorder.currentPage > 1) {
            state.preorder.currentPage--;
            renderPreorderCards();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          const filtered = filterPreorderData();
          const totalPages = Math.ceil(filtered.length / state.preorder.perPage);
          
          if (state.preorder.currentPage < totalPages) {
            state.preorder.currentPage++;
            renderPreorderCards();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      }

      fetchPreorderData(config.sheets.preorder.name1);
      state.preorder.initialized = true;
      
    } catch (error) {
      console.error('Preorder initialization error:', error);
      showGlobalError('Gagal menginisialisasi halaman pre-order.');
    }
  }

  // Accounts functions (enhanced versions)
  async function parseAccountsSheet(text) {
    try {
      const rows = robustCsvParser(text);
      if (rows.length === 0) return [];
      
      rows.shift(); // Remove header
      
      return rows
        .filter(row => row && row.length >= 5 && row[0])
        .map(row => ({
          title: row[0] || 'Tanpa Judul',
          price: Number(row[1]) || 0,
          status: row[2] || 'Tersedia',
          description: row[3] || 'Tidak ada deskripsi.',
          images: (row[4] || '')
            .split(',')
            .map(url => url.trim())
            .filter(Boolean),
        }))
        .filter(account => account.price > 0); // Filter out invalid prices
    } catch (error) {
      console.error('Accounts sheet parsing error:', error);
      throw new Error('Failed to parse accounts data');
    }
  }

  function populateAccountSelect() {
    try {
      const { customSelect, empty } = elements.accounts;
      if (!customSelect) return;

      const { options, value } = customSelect;
      if (!options || !value) return;

      options.innerHTML = '';

      if (state.accounts.data.length === 0) {
        value.textContent = 'Tidak ada akun';
        if (empty) empty.style.display = 'block';
        return;
      }

      value.textContent = 'Pilih Akun';

      state.accounts.data.forEach((acc, index) => {
        const el = createElement('div', {
          className: 'custom-select-option',
          textContent: acc.title,
          attributes: {
            'role': 'option',
            'tabindex': '-1',
            'aria-selected': 'false'
          },
          dataset: { value: index }
        });

        el.addEventListener('click', () => {
          try {
            value.textContent = acc.title;
            
            // Update selection
            options.querySelectorAll('.custom-select-option').forEach(opt => {
              opt.classList.remove('selected');
              opt.setAttribute('aria-selected', 'false');
            });
            el.classList.add('selected');
            el.setAttribute('aria-selected', 'true');

            toggleCustomSelect(customSelect.wrapper, false);
            renderAccount(index);
          } catch (error) {
            console.error('Account selection error:', error);
          }
        });

        options.appendChild(el);
      });
    } catch (error) {
      console.error('Account select population error:', error);
    }
  }

  function renderAccount(index) {
    try {
      const { display, empty, price, description, status: statusEl } = elements.accounts;
      if (!display) return;

      const account = state.accounts.data[index];
      state.accounts.currentAccount = account;

      if (!account) {
        display.style.display = 'none';
        if (empty) empty.style.display = 'block';
        return;
      }

      display.classList.remove('expanded');

      // Update account details
      if (price) price.textContent = formatToIdr(account.price);
      if (description) description.textContent = account.description;
      
      if (statusEl) {
        statusEl.textContent = account.status;
        statusEl.className = 'account-status-badge';
        statusEl.classList.add(
          account.status.toLowerCase() === 'tersedia' ? 'available' : 'sold'
        );
      }

      // Render carousel
      renderAccountCarousel(account);

      // Show display, hide empty
      if (empty) empty.style.display = 'none';
      display.style.display = 'block';
      
    } catch (error) {
      console.error('Account rendering error:', error);
    }
  }

  function renderAccountCarousel(account) {
    try {
      const { track, indicators } = elements.accounts.carousel;
      if (!track || !indicators) return;

      track.innerHTML = '';
      indicators.innerHTML = '';

      if (account.images && account.images.length > 0) {
        account.images.forEach((src, i) => {
          // Add image slide
          const slide = createElement('div', {
            className: 'carousel-slide',
            innerHTML: `<img src="${src}" alt="Gambar untuk ${account.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;aspect-ratio:16/9;background-color:var(--surface-secondary);color:var(--text-tertiary);\\'>Gambar gagal dimuat</div>'">`
          });
          track.appendChild(slide);

          // Add indicator
          const indicator = createElement('button', {
            className: 'indicator-dot',
            attributes: {
              'type': 'button',
              'aria-label': `Tampilkan gambar ${i + 1}`,
              'data-index': i
            }
          });

          indicator.addEventListener('click', e => {
            e.stopPropagation();
            state.accounts.currentIndex = parseInt(e.target.dataset.index);
            updateCarousel();
          });

          indicators.appendChild(indicator);
        });
      } else {
        // No images available
        const slide = createElement('div', {
          className: 'carousel-slide',
          innerHTML: `
            <div style="display:flex;align-items:center;justify-content:center;height:100%;aspect-ratio:16/9;background-color:var(--surface-secondary);color:var(--text-tertiary);">
              Gambar tidak tersedia
            </div>
          `
        });
        track.appendChild(slide);
      }

      state.accounts.currentIndex = 0;
      updateCarousel();
    } catch (error) {
      console.error('Carousel rendering error:', error);
    }
  }

  function updateCarousel() {
    try {
      const account = state.accounts.currentAccount;
      if (!account) return;

      const { track, prevBtn, nextBtn, indicators } = elements.accounts.carousel;
      if (!track) return;

      const totalSlides = account.images?.length || 1;
      
      // Update track position
      track.style.transform = `translateX(-${state.accounts.currentIndex * 100}%)`;

      // Update navigation buttons
      if (prevBtn) {
        const canGoPrev = totalSlides > 1 && state.accounts.currentIndex > 0;
        prevBtn.disabled = !canGoPrev;
        prevBtn.setAttribute('aria-disabled', !canGoPrev);
      }

      if (nextBtn) {
        const canGoNext = totalSlides > 1 && state.accounts.currentIndex < totalSlides - 1;
        nextBtn.disabled = !canGoNext;
        nextBtn.setAttribute('aria-disabled', !canGoNext);
      }

      // Update indicators
      if (indicators) {
        indicators.querySelectorAll('.indicator-dot').forEach((dot, i) => {
          const isActive = i === state.accounts.currentIndex;
          dot.classList.toggle('active', isActive);
          dot.setAttribute('aria-pressed', isActive);
        });
      }
    } catch (error) {
      console.error('Carousel update error:', error);
    }
  }

  function initializeCarousel() {
    try {
      const { prevBtn, nextBtn, track } = elements.accounts.carousel;

      // Previous button
      if (prevBtn) {
        prevBtn.addEventListener('click', e => {
          e.stopPropagation();
          if (state.accounts.currentIndex > 0) {
            state.accounts.currentIndex--;
            updateCarousel();
          }
        });
      }

      // Next button
      if (nextBtn) {
        nextBtn.addEventListener('click', e => {
          e.stopPropagation();
          const account = state.accounts.currentAccount;
          if (!account?.images) return;

          if (state.accounts.currentIndex < account.images.length - 1) {
            state.accounts.currentIndex++;
            updateCarousel();
          }
        });
      }

      // Touch swipe support
      if (track) {
        let touchStartX = 0;
        let touchEndX = 0;

        track.addEventListener('touchstart', e => {
          e.stopPropagation();
          touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        track.addEventListener('touchend', e => {
          e.stopPropagation();
          touchEndX = e.changedTouches[0].screenX;
          
          const swipeThreshold = 50;
          const swipeDistance = touchEndX - touchStartX;
          
          if (Math.abs(swipeDistance) > swipeThreshold) {
            if (swipeDistance < 0 && nextBtn && !nextBtn.disabled) {
              nextBtn.click();
            } else if (swipeDistance > 0 && prevBtn && !prevBtn.disabled) {
              prevBtn.click();
            }
          }
        }, { passive: true });
      }
    } catch (error) {
      console.error('Carousel initialization error:', error);
    }
  }

  async function initializeAccounts() {
    if (state.accounts.initialized || state.accounts.isLoading) return;
    
    state.accounts.isLoading = true;

    try {
      const { customSelect, error, empty, display, buyBtn, offerBtn } = elements.accounts;

      if (error) error.style.display = 'none';

      const response = await safeFetch(
        getSheetUrl(config.sheets.accounts.name, 'csv'),
        'accounts'
      );
      
      const text = await response.text();
      state.accounts.data = await parseAccountsSheet(text);
      
      populateAccountSelect();

      // Setup event listeners
      if (display) {
        display.addEventListener('click', e => {
          if (!e.target.closest('.action-btn, .carousel-btn, .indicator-dot')) {
            display.classList.toggle('expanded');
            const isExpanded = display.classList.contains('expanded');
            display.setAttribute('aria-expanded', isExpanded);
          }
        });
      }

      if (buyBtn) {
        buyBtn.addEventListener('click', e => {
          e.stopPropagation();
          if (state.accounts.currentAccount) {
            openPaymentModal({
              title: state.accounts.currentAccount.title,
              price: state.accounts.currentAccount.price,
              catLabel: 'Akun Game'
            });
          }
        });
      }

      if (offerBtn) {
        offerBtn.addEventListener('click', e => {
          e.stopPropagation();
          if (state.accounts.currentAccount) {
            const text = `Halo, saya tertarik untuk menawar Akun Game: ${state.accounts.currentAccount.title}`;
            const waUrl = `https://wa.me/${config.waNumber}?text=${encodeURIComponent(text)}`;
            window.open(waUrl, '_blank', 'noopener,noreferrer');
          }
        });
      }

      initializeCarousel();
      state.accounts.initialized = true;

    } catch (error) {
      const errorMessage = handleError(error, 'Accounts initialization');
      if (errorMessage) {
        console.error('Accounts initialization failed:', error);
        
        if (elements.accounts.error) {
          elements.accounts.error.textContent = errorMessage;
          elements.accounts.error.style.display = 'block';
        }
        
        if (elements.accounts.empty) {
          elements.accounts.empty.style.display = 'none';
        }
        
        if (elements.accounts.customSelect?.value) {
          elements.accounts.customSelect.value.textContent = 'Gagal memuat';
        }
      }
    } finally {
      state.accounts.isLoading = false;
    }
  }

  // Library functions (enhanced)
  async function initializeLibrary() {
    if (state.library.initialized || state.library.isLoading) return;
    
    state.library.isLoading = true;

    try {
      const { container, error } = elements.library;
      if (!container) return;

      if (container) container.innerHTML = '<p>Memuat perpustakaan...</p>';
      if (error) error.style.display = 'none';

      const response = await safeFetch(
        getSheetUrl(config.sheets.library.name, 'csv'),
        'library'
      );
      
      const text = await response.text();
      const rows = robustCsvParser(text);
      
      if (rows.length > 0) {
        rows.shift(); // Remove header
      }

      const books = rows
        .filter(row => row && row[0])
        .map(row => ({
          title: row[0]?.trim() || 'Tanpa Judul',
          coverUrl: row[1]?.trim() || '',
          bookUrl: row[2]?.trim() || '#'
        }))
        .filter(book => book.title !== 'Tanpa Judul');

      state.library.data = books;
      renderLibraryGrid(books);
      state.library.initialized = true;

    } catch (error) {
      const errorMessage = handleError(error, 'Library initialization');
      if (errorMessage) {
        console.error('Library initialization failed:', error);
        
        if (elements.library.container) {
          elements.library.container.innerHTML = '';
        }
        
        if (elements.library.error) {
          elements.library.error.textContent = errorMessage;
          elements.library.error.style.display = 'block';
        }
      }
    } finally {
      state.library.isLoading = false;
    }
  }

  function renderLibraryGrid(books) {
    try {
      const { container } = elements.library;
      if (!container) return;

      if (!Array.isArray(books) || books.length === 0) {
        container.innerHTML = `
          <div class="empty" role="status">
            <div class="empty-content">
              <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <p>Belum ada buku yang tersedia.</p>
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = '';
      const fragment = document.createDocumentFragment();

      books.forEach(book => {
        const card = createElement('a', {
          className: 'book-card',
          attributes: {
            'href': book.bookUrl,
            'target': '_blank',
            'rel': 'noopener noreferrer',
            'aria-label': `Baca buku: ${book.title}`
          }
        });

        const img = createElement('img', {
          className: 'cover',
          attributes: {
            'src': book.coverUrl,
            'alt': book.title,
            'loading': 'lazy',
            'onerror': "this.style.display='none'; this.nextElementSibling.style.display='flex';"
          }
        });

        const fallback = createElement('div', {
          className: 'cover-fallback',
          innerHTML: `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          `,
          attributes: {
            'style': 'display: none; align-items: center; justify-content: center; height: 100%; background-color: var(--surface-secondary); color: var(--text-tertiary);'
          }
        });

        const overlay = createElement('div', { className: 'overlay' });
        const title = createElement('div', { 
          className: 'title', 
          textContent: book.title 
        });

        card.appendChild(img);
        card.appendChild(fallback);
        card.appendChild(overlay);
        card.appendChild(title);
        
        fragment.appendChild(card);
      });

      container.appendChild(fragment);
    } catch (error) {
      console.error('Library grid rendering error:', error);
      if (elements.library.container) {
        elements.library.container.innerHTML = `
          <div class="error" role="alert">${config.messages.genericError}</div>
        `;
      }
    }
  }

  // Initialize application when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

  // Expose some functions for debugging (remove in production)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window.PlayPalDebug = {
      state,
      elements,
      config,
      loadCatalog,
      setMode
    };
  }

})();
