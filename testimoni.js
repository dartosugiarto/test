/* ==== TESTIMONI (Ultra-Minimal + no-referrer patch) ==== */
(function () {
  'use strict';

  const SHEET_NAME = 'Sheet7';   // A: Nama, B: MediaURL, (opsional C: Teks)
  let loaded = false;

  // URL CSV dari Google Sheet yang sama (gunakan helper getSheetUrl dari script.js jika ada)
  function getCsvUrl() {
    if (typeof getSheetUrl === 'function') return getSheetUrl(SHEET_NAME, 'csv');
    const cfg = window.config || {};
    const id = cfg.sheetId; // script.js kamu sudah mendefinisikan ini
    const s = encodeURIComponent(SHEET_NAME);
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${s}`;
  }

  // Parser CSV sederhana
  function parseCsv(text) {
    const rows=[]; let row=[], cur='', q=false;
    for (let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if (c === '"'){ if (q && n === '"'){cur+='"'; i++;} else { q=!q; } }
      else if (c === ',' && !q){ row.push(cur); cur=''; }
      else if ((c === '\n' || c === '\r') && !q){ if (cur!=='' || row.length){ row.push(cur); rows.push(row); row=[]; cur=''; } }
      else { cur+=c; }
    }
    if (cur!=='' || row.length){ row.push(cur); rows.push(row); }
    return rows;
  }

  // Normalisasi link Drive ke direct (aman kalau bukan Drive)
  function normalizeMediaUrl(u) {
    if (!u) return '';
    try {
      const url = new URL(u);
      if (url.hostname.includes('drive.google.com')) {
        const m = u.match(/\/file\/d\/([^/]+)/);
        const id = m ? m[1] : url.searchParams.get('id');
        if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
      }
    } catch (_) {}
    return u;
  }

  async function loadTestimonials() {
    if (loaded) return;
    loaded = true;

    const grid = document.getElementById('testimonialGrid');
    const err  = document.getElementById('testimonialError');
    if (!grid) return;

    grid.innerHTML = '<div class="testi-card">Memuat…</div>';

    try {
      const res = await fetch(getCsvUrl(), { cache: 'no-store' });
      const text = await res.text();
      const rows = parseCsv(text);
      rows.shift(); // header

      const items = rows
        .map(r => ({ name: (r[0]||'').trim(), media: normalizeMediaUrl((r[1]||'').trim()), text: (r[2]||'').trim() }))
        .filter(x => x.media);

      const frag = document.createDocumentFragment();
      items.forEach(x => {
        const fig = document.createElement('figure');
        fig.className = 'testi-card';
        fig.innerHTML = `
          <a class="testi-media" href="${x.media}" target="_blank" rel="noopener">
            <img
              src="${x.media}"
              alt="${x.name ? 'Testimoni - ' + x.name : 'Testimoni'}"
              loading="lazy"
              referrerpolicy="no-referrer"
              crossorigin="anonymous"
              onerror="this.onerror=null; this.src='logo.jpeg'; this.style.objectFit='contain';"
            >
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

  // Aktifkan view & load saat pilih menu Testimoni
  function activateTestimoniView() {
    const current = document.querySelector('.view-section.active');
    const next = document.getElementById('viewTestimoni');
    if (current) current.classList.remove('active');
    if (next) next.classList.add('active');

    document.querySelectorAll('.sidebar-nav .nav-item')
      .forEach(a => a.classList.toggle('active', a.dataset.mode === 'testimoni'));

    if (window.innerWidth < 769) {
      document.body.classList.remove('sidebar-open');
      document.getElementById('burgerBtn')?.classList.remove('active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Hook ke setMode dari script.js tanpa mengubah file aslinya
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

  // Klik langsung di menu Testimoni (kalau dipanggil sebelum setMode siap)
  document.addEventListener('click', function(e){
    const link = e.target.closest('.sidebar-nav .nav-item[data-mode="testimoni"]');
    if (!link) return;
    e.preventDefault();
    window.setMode('testimoni');
  });

})();
