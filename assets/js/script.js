/**
 * PlayPal.ID Refactored Application
 *
 * Architecture: Modular, State-driven, Component-based UI
 * Features:
 * - Centralized State Management & Event System
 * - Component-based UI Rendering (CustomSelect, Pagination)
 * - Simple Client-side Router
 * - API Abstraction for Google Sheets
 * - Modern JS (ESM, Async/Await)
 */

// --- UTILITIES MODULE ---
const utils = {
  get: (selector, scope = document) => scope.querySelector(selector),
  getAll: (selector, scope = document) => scope.querySelectorAll(selector),
  formatIdr: (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value),
  debounce(func, delay = 250) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },
  parseCsv(text) {
    const rows = text.trim().replace(/\r\n/g, '\n').split('\n');
    return rows.map(row => {
        const result = []; let current = ''; let inQuote = false;
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"' && i + 1 < row.length && row[i + 1] === '"') {
                current += '"'; i++;
            } else if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                result.push(current.trim()); current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }).filter(row => row.length > 1 || (row.length === 1 && row[0]));
  },
  normalizeStatus(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (['success', 'selesai', 'berhasil', 'done'].includes(s)) return 'success';
    if (['progress', 'proses', 'diproses', 'processing'].includes(s)) return 'progress';
    if (['failed', 'gagal', 'dibatalkan', 'cancel', 'error'].includes(s)) return 'failed';
    return 'pending';
  }
};

// --- EVENT BUS MODULE ---
const events = {
  listeners: {},
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
};

// --- STATE MANAGEMENT MODULE ---
const state = {
  _data: {},
  create(key, initialState) {
    this._data[key] = initialState;
    const handler = {
      set: (target, property, value) => {
        target[property] = value;
        events.emit(`${key}:updated`, { ...target });
        return true;
      },
    };
    return new Proxy(this._data[key], handler);
  },
};

const catalogState = state.create('catalog', {
  items: [],
  categories: [],
  activeCategory: null,
  searchQuery: '',
  isLoading: true,
});

const preorderState = state.create('preorder', {
  items: [],
  filteredItems: [],
  isLoading: true,
  searchQuery: '',
  statusFilter: 'all',
  type: 'starlight',
  currentPage: 1,
  itemsPerPage: 10,
});

// --- API SERVICE MODULE ---
const api = {
  _config: {
    sheetId: '1B0XPR4uSvRzy9LfzWDjNjwAyMZVtJs6_Kk_r2fh7dTw',
    sheets: {
      katalog: 'Sheet3',
      preorderStarlight: 'Sheet1',
      preorderGeneral: 'Sheet2',
    }
  },
  async _fetchSheet(sheetName, format = 'csv') {
    const url = `https://docs.google.com/spreadsheets/d/${this._config.sheetId}/gviz/tq?tqx=out:${format}&sheet=${encodeURIComponent(sheetName)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
      const text = await response.text();
      const data = utils.parseCsv(text);
      data.shift(); // Remove header
      return data;
    } catch (error) {
      console.error(`Failed to fetch sheet "${sheetName}":`, error);
      return null;
    }
  },
  async getCatalog() {
    const url = `https://docs.google.com/spreadsheets/d/${this._config.sheetId}/gviz/tq?sheet=${this._config.sheets.katalog}&tqx=out:json`;
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
                if (category && titleCell?.v && priceCell?.v !== null) {
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
  async getPreorder(type) {
    const sheetName = type === 'starlight' ? this._config.preorderStarlight : this._config.preorderGeneral;
    const data = await this._fetchSheet(sheetName);
    if (!data) return [];

    const isDetailed = type === 'starlight';
    const statusOrder = { progress: 1, pending: 2, success: 3, failed: 4 };

    return data.map(row => isDetailed ? ({
        orderDate: row[0],
        deliveryEstimate: row[1],
        product: row[3],
        month: row[4],
        name: row[5],
        statusRaw: row[6],
        status: utils.normalizeStatus(row[6]),
        isDetailed: true
    }) : ({
        orderNumber: row[0],
        product: row[1],
        statusRaw: row[2],
        status: utils.normalizeStatus(row[2]),
        isDetailed: false
    })).sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }
};

// --- UI COMPONENTS ---
class Component {
    constructor(element) {
        this.element = element;
    }
}

class CustomSelect extends Component {
    constructor(element, { options, initialValue, onSelect }) {
        super(element);
        this.options = options;
        this.onSelect = onSelect;
        this.isOpen = false;
        this.selectedValue = initialValue || options[0]?.value;
        this.render();
        this.addEventListeners();
    }
    render() {
        const selectedLabel = this.options.find(opt => opt.value === this.selectedValue)?.label || 'Pilih Opsi';
        this.element.innerHTML = `
            <button class="input custom-select__button" type="button" aria-haspopup="listbox" aria-expanded="${this.isOpen}">
                <span class="custom-select__value">${selectedLabel}</span>
                <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
            </button>
            <div class="custom-select__options" role="listbox">
                ${this.options.map(opt => `
                    <div class="custom-select__option ${opt.value === this.selectedValue ? 'is-selected' : ''}" data-value="${opt.value}" role="option">${opt.label}</div>
                `).join('')}
            </div>
        `;
        if (this.isOpen) this.element.classList.add('is-open');
        else this.element.classList.remove('is-open');
    }
    toggle(force) {
        this.isOpen = typeof force === 'boolean' ? force : !this.isOpen;
        this.render();
    }
    addEventListeners() {
        this.element.addEventListener('click', e => {
            if (e.target.closest('.custom-select__button')) {
                this.toggle();
            } else if (e.target.closest('.custom-select__option')) {
                const value = e.target.closest('.custom-select__option').dataset.value;
                this.selectedValue = value;
                this.toggle(false);
                this.onSelect(value);
            }
        });
        document.addEventListener('click', e => {
            if (!this.element.contains(e.target)) this.toggle(false);
        });
    }
}

class Pagination extends Component {
    constructor(element, { currentPage, totalItems, itemsPerPage, onPageChange }) {
        super(element);
        this.update({ currentPage, totalItems, itemsPerPage, onPageChange });
    }
    update({ currentPage, totalItems, itemsPerPage, onPageChange }) {
        this.currentPage = currentPage;
        this.totalItems = totalItems;
        this.itemsPerPage = itemsPerPage;
        this.totalPages = Math.ceil(totalItems / itemsPerPage);
        this.onPageChange = onPageChange;
        this.render();
        if (this.totalPages > 1) this.addEventListeners();
    }
    render() {
        if (this.totalPages <= 1) {
            this.element.innerHTML = '';
            return;
        }
        this.element.innerHTML = `
            <button class="button button--secondary" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">Sebelumnya</button>
            <span class="pagination__info">Hal ${this.currentPage} dari ${this.totalPages}</span>
            <button class="button button--secondary" ${this.currentPage === this.totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">Selanjutnya</button>
        `;
    }
    addEventListeners() {
        this.element.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (button && !button.disabled) {
                this.onPageChange(Number(button.dataset.page));
            }
        });
    }
}

// --- MODAL MANAGER ---
const modalManager = {
    init() {
        this.modal = utils.get('#paymentModal');
        this.overlay = utils.get('#modalOverlay');
        this.closeBtn = utils.get('#modalCloseBtn');
        this.title = utils.get('#paymentModalTitle');
        this.body = utils.get('#modalBody');
        this.footer = utils.get('#modalFooter');

        this.closeBtn.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', () => this.close());
    },
    open({ title, body, footer }) {
        this.title.textContent = title;
        this.body.innerHTML = body;
        this.footer.innerHTML = footer;
        
        this.modal.hidden = false;
        setTimeout(() => this.modal.classList.add('is-open'), 10);
        document.body.classList.add('overflow-hidden');
    },
    close() {
        this.modal.classList.remove('is-open');
        setTimeout(() => {
            this.modal.hidden = true;
            document.body.classList.remove('overflow-hidden');
        }, 300);
    }
};

// --- PAGE MODULES ---
const pages = {
  home: {
    init: async () => {
      catalogState.isLoading = true;
      const template = utils.get('#page-home').content.cloneNode(true);
      app.mainContent.innerHTML = '';
      app.mainContent.appendChild(template);

      const data = await api.getCatalog();
      catalogState.items = data || [];
      const categories = [...new Set(catalogState.items.map(item => item.category))];
      catalogState.categories = categories;
      catalogState.activeCategory = categories[0] || null;
      
      new CustomSelect(utils.get('#categorySelectWrapper'), {
        options: categories.map(cat => ({ label: cat, value: cat })),
        initialValue: catalogState.activeCategory,
        onSelect: (value) => { catalogState.activeCategory = value; }
      });

      catalogState.isLoading = false; // Triggers re-render via event listener
      pages.home.addEventListeners();
    },
    render: (data) => {
        const container = utils.get('#itemListContainer');
        const countInfo = utils.get('#itemCountInfo');
        if (!container) return;

        if (data.isLoading) {
            container.innerHTML = Array(8).fill(`
                <div class="card card__clickable skeleton">
                    <div class="skeleton-text skeleton-card-text-1"></div>
                </div>`).join('');
            countInfo.textContent = 'Memuat item...';
            return;
        }

        const filtered = data.items.filter(item =>
            item.category === data.activeCategory &&
            (item.title.toLowerCase().includes(data.searchQuery.toLowerCase()) || 
             String(item.price).includes(data.searchQuery))
        );

        countInfo.textContent = `${filtered.length} dari ${data.items.length} item ditemukan.`;
        container.innerHTML = filtered.length ? filtered.map(item => `
            <button class="card__clickable" data-item='${JSON.stringify(item)}'>
                <span class="card__title">${item.title}</span>
                <span class="card__price">${utils.formatIdr(item.price)}</span>
            </button>
        `).join('') : '<p class="empty-state">Tidak ada item ditemukan.</p>';
    },
    addEventListeners: () => {
      const searchInput = utils.get('#searchInput');
      searchInput.addEventListener('input', utils.debounce(e => {
          catalogState.searchQuery = e.target.value;
      }));

      const listContainer = utils.get('#itemListContainer');
      listContainer.addEventListener('click', e => {
        const button = e.target.closest('.card__clickable');
        if (button) pages.home.showPaymentModal(JSON.parse(button.dataset.item));
      });
    },
    showPaymentModal: (item) => {
      let currentTotal = 0;
      const options = app.config.paymentOptions;

      const calculateTotal = (optionId) => {
        const option = options.find(o => o.id === optionId);
        const fee = option.feeType === 'fixed' ? option.value : Math.ceil(item.price * option.value);
        currentTotal = item.price + fee;
        return { fee, total: currentTotal };
      };

      const body = `
          <div class="payment-recap">
              <div class="payment-recap__item"><span class="payment-recap__label">Item:</span><span class="payment-recap__value">${item.title}</span></div>
              <div class="payment-recap__item"><span class="payment-recap__label">Harga:</span><span class="payment-recap__value">${utils.formatIdr(item.price)}</span></div>
          </div>
          <div class="payment-options__group">
              ${options.map((opt, i) => `
                  <div class="payment-option">
                      <input type="radio" id="${opt.id}" name="payment" value="${opt.id}" ${i === 0 ? 'checked' : ''}>
                      <label for="${opt.id}">
                          <span>${opt.name}</span>
                          <span class="payment-option__fee">+ ${utils.formatIdr(calculateTotal(opt.id).fee)}</span>
                      </label>
                  </div>`).join('')}
          </div>
          <div class="payment-total" id="paymentTotalContainer"></div>`;
      
      const footer = `<a id="waButton" class="button button--primary" href="#" target="_blank" rel="noopener">Lanjutkan ke WhatsApp</a>`;

      modalManager.open({ title: 'Pilih Pembayaran', body, footer });
      
      const updateTotal = () => {
          const selectedId = utils.get('input[name="payment"]:checked').value;
          const { fee, total } = calculateTotal(selectedId);
          utils.get('#paymentTotalContainer').innerHTML = `
              <div class="payment-total__row"><span class="payment-total__label">Fee:</span><span class="payment-total__value">${utils.formatIdr(fee)}</span></div>
              <div class="payment-total__row payment-total__row--grand"><span class="payment-total__label">Total:</span><span class="payment-total__value">${utils.formatIdr(total)}</span></div>
          `;
          const selectedOption = options.find(o => o.id === selectedId);
          const waText = encodeURIComponent(`*Detail pesanan:*\n› Item: ${item.title}\n› Pembayaran: ${selectedOption.name}\n› Harga: ${utils.formatIdr(item.price)}\n› Fee: ${utils.formatIdr(fee)}\n› Total: ${utils.formatIdr(total)}`);
          utils.get('#waButton').href = `https://wa.me/${app.config.whatsappNumber}?text=${waText}`;
      };

      utils.getAll('input[name="payment"]').forEach(input => input.addEventListener('change', updateTotal));
      updateTotal();
    },
  },
  preorder: {
    init: async () => {
        preorderState.isLoading = true;
        const template = utils.get('#page-preorder').content.cloneNode(true);
        app.mainContent.innerHTML = '';
        app.mainContent.appendChild(template);

        new CustomSelect(utils.get('#preorderTypeSelectWrapper'), {
            options: [
                { label: 'Starlight Member', value: 'starlight' },
                { label: 'Pesanan Umum', value: 'general' }
            ],
            initialValue: preorderState.type,
            onSelect: (value) => { preorderState.type = value; pages.preorder.fetchData(); }
        });
        new CustomSelect(utils.get('#preorderStatusSelectWrapper'), {
            options: [
                { label: 'Semua Status', value: 'all' },
                { label: 'Success', value: 'success' },
                { label: 'Progress', value: 'progress' },
                { label: 'Pending', value: 'pending' },
                { label: 'Gagal', value: 'failed' }
            ],
            initialValue: preorderState.statusFilter,
            onSelect: (value) => { preorderState.statusFilter = value; }
        });

        await pages.preorder.fetchData();
        pages.preorder.addEventListeners();
    },
    fetchData: async () => {
        preorderState.isLoading = true;
        preorderState.items = await api.getPreorder(preorderState.type);
        preorderState.isLoading = false; // Triggers re-render
    },
    render: (data) => {
        const container = utils.get('#preorderListContainer');
        const countInfo = utils.get('#preorderCountInfo');
        if (!container) return;
        
        if (data.isLoading) {
            container.innerHTML = Array(5).fill(`
                <div class="card card--preorder skeleton">
                    <div class="card--preorder-header">
                        <div>
                            <div class="skeleton-text skeleton-card-text-1"></div>
                            <div class="skeleton-text skeleton-card-text-2"></div>
                        </div>
                        <div class="skeleton-text skeleton-card-badge"></div>
                    </div>
                </div>`).join('');
            countInfo.textContent = 'Memuat pesanan...';
            return;
        }

        const filtered = data.items.filter(item =>
            (data.statusFilter === 'all' || item.status === data.statusFilter) &&
            ((item.name || item.orderNumber || '').toLowerCase().includes(data.searchQuery.toLowerCase()))
        );
        preorderState.filteredItems = filtered; // Store for pagination

        const paginated = filtered.slice((data.currentPage - 1) * data.itemsPerPage, data.currentPage * data.itemsPerPage);
        
        countInfo.textContent = `${filtered.length} dari ${data.items.length} pesanan ditemukan.`;
        container.innerHTML = paginated.length ? paginated.map(item => pages.preorder.getCardHTML(item)).join('') : '<p class="empty-state">Tidak ada pesanan ditemukan.</p>';

        new Pagination(utils.get('#preorderPagination'), {
            currentPage: data.currentPage,
            totalItems: filtered.length,
            itemsPerPage: data.itemsPerPage,
            onPageChange: (page) => { preorderState.currentPage = page; }
        });
    },
    addEventListeners: () => {
        utils.get('#preorderSearchInput').addEventListener('input', utils.debounce(e => {
            preorderState.currentPage = 1;
            preorderState.searchQuery = e.target.value;
        }));
        utils.get('#preorderListContainer').addEventListener('click', e => {
            const card = e.target.closest('.card--preorder');
            if (card) card.classList.toggle('is-expanded');
        })
    },
    getCardHTML: (item) => `
        <article class="card card--preorder">
            <header class="card--preorder-header">
                <div>
                    <div class="card--preorder-name">${item.name || item.orderNumber || 'Tanpa Nama'}</div>
                    <div class="card--preorder-product">${item.product || 'N/A'}</div>
                </div>
                <div class="card--preorder-status">
                     <div class="status-badge status-badge--${item.status}">${item.statusRaw || 'Pending'}</div>
                     ${item.isDetailed ? `<svg class="expand-indicator" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>` : ''}
                </div>
                ${item.deliveryEstimate ? `<div class="card--preorder-date">Estimasi: ${item.deliveryEstimate}</div>` : ''}
            </header>
            ${item.isDetailed ? `
                <div class="card--preorder-details">
                    <div class="details-grid">
                        <div class="detail-item"><div class="detail-item__label">Tgl Order</div><div class="detail-item__value">${item.orderDate || '-'}</div></div>
                        <div class="detail-item"><div class="detail-item__label">Bulan</div><div class="detail-item__value">${item.month || '-'}</div></div>
                    </div>
                </div>` : ''}
        </article>
    `
  }
};

// --- ROUTER & APP INITIALIZATION ---
const app = {
  mainContent: utils.get('#mainContent'),
  config: {
    whatsappNumber: '6285877001999',
    paymentOptions: [
      { id: 'seabank', name: 'Seabank', feeType: 'fixed', value: 0 },
      { id: 'gopay', name: 'Gopay', feeType: 'fixed', value: 0 },
      { id: 'dana', name: 'Dana', feeType: 'fixed', value: 125 },
      { id: 'bank_to_dana', name: 'Bank ke Dana', feeType: 'fixed', value: 500 },
      { id: 'qris', name: 'QRIS', feeType: 'percentage', value: 0.01 },
    ],
  },
  routes: {
    '/': pages.home,
    '/preorder': pages.preorder,
  },
  init() {
    this.setupEventListeners();
    this.updateHeaderStatus();
    setInterval(this.updateHeaderStatus, 60000);
    modalManager.init();

    // Event listeners for state changes
    events.on('catalog:updated', pages.home.render);
    events.on('preorder:updated', pages.preorder.render);
    
    this.handleNavigation();
  },
  handleNavigation() {
    const path = window.location.pathname;
    const page = this.routes[path] || this.routes['/'];
    if (page?.init) page.init();
    this.updateActiveLink(path);
  },
  updateActiveLink(path) {
    utils.getAll('.sidebar__link.is-active').forEach(l => l.classList.remove('is-active'));
    utils.get(`.sidebar__link[href="${path}"]`)?.classList.add('is-active');
  },
  setupEventListeners() {
    window.addEventListener('popstate', () => this.handleNavigation());
    document.body.addEventListener('click', e => {
      const navLink = e.target.closest('[data-nav-link]');
      if (navLink) {
        e.preventDefault();
        history.pushState({}, '', navLink.href);
        this.handleNavigation();
        if (utils.get('#sidebar').classList.contains('is-open')) this.toggleSidebar(false);
      }
      const toggleBtn = e.target.closest('#menuToggleBtn');
      if (toggleBtn) this.toggleSidebar();
      const overlay = e.target.closest('#sidebarOverlay');
      if (overlay) this.toggleSidebar(false);
    });
  },
  toggleSidebar(force) {
    const sidebar = utils.get('#sidebar');
    const overlay = utils.get('#sidebarOverlay');
    const toggleBtn = utils.get('#menuToggleBtn');
    const isOpen = typeof force === 'boolean' ? force : !sidebar.classList.contains('is-open');

    sidebar.classList.toggle('is-open', isOpen);
    overlay.classList.toggle('is-visible', isOpen);
    toggleBtn.setAttribute('aria-expanded', isOpen);
    document.body.classList.toggle('overflow-hidden', isOpen);
  },
  updateHeaderStatus() {
    const indicator = utils.get('#headerStatusIndicator');
    const hour = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false });
    if (parseInt(hour, 10) >= 8) {
        indicator.textContent = 'Buka';
        indicator.className = 'header__status is-open';
    } else {
        indicator.textContent = 'Tutup';
        indicator.className = 'header__status is-closed';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
