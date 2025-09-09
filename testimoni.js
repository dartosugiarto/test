/* ==== TESTIMONI (Ultra-Minimal) ==== */
(function () {
  'use strict';

  const SHEET_NAME = 'Sheet7';
  let loaded = false;

  // Buat URL CSV dari Google Sheet yang sama dengan fitur lain
  function getCsvUrl() {
    if (typeof getSheetUrl === 'function') {
      // helper milik script.js kamu
      return getSheetUrl(SHEET_NAME, 'csv');
    }
    // fallback: baca dari window.config.sheetId bila tersedia
    const cfg = window.config || {};
    if (!cfg.sheetId) {
      console.warn('config.sheetId tidak ditemukan. Pastikan script.js men-define-nya.');
      return '';
    }
    const s = encodeURIComponent(SHEET_NAME);
    return `https://docs.google.com/spreadsheets/d/${cfg.sheetId}/gviz/tq?tqx=out:csv&sheet=${s}`;
    // Pastikan spreadsheet share: Anyone with the link (Viewer)
  }

  // Parser CSV sederhana (mendukung kutip ganda)
  function parseCsv(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (c === '"') {
        if (q && n === '"') { cur += '"'; i++; }
        else { q = !q; }
      } else if (c === ',' && !q) {
        row.push(cur); cur = '';
      } else if ((c === '\n' || c === '\r') && !q) {
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); row = []; cur = ''; }
      } else {
        cur += c;
      }
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  async function loadTestimonials() {
    if (loaded) return;
    loaded = true;

    const grid = document.getElementById('testimonialGrid');
    const err  = document.getElementById('testimonialError');
    if (!grid) return;

    grid.innerHTML = '<div class="testi-card">Memuat…</div>';

    try {
      const url = getCsvUrl();
      const res = await fetch(url, { cache: 'no-store' });
      const text = await res.text();
      const rows = parseCsv(text);
      rows.shift(); // header: minimal "Nama,MediaURL" (+ optional "Teks")

      const items = rows
        .map(r => ({ name: (r[0]||'').trim(), media: (r[1]||'').trim(), text: (r[2]||'').trim() }))
        .filter(x => x.media);

      const frag = document.createDocumentFragment();
      items.forEach(x => {
        const fig = document.createElement('figure');
        fig.className = 'testi-card';
        fig.innerHTML = `
          <a class="testi-media" href="${x.media}" target="_blank" rel="noopener">
            <img src="${x.media}" alt="${x.name ? 'Testimoni - ' + x.name : 'Testimoni'}" loading="lazy">
          </a>
          ${x.text ? `<figcaption class="testi-caption">${x.text}</figcaption>` : ''}
        `;
        frag.appendChild(fig);
      });

      grid.innerHTML = '';
      if (items.length) grid.appendChild(frag);
      else grid.innerHTML = '<div class="testi-card">Belum ada testimoni.</div>';
      if (err) err.style.display = 'none';
    } catch (e) {
      console.error('Gagal memuat testimoni:', e);
      grid.innerHTML = '';
      if (err) { err.textContent = 'Gagal memuat testimoni.'; err.style.display = 'block'; }
    }
  }

  // Tunjukkan section Testimoni & load data ketika dipilih dari menu
  function activateTestimoniView() {
    const current = document.querySelector('.view-section.active');
    const next = document.getElementById('viewTestimoni');
    if (current) current.classList.remove('active');
    if (next) next.classList.add('active');

    // sinkronkan highlight nav
    document.querySelectorAll('.sidebar-nav .nav-item')
      .forEach(a => a.classList.toggle('active', a.dataset.mode === 'testimoni'));

    // tutup sidebar di mobile jika terbuka
    if (window.innerWidth < 769) {
      document.body.classList.remove('sidebar-open');
      document.getElementById('burgerBtn')?.classList.remove('active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Hook ke setMode milik script.js tanpa mengubah file aslinya
  const originalSetMode = window.setMode;
  window.setMode = function(nextMode) {
    if (typeof originalSetMode === 'function') {
      try { originalSetMode(nextMode); } catch (_) {}
    }
    if (nextMode === 'testimoni') {
      activateTestimoniView();
      loadTestimonials();
    }
  };

  // Jaga-jaga: kalau ada yang klik menu sebelum script.js attach listener
  document.addEventListener('click', function(e){
    const link = e.target.closest('.sidebar-nav .nav-item[data-mode="testimoni"]');
    if (!link) return;
    e.preventDefault();
    window.setMode('testimoni');
  });

})();
