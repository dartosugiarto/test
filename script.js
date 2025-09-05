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

  // Cache DOM Elements
  const elements = {
    sidebar: {
      nav: document.getElementById('sidebarNav'),
      overlay: document.getElementById('sidebarOverlay'),
      burger: document.getElementById('burgerBtn'),
      links: document.querySelectorAll('.sidebar-nav .nav-item'),
    },
    paymentModal: {
      modal: document.getElementById('paymentModal'),
      closeBtn: document.getElementById('closeModalBtn'),
      itemName: document.getElementById('modalItemName'),
      itemPrice: document.getElementById('modalItemPrice'),
      optionsContainer: document.getElementById('paymentOptionsContainer'),
      fee: document.getElementById('modalFee'),
      total: document.getElementById('modalTotal'),
      waBtn: document.getElementById('continueToWaBtn'),
    },
    home: {
        flashSaleGrid: document.getElementById('flashSaleGrid'),
        popularGamesGrid: document.getElementById('popularGamesGrid')
    }
  };

  function initializeApp() {
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
    
    elements.paymentModal.closeBtn.addEventListener('click', closePaymentModal);
    elements.paymentModal.modal.addEventListener('click', e => { if (e.target === elements.paymentModal.modal) closePaymentModal(); });

    loadCatalog();
  }
  
  function getSheetUrl(sheetName, format = 'csv') {
    const baseUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq`;
    const encodedSheetName = encodeURIComponent(sheetName);
    return `${baseUrl}?tqx=out:${format}&sheet=${encodedSheetName}`;
  }

  function formatToIdr(value) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }
  function toggleSidebar(forceOpen) {
    const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open', isOpen);
    elements.sidebar.burger.classList.toggle('active', isOpen);
  }

  function setMode(nextMode) {
    if (nextMode === 'donasi') {
      window.open('https://saweria.co/playpal', '_blank', 'noopener');
      return;
    }
    document.querySelector('.view-section.active')?.classList.remove('active');
    const nextView = document.getElementById(`view${nextMode.charAt(0).toUpperCase() + nextMode.slice(1)}`);
    if(nextView) nextView.classList.add('active'); else document.getElementById('viewHome').classList.add('active');

    elements.sidebar.links.forEach(link => {
      link.classList.toggle('active', link.dataset.mode === nextMode);
    });
    if (window.innerWidth < 769) {
      toggleSidebar(false);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function robustCsvParser(text) {
    const normalizedText = text.trim().replace(/\r\n/g, '\n');
    const rows = []; let currentRow = []; let currentField = ''; let inQuotedField = false;
    for (let i = 0; i < normalizedText.length; i++) {
      const char = normalizedText[i];
      if (inQuotedField) {
        if (char === '"') {
          if (i + 1 < normalizedText.length && normalizedText[i + 1] === '"') { currentField += '"'; i++; } else { inQuotedField = false; }
        } else { currentField += char; }
      } else {
        if (char === '"') { inQuotedField = true; }
        else if (char === ',') { currentRow.push(currentField.trim()); currentField = ''; }
        else if (char === '\n') { currentRow.push(currentField.trim()); rows.push(currentRow); currentRow = []; currentField = ''; }
        else { currentField += char; }
      }
    }
    currentRow.push(currentField.trim()); rows.push(currentRow);
    return rows;
  }

  async function loadCatalog() { 
    if (catalogFetchController) catalogFetchController.abort();
    catalogFetchController = new AbortController();
    
    try { 
      const res = await fetch(getSheetUrl(config.sheets.katalog.name, 'csv'), { signal: catalogFetchController.signal }); 
      if (!res.ok) throw new Error(`Network error: ${res.statusText}`); 
      
      const text = await res.text(); 
      const rows = robustCsvParser(text);
      rows.shift(); // Remove header row

      allCatalogData = rows.map(row => ({
          title: row[0] || 'Tanpa Judul',
          price: Number(row[1]) || 0,
          category: row[2] || 'Lainnya',
          imageUrl: row[3] || 'https://placehold.co/300x400/475569/FFFFFF?text=No+Image'
      })).filter(item => item.title && item.price > 0);

      if (allCatalogData.length === 0) throw new Error('Data katalog kosong atau format salah.'); 
      
      renderHomePage();

    } catch (err) { 
      if (err.name === 'AbortError') return;
      console.error('Gagal memuat katalog:', err); 
      elements.home.flashSaleGrid.innerHTML = `<p style="color: var(--text-tertiary);">Gagal memuat data.</p>`;
      elements.home.popularGamesGrid.innerHTML = `<p style="color: var(--text-tertiary);">Gagal memuat data.</p>`;
    } 
  }

  function renderHomePage() {
      // 1. Render Flash Sale
      const flashSaleItems = allCatalogData.filter(item => item.category.toLowerCase() === 'flash sale').slice(0, 2);
      elements.home.flashSaleGrid.innerHTML = ''; // Clear skeleton
      if(flashSaleItems.length > 0) {
        flashSaleItems.forEach(item => {
            const card = document.createElement('a');
            card.className = 'flash-sale-card';
            card.href = '#';
            card.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.title}">
                <div class="flash-sale-details">
                    <h3>${item.category}</h3>
                    <p>${item.title}</p>
                    <div class="flash-sale-footer">
                    <div class="countdown-timer" data-end-time="2025-12-31T23:59:59">00:00:00</div>
                    <div class="discount-badge">-10%</div>
                    </div>
                </div>`;
            card.addEventListener('click', (e) => {
                e.preventDefault();
                openPaymentModal(item);
            });
            elements.home.flashSaleGrid.appendChild(card);
        });
        initializeCountdownTimers();
      } else {
        elements.home.flashSaleGrid.innerHTML = `<p style="color: var(--text-tertiary);">Tidak ada flash sale saat ini.</p>`;
      }

      // 2. Render Game Populer
      const popularGamesData = allCatalogData.filter(item => item.category.toLowerCase() !== 'flash sale');
      const uniqueGames = [...new Map(popularGamesData.map(item => [item.category, item])).values()];
      
      elements.home.popularGamesGrid.innerHTML = ''; // Clear skeleton
      if(uniqueGames.length > 0) {
        uniqueGames.forEach(game => {
          const card = document.createElement('a');
          card.className = 'game-card';
          card.href = '#'; // Nanti bisa diarahkan ke halaman kategori
          card.innerHTML = `
            <img src="${game.imageUrl}" alt="${game.category}">
            <div class="game-card-overlay">
                <h3>${game.category}</h3>
            </div>
          `;
          elements.home.popularGamesGrid.appendChild(card);
        });
      } else {
        elements.home.popularGamesGrid.innerHTML = `<p style="color: var(--text-tertiary);">Tidak ada game ditemukan.</p>`;
      }
  }

  function initializeCountdownTimers() {
    const timers = document.querySelectorAll('.countdown-timer');
    timers.forEach(timer => {
      const endTime = new Date(timer.dataset.endTime).getTime();
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTime - now;
        if (distance < 0) {
          clearInterval(interval);
          timer.textContent = "WAKTU HABIS";
          return;
        }
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        timer.textContent = ('0' + hours).slice(-2) + ":" + ('0' + minutes).slice(-2) + ":" + ('0' + seconds).slice(-2);
      }, 1000);
    });
  }

  // Fungsi-fungsi Modal (Tidak Diubah)
  function openPaymentModal(item) {
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
  }

  function closePaymentModal() {
    elements.paymentModal.modal.classList.remove('visible');
    setTimeout(() => {
      elements.paymentModal.modal.style.display = 'none';
      currentSelectedItem = null;
    }, 200);
  }
  
  function calculateFee(price, option) { if (option.feeType === 'fixed') return option.value; if (option.feeType === 'percentage') return Math.ceil(price * option.value); return 0; }
  
  function updatePriceDetails() {
    const selectedOptionId = document.querySelector('input[name="payment"]:checked')?.value;
    if (!selectedOptionId || !currentSelectedItem) return;
    const selectedOption = config.paymentOptions.find(opt => opt.id === selectedOptionId);
    if (!selectedOption) return;
    const price = currentSelectedItem.price; const fee = calculateFee(price, selectedOption); const total = price + fee;
    elements.paymentModal.fee.textContent = formatToIdr(fee);
    elements.paymentModal.total.textContent = formatToIdr(total);
    updateWaLink(selectedOption, fee, total);
  }

  function updateWaLink(option, fee, total) {
    const { category = "Produk", title, price } = currentSelectedItem;
    const text = [ config.waGreeting, `› Kategori: ${category}`, `› Item: ${title}`, `› Pembayaran: ${option.name}`, `› Harga: ${formatToIdr(price)}`, `› Fee: ${formatToIdr(fee)}`, `› Total: ${formatToIdr(total)}`].join('\n');
    elements.paymentModal.waBtn.href = `https://wa.me/${config.waNumber}?text=${encodeURIComponent(text)}`;
  }
  
  document.addEventListener('DOMContentLoaded', initializeApp);
})();
