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

    function getElement(id) {
        return document.getElementById(id);
    }

    const elements = {
        themeColorMeta: getElement('themeColorMeta'),
        sidebar: {
            nav: getElement('sidebarNav'),
            overlay: getElement('sidebarOverlay'),
            burger: getElement('burgerBtn'),
            links: document.querySelectorAll('.sidebar-nav .nav-item[data-mode]'),
        },
        themeToggle: getElement('themeToggleBtn'),
        views: {
            home: getElement('viewHome'),
            layanan: getElement('viewLayanan'),
            preorder: getElement('viewPreorder'),
            accounts: getElement('viewAccounts'),
            perpustakaan: getElement('viewPerpustakaan'),
            film: getElement('viewFilm'),
        },
        home: {
            listContainer: getElement('homeListContainer'),
            searchInput: getElement('homeSearchInput'),
            countInfo: getElement('homeCountInfo'),
            errorContainer: getElement('homeErrorContainer'),
        },
        layanan: {
            listContainer: getElement('layananListContainer'),
            searchInput: getElement('layananSearchInput'),
            countInfo: getElement('layananCountInfo'),
            errorContainer: getElement('layananErrorContainer'),
            customSelect: {
                wrapper: getElement('layananCustomSelectWrapper'),
                btn: getElement('layananCustomSelectBtn'),
                value: getElement('layananCustomSelectValue'),
                options: getElement('layananCustomSelectOptions'),
            },
        },
        itemTemplate: getElement('itemTemplate'),
        skeletonItemTemplate: getElement('skeletonItemTemplate'),
        skeletonCardTemplate: getElement('skeletonCardTemplate'),
        paymentModal: {
            dialog: getElement('paymentModal'),
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

    const state = {
        currentSelectedItem: null,
        allCatalogData: [],
        modalTriggerElement: null,
        layanan: { activeCategory: '', searchQuery: '' },
        home: { searchQuery: '' },
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

    function formatToIdr(value) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
    }

    function getSheetUrl(sheetName, format = 'json') {
        const baseUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`;
        const encodedSheetName = encodeURIComponent(sheetName);
        return format === 'csv' ? `${baseUrl}?tqx=out:csv&sheet=${encodedSheetName}` : `${baseUrl}?sheet=${encodedSheetName}&tqx=out:json`;
    }

    function showSkeleton(container, template, count = 6) {
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            fragment.appendChild(template.content.cloneNode(true));
        }
        container.appendChild(fragment);
    }

    function debounce(func, delay = 250) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    function parseGvizPairs(jsonText) {
        const match = jsonText.match(/\{.*\}/s);
        if (!match) throw new Error('Invalid GViz response: No JSON object found.');
        const obj = JSON.parse(match[0]);
        if (!obj || !obj.table || !Array.isArray(obj.table.cols) || !Array.isArray(obj.table.rows)) {
            throw new Error('Invalid GViz response: Missing table, cols, or rows structure.');
        }
        const { rows, cols } = obj.table;
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
                if (title && !isNaN(price)) {
                    out.push({ catKey: p.label, catLabel: String(p.label || '').trim().replace(/\s+/g, ' '), title, price });
                }
            }
        }
        return out;
    }

    function robustCsvParser(text) {
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
                        i++;
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

    function safeSetText(element, text) {
        if (element) {
            element.textContent = text || '';
        }
    }

    function showError(listContainer, errorContainer, message) {
        if (listContainer) listContainer.innerHTML = '';
        if (errorContainer) {
            errorContainer.style.display = 'block';
            safeSetText(errorContainer, message);
        }
    }

    function createElement(tag, properties = {}) {
        const element = document.createElement(tag);
        Object.entries(properties).forEach(([key, value]) => {
            if (key === 'textContent') {
                element.textContent = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        return element;
    }

    function applyTheme(theme) {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        const themeColor = theme === 'dark' ? '#303952' : '#ffffff';
        elements.themeColorMeta.setAttribute('content', themeColor);
    }

    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        applyTheme(currentTheme);
    }

    function toggleTheme() {
        const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    }

    function toggleCustomSelect(wrapper, forceOpen) {
        const btn = wrapper.querySelector('.custom-select-btn');
        if (!btn) return;
        const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !wrapper.classList.contains('open');
        wrapper.classList.toggle('open', isOpen);
        btn.setAttribute('aria-expanded', isOpen);
    }

    function handleCustomSelectKeyboard(e, wrapper) {
        const optionsContainer = wrapper.querySelector('.custom-select-options');
        const options = Array.from(optionsContainer.querySelectorAll('.custom-select-option'));
        if (!options.length) return;
        const currentFocused = optionsContainer.querySelector('.focused') || optionsContainer.querySelector('.selected');
        let currentIndex = currentFocused ? options.indexOf(currentFocused) : -1;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                currentIndex = (currentIndex + 1) % options.length;
                break;
            case 'ArrowUp':
                e.preventDefault();
                currentIndex = (currentIndex - 1 + options.length) % options.length;
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (wrapper.classList.contains('open') && currentIndex > -1) {
                    options[currentIndex].click();
                } else {
                    toggleCustomSelect(wrapper);
                }
                return;
            case 'Escape':
                e.preventDefault();
                if (wrapper.classList.contains('open')) {
                    toggleCustomSelect(wrapper, false);
                }
                return;
            default:
                return;
        }
        if (currentFocused) currentFocused.classList.remove('focused');
        options[currentIndex].classList.add('focused');
        options[currentIndex].scrollIntoView({ block: 'nearest' });
        const btn = wrapper.querySelector('.custom-select-btn');
        btn.setAttribute('aria-activedescendant', options[currentIndex].id);
    }

    function initializeCustomSelects() {
        const customSelects = [
            elements.layanan.customSelect,
            elements.preorder.customSelect,
            elements.accounts.customSelect
        ];
        customSelects.forEach(select => {
            if (select.btn) {
                select.btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleCustomSelect(select.wrapper);
                });
                select.btn.addEventListener('keydown', (e) => handleCustomSelectKeyboard(e, select.wrapper));
            }
        });
    }

    function initSmartGestureSystem(callback) {
        let startX = 0;
        let startY = 0;
        let isScrolling = false;
        const scrollThreshold = 10;
        document.addEventListener('pointerdown', (e) => {
            startX = e.clientX;
            startY = e.clientY;
            isScrolling = false;
        }, { passive: true });
        document.addEventListener('pointermove', (e) => {
            if (isScrolling) return;
            const deltaX = Math.abs(e.clientX - startX);
            const deltaY = Math.abs(e.clientY - startY);
            if (deltaX > scrollThreshold || deltaY > scrollThreshold) {
                isScrolling = true;
            }
        }, { passive: true });
        document.addEventListener('pointerup', (e) => {
            if (!isScrolling) {
                callback(e);
            }
        }, { capture: true });
    }

    function calculateFee(price, option) {
        if (option.feeType === 'fixed') return option.value;
        if (option.feeType === 'percentage') return Math.ceil(price * option.value);
        return 0;
    }

    function updateWaLink(option, fee, total) {
        const { catLabel = "Produk", title, price } = state.currentSelectedItem;
        const text = [
            config.waGreeting,
            `› Tipe: ${catLabel}`,
            `› Item: ${title}`,
            `› Pembayaran: ${option.name}`,
            `› Harga: ${formatToIdr(price)}`,
            `› Fee: ${formatToIdr(fee)}`,
            `› Total: ${formatToIdr(total)}`,
        ].join('\n');
        elements.paymentModal.waBtn.href = `https://wa.me/${config.waNumber}?text=${encodeURIComponent(text)}`;
    }

    function updatePriceDetails() {
        const selectedOptionId = document.querySelector('input[name="payment"]:checked')?.value;
        if (!selectedOptionId) return;
        const selectedOption = config.paymentOptions.find(opt => opt.id === selectedOptionId);
        if (!state.currentSelectedItem || !selectedOption) return;
        const price = state.currentSelectedItem.price;
        const fee = calculateFee(price, selectedOption);
        const total = price + fee;
        safeSetText(elements.paymentModal.fee, formatToIdr(fee));
        safeSetText(elements.paymentModal.total, formatToIdr(total));
        updateWaLink(selectedOption, fee, total);
    }

    function openPaymentModal(item) {
        state.currentSelectedItem = item;
        state.modalTriggerElement = document.activeElement;
        const { dialog, itemName, itemPrice, optionsContainer } = elements.paymentModal;
        safeSetText(itemName, item.title);
        safeSetText(itemPrice, formatToIdr(item.price));
        optionsContainer.innerHTML = '';
        config.paymentOptions.forEach((option, index) => {
            const fee = calculateFee(item.price, option);
            optionsContainer.insertAdjacentHTML('beforeend', `
                <div class="payment-option">
                    <input type="radio" id="${option.id}" name="payment" value="${option.id}" ${index === 0 ? 'checked' : ''}>
                    <label for="${option.id}">
                        ${option.name} <span style="float: right;">+ ${formatToIdr(fee)}</span>
                    </label>
                </div>`);
        });
        optionsContainer.querySelectorAll('input[name="payment"]').forEach(input => {
            input.addEventListener('change', updatePriceDetails);
        });
        updatePriceDetails();
        dialog.showModal();
    }

    function closePaymentModal() {
        elements.paymentModal.dialog.close();
    }

    function initializeModal() {
        elements.paymentModal.closeBtn.addEventListener('click', closePaymentModal);
        elements.paymentModal.dialog.addEventListener('close', () => {
            state.currentSelectedItem = null;
            if (state.modalTriggerElement) {
                state.modalTriggerElement.focus();
            }
        });
        elements.paymentModal.dialog.addEventListener('click', (e) => {
            if (e.target === elements.paymentModal.dialog) {
                closePaymentModal();
            }
        });
    }

    function buildLayananCategorySelect(layananData) {
        const { options, value } = elements.layanan.customSelect;
        const categoryMap = new Map();
        layananData.forEach(item => {
            if (!categoryMap.has(item.catKey)) {
                categoryMap.set(item.catKey, item.catLabel);
            }
        });
        const layananCategories = [...categoryMap].map(([key, label]) => ({ key, label }));
        options.innerHTML = '';
        layananCategories.forEach((cat, index) => {
            const el = document.createElement('div');
            el.className = 'custom-select-option';
            el.textContent = cat.label;
            el.dataset.value = cat.key;
            el.setAttribute('role', 'option');
            el.id = `layanan-cat-${index}`;
            if (index === 0) {
                el.classList.add('selected');
                el.setAttribute('aria-selected', 'true');
            }
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                state.layanan.activeCategory = cat.key;
                value.textContent = cat.label;
                document.querySelector('#layananCustomSelectOptions .custom-select-option.selected')?.classList.remove('selected');
                document.querySelector('#layananCustomSelectOptions .custom-select-option[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
                el.classList.add('selected');
                el.setAttribute('aria-selected', 'true');
                toggleCustomSelect(elements.layanan.customSelect.wrapper, false);
                setTimeout(renderLayananList, 0);
            });
            options.appendChild(el);
        });
        if (layananCategories.length > 0) {
            state.layanan.activeCategory = layananCategories[0].key;
            safeSetText(value, layananCategories[0].label);
        } else {
            safeSetText(value, 'Data tidak tersedia');
        }
    }

    function renderList(container, countInfoEl, items, emptyText) {
        container.innerHTML = '';
        if (items.length === 0) {
            container.innerHTML = `<div class="empty"><div class="empty-content"><svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg><p>${emptyText}</p></div></div>`;
            safeSetText(countInfoEl, '');
            return;
        }
        const fragment = document.createDocumentFragment();
        let animationDelay = 0;
        for (const item of items) {
            const clone = elements.itemTemplate.content.cloneNode(true);
            const buttonEl = clone.querySelector('.list-item');
            buttonEl.style.animationDelay = `${animationDelay}ms`;
            animationDelay += 50;
            safeSetText(buttonEl.querySelector('.title'), item.title);
            safeSetText(buttonEl.querySelector('.price'), formatToIdr(item.price));
            buttonEl.addEventListener('click', () => openPaymentModal(item));
            fragment.appendChild(clone);
        }
        container.appendChild(fragment);
        safeSetText(countInfoEl, `${items.length} item ditemukan`);
    }

    function renderHomeList() {
        const query = state.home.searchQuery.toLowerCase();
        const homeCatKey = state.allCatalogData.length > 0 ? state.allCatalogData[0].catKey : null;
        const items = homeCatKey ? state.allCatalogData.filter(x => x.catKey === homeCatKey && (query === '' || x.title.toLowerCase().includes(query) || String(x.price).includes(query))) : [];
        renderList(elements.home.listContainer, elements.home.countInfo, items, 'Tidak ada promo ditemukan.');
    }

    function renderLayananList() {
        const { activeCategory, searchQuery } = state.layanan;
        const query = searchQuery.toLowerCase();
        const items = state.allCatalogData.filter(x => x.catKey === activeCategory && (query === '' || x.title.toLowerCase().includes(query) || String(x.price).includes(query)));
        renderList(elements.layanan.listContainer, elements.layanan.countInfo, items, 'Tidak ada hasil ditemukan.');
    }

    async function loadCatalog() {
        [elements.home.errorContainer, elements.layanan.errorContainer].forEach(el => el.style.display = 'none');
        showSkeleton(elements.home.listContainer, elements.skeletonItemTemplate, 6);
        showSkeleton(elements.layanan.listContainer, elements.skeletonItemTemplate, 6);
        try {
            const res = await fetch(getSheetUrl(config.sheets.katalog.name));
            if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
            const text = await res.text();
            state.allCatalogData = parseGvizPairs(text);
            if (state.allCatalogData.length === 0) throw new Error('Data is empty or format is incorrect.');
            buildLayananCategorySelect(state.allCatalogData);
            renderHomeList();
            renderLayananList();
        } catch (err) {
            console.error('Failed to load catalog:', err);
            const errorMessage = 'Oops, terjadi kesalahan. Silakan coba lagi nanti.';
            showError(elements.home.listContainer, elements.home.errorContainer, errorMessage);
            showError(elements.layanan.listContainer, elements.layanan.errorContainer, errorMessage);
        }
    }

    function normalizeStatus(rawStatus) {
        const s = String(rawStatus || '').trim().toLowerCase();
        if (['success', 'selesai', 'berhasil', 'done'].includes(s)) return 'success';
        if (['progress', 'proses', 'diproses', 'processing'].includes(s)) return 'progress';
        if (['failed', 'gagal', 'dibatalkan', 'cancel', 'error'].includes(s)) return 'failed';
        return 'pending';
    }

    function filterPreorderData() {
        const query = elements.preorder.searchInput.value.trim().toLowerCase();
        const statusFilter = elements.preorder.statusSelect.value;
        const currentMode = state.preorder.displayMode;
        return state.preorder.allData.filter(item => {
            const status = normalizeStatus(item[currentMode === 'detailed' ? 6 : 2]);
            if (statusFilter !== 'all' && status !== statusFilter) return false;
            if (currentMode === 'detailed') {
                return (item[3] || '').toLowerCase().includes(query) || (item[5] || '').toLowerCase().includes(query) || (item[7] || '').toLowerCase().includes(query);
            } else {
                return (item[0] || '').toLowerCase().includes(query) || (item[1] || '').toLowerCase().includes(query);
            }
        });
    }

    function updatePreorderPagination(currentPage, totalPages) {
        elements.preorder.prevBtn.disabled = currentPage <= 1;
        elements.preorder.nextBtn.disabled = currentPage >= totalPages;
        safeSetText(elements.preorder.pageInfo, totalPages > 0 ? `Hal ${currentPage} dari ${totalPages}` : '');
    }

    function createPreorderCard(item) {
        const card = createElement('article');
        if (state.preorder.displayMode === 'detailed') {
            const [tglOrder, estPengiriman, , product, bulan, name, statusRaw] = item;
            const status = normalizeStatus(statusRaw);
            const details = [{ label: 'TGL ORDER', value: tglOrder }, { label: 'BULAN', value: bulan }];
            const hasDetails = details.some(d => d.value && String(d.value).trim() !== '');
            if (hasDetails) {
                card.classList.add('clickable');
                card.addEventListener('click', () => card.classList.toggle('expanded'));
            }
            card.className = `card ${hasDetails ? 'clickable' : ''}`;
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="card-name">${name || 'Tanpa Nama'}</div>
                        <div class="card-product">${product || 'N/A'}</div>
                    </div>
                    <div class="status-badge-wrapper">
                        <div class="status-badge ${status}">${(statusRaw || 'Pending').toUpperCase()}</div>
                        ${hasDetails ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="expand-indicator"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>` : ''}
                    </div>
                </div>
                ${estPengiriman ? `<div class="card-date">Estimasi Pengiriman: ${estPengiriman} 20:00 WIB</div>` : ''}
                ${hasDetails ? `<div class="card-details"><div class="details-grid">${details.filter(d => d.value && String(d.value).trim() !== '').map(d => `<div class="detail-item"><div class="detail-label">${d.label}</div><div class="detail-value">${d.value}</div></div>`).join('')}</div></div>` : ''}`;
        } else {
            const [orderNum, product, statusRaw] = item;
            const status = normalizeStatus(statusRaw);
            card.className = 'card';
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="card-name">${orderNum || 'Tanpa Nomor'}</div>
                        <div class="card-product">${product || 'N/A'}</div>
                    </div>
                    <div class="status-badge ${status}">${(statusRaw || 'Pending').toUpperCase()}</div>
                </div>`;
        }
        return card;
    }

    function renderPreorderCards() {
        const filtered = filterPreorderData();
        const totalItems = state.preorder.allData.length;
        const { perPage } = state.preorder;
        const { listContainer, total } = elements.preorder;
        const totalText = `${totalItems} total pesanan${filtered.length !== totalItems ? `, ${filtered.length} ditemukan` : ''}`;
        safeSetText(total, totalText);
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
            const card = createPreorderCard(item);
            fragment.appendChild(card);
        });
        listContainer.appendChild(fragment);
        updatePreorderPagination(state.preorder.currentPage, totalPages);
    }

    function sortPreorderData(data, mode) {
        const statusOrder = { progress: 1, pending: 2, success: 3, failed: 4 };
        const statusIndex = mode === 'detailed' ? 6 : 2;
        return data.sort((a, b) => statusOrder[normalizeStatus(a[statusIndex])] - statusOrder[normalizeStatus(b[statusIndex])]);
    }

    async function fetchPreorderData(sheetName) {
        const { listContainer, total } = elements.preorder;
        safeSetText(total, 'Memuat data...');
        showSkeleton(listContainer, elements.skeletonCardTemplate, 5);
        state.preorder.displayMode = sheetName === config.sheets.preorder.name1 ? 'detailed' : 'simple';
        try {
            const res = await fetch(getSheetUrl(sheetName, 'csv'));
            if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
            const text = await res.text();
            let rows = robustCsvParser(text);
            if (rows.length < 2) {
                state.preorder.allData = [];
            } else {
                rows.shift();
                const dataRows = rows.filter(row => row && (row[0] || '').trim() !== '');
                state.preorder.allData = sortPreorderData(dataRows, state.preorder.displayMode);
            }
        } catch (e) {
            state.preorder.allData = [];
            safeSetText(total, 'Gagal memuat data.');
            console.error('Fetch Pre-Order failed:', e);
        } finally {
            state.preorder.currentPage = 1;
            renderPreorderCards();
        }
    }

    function initializePreorder() {
        if (state.preorder.initialized) return;
        const rebound = debounce(() => {
            state.preorder.currentPage = 1;
            renderPreorderCards();
        }, 200);
        const { searchInput, statusSelect, customSelect, prevBtn, nextBtn } = elements.preorder;
        searchInput.addEventListener('input', rebound);
        statusSelect.addEventListener('change', rebound);
        customSelect.options.querySelectorAll('.custom-select-option').forEach(option => {
            option.addEventListener('click', e => {
                e.stopPropagation();
                const selectedValue = e.target.dataset.value;
                const selectedText = e.target.textContent;
                safeSetText(customSelect.value, selectedText);
                document.querySelector('#preorderCustomSelectOptions .custom-select-option.selected')?.classList.remove('selected');
                e.target.classList.add('selected');
                toggleCustomSelect(customSelect.wrapper, false);
                const sheet = selectedValue === '0' ? config.sheets.preorder.name1 : config.sheets.preorder.name2;
                setTimeout(() => fetchPreorderData(sheet), 0);
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

    async function parseAccountsSheet(text) {
        const rows = robustCsvParser(text);
        rows.shift();
        return rows.filter(row => row && row.length >= 5 && row[0]).map(row => ({
            title: row[0] || 'Tanpa Judul',
            price: Number(row[1]) || 0,
            status: row[2] || 'Tersedia',
            description: row[3] || 'Tidak ada deskripsi.',
            images: (row[4] || '').split(',').map(url => url.trim()).filter(Boolean),
        }));
    }

    function populateAccountSelect() {
        const { customSelect, empty } = elements.accounts;
        const { options, value } = customSelect;
        options.innerHTML = '';
        if (state.accounts.data.length === 0) {
            safeSetText(value, 'Tidak ada akun');
            empty.style.display = 'block';
            return;
        }
        safeSetText(value, 'Pilih Akun');
        state.accounts.data.forEach((acc, index) => {
            const el = document.createElement('div');
            el.className = 'custom-select-option';
            el.textContent = acc.title;
            el.dataset.value = index;
            el.setAttribute('role', 'option');
            el.id = `account-opt-${index}`;
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                safeSetText(value, acc.title);
                document.querySelector('#accountCustomSelectOptions .custom-select-option.selected')?.classList.remove('selected');
                el.classList.add('selected');
                toggleCustomSelect(customSelect.wrapper, false);
                setTimeout(() => renderAccount(index), 0);
            });
            options.appendChild(el);
        });
    }

    function updateCarousel() {
        const account = state.accounts.currentAccount;
        if (!account) return;
        const { track, prevBtn, nextBtn, indicators } = elements.accounts.carousel;
        const totalSlides = account.images.length || 1;
        track.style.transform = `translateX(-${state.accounts.currentIndex * 100}%)`;
        prevBtn.disabled = totalSlides <= 1 || state.accounts.currentIndex === 0;
        nextBtn.disabled = totalSlides <= 1 || state.accounts.currentIndex >= totalSlides - 1;
        indicators.querySelectorAll('.indicator-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === state.accounts.currentIndex);
        });
    }

    function renderAccount(index) {
        const { display, empty, price, description, status: statusEl } = elements.accounts;
        const account = state.accounts.data[index];
        state.accounts.currentAccount = account;
        if (!account) {
            display.style.display = 'none';
            empty.style.display = 'block';
            return;
        }
        display.classList.remove('expanded');
        safeSetText(price, formatToIdr(account.price));
        safeSetText(description, account.description);
        safeSetText(statusEl, account.status);
        statusEl.className = 'account-status-badge';
        statusEl.classList.add(account.status.toLowerCase() === 'tersedia' ? 'available' : 'sold');
        const { track, indicators } = elements.accounts.carousel;
        track.innerHTML = '';
        indicators.innerHTML = '';
        if (account.images && account.images.length > 0) {
            account.images.forEach((src, i) => {
                track.insertAdjacentHTML('beforeend', `<div class="carousel-slide"><img src="${src}" alt="Gambar untuk ${account.title}" loading="lazy"></div>`);
                indicators.insertAdjacentHTML('beforeend', `<button class="indicator-dot" data-index="${i}" aria-label="Gambar ${i + 1}"></button>`);
            });
        } else {
            track.insertAdjacentHTML('beforeend', `<div class="carousel-slide"><div style="display:flex;align-items:center;justify-content:center;height:100%;aspect-ratio:16/9;background-color:var(--surface-secondary);color:var(--text-tertiary);">Gambar tidak tersedia</div></div>`);
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

    function initializeCarousel() {
        const { prevBtn, nextBtn, track } = elements.accounts.carousel;
        prevBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (state.accounts.currentIndex > 0) {
                state.accounts.currentIndex--;
                updateCarousel();
            }
        });
        nextBtn.addEventListener('click', e => {
            e.stopPropagation();
            const account = state.accounts.currentAccount;
            if (!account) return;
            if (state.accounts.currentIndex < account.images.length - 1) {
                state.accounts.currentIndex++;
                updateCarousel();
            }
        });
        let touchStartX = 0;
        track.addEventListener('touchstart', e => {
            e.stopPropagation();
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        track.addEventListener('touchend', e => {
            e.stopPropagation();
            const touchEndX = e.changedTouches[0].screenX;
            if (touchEndX < touchStartX - 50) nextBtn.click();
            if (touchEndX > touchStartX + 50) prevBtn.click();
        }, { passive: true });
    }

    async function initializeAccounts() {
        if (state.accounts.initialized) return;
        state.accounts.initialized = true;
        const { customSelect, error, empty, display, buyBtn, offerBtn } = elements.accounts;
        error.style.display = 'none';
        customSelect.wrapper.classList.add('is-loading');
        try {
            const res = await fetch(getSheetUrl(config.sheets.accounts.name, 'csv'));
            if (!res.ok) throw new Error(`Network error: ${res.statusText}`);
            const text = await res.text();
            state.accounts.data = await parseAccountsSheet(text);
            populateAccountSelect();
        } catch (err) {
            console.error('Fetch Accounts failed:', err);
            showError(null, error, 'Gagal memuat data akun. Coba lagi nanti.');
            empty.style.display = 'none';
            safeSetText(customSelect.value, 'Gagal memuat');
        } finally {
            customSelect.wrapper.classList.remove('is-loading');
        }
        display.addEventListener('click', e => {
            if (!e.target.closest('.action-btn, .carousel-btn, .indicator-dot')) {
                display.classList.toggle('expanded');
            }
        });
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
        offerBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (state.accounts.currentAccount) {
                const text = `Halo, saya tertarik untuk menawar Akun Game: ${state.accounts.currentAccount.title}`;
                window.open(`https://wa.me/${config.waNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
            }
        });
        initializeCarousel();
    }

    function toggleSidebar(forceOpen) {
        const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !document.body.classList.contains('sidebar-open');
        document.body.classList.toggle('sidebar-open', isOpen);
        elements.sidebar.burger.classList.toggle('active', isOpen);
        elements.sidebar.burger.setAttribute('aria-expanded', isOpen);
    }

    function setMode(nextMode) {
        const currentView = document.querySelector('.view-section.active');
        const nextView = elements.views[nextMode];
        if (!nextView || (currentView && currentView.id === nextView.id)) return;
        if (currentView) currentView.classList.remove('active');
        nextView.classList.add('active');
        elements.sidebar.links.forEach(link => {
            const isCurrent = link.dataset.mode === nextMode;
            link.classList.toggle('active', isCurrent);
            if (isCurrent) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
        if (window.innerWidth < 769) {
            toggleSidebar(false);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (nextMode === 'preorder' && !state.preorder.initialized) {
            initializePreorder();
        }
        if (nextMode === 'accounts' && !state.accounts.initialized) {
            initializeAccounts();
        }
    }

    function handleNavigation(event) {
        const hash = window.location.hash;
        let mode = hash.substring(1);
        if (!Object.keys(elements.views).includes(mode)) {
            mode = 'home';
        }
        if (mode === 'donasi') {
            window.open('https://saweria.co/playpal', '_blank', 'noopener');
            if (event) window.history.back();
            return;
        }
        setMode(mode);
    }

    function initializeNavigation() {
        elements.sidebar.burger?.addEventListener('click', () => toggleSidebar());
        elements.sidebar.overlay?.addEventListener('click', () => toggleSidebar(false));
        elements.sidebar.links.forEach(link => {
            link.addEventListener('click', e => {
                const mode = link.dataset.mode;
                if (mode) {
                    if (mode === 'donasi') {
                        e.preventDefault();
                        window.open('https://saweria.co/playpal', '_blank', 'noopener');
                    }
                }
            });
        });
        window.addEventListener('hashchange', handleNavigation);
        handleNavigation();
    }

    function initializeApp() {
        initTheme();
        initializeNavigation();
        initializeModal();
        initializeCustomSelects();
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener('click', toggleTheme);
        }
        elements.home.searchInput.addEventListener('input', debounce(e => {
            state.home.searchQuery = e.target.value.trim();
            renderHomeList();
        }, 200));
        elements.layanan.searchInput.addEventListener('input', debounce(e => {
            state.layanan.searchQuery = e.target.value.trim();
            renderLayananList();
        }, 200));
        initSmartGestureSystem((e) => {
            const customSelects = [
                elements.layanan.customSelect.wrapper,
                elements.preorder.customSelect.wrapper,
                elements.accounts.customSelect.wrapper
            ];
            customSelects.forEach(wrapper => {
                if (wrapper.classList.contains('open') && !wrapper.contains(e.target)) {
                    toggleCustomSelect(wrapper, false);
                }
            });
        });
        loadCatalog();
    }

    document.addEventListener('DOMContentLoaded', initializeApp);

})();
