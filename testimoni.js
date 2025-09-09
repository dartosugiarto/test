/* Testimoni: pakai mesin yang sama dengan Perpustakaan (getSheetUrl + robustCsvParser) */
(function () {
  'use strict';

  const SHEET_NAME = 'Sheet7'; // A: Nama, B: MediaURL, (opsional C: Teks/komentar)
  let testiLoaded = false;

  async function initializeTestimonials() {
    if (testiLoaded) return;
    testiLoaded = true;

    const container = document.getElementById('testimonialGrid');
    const errorEl   = document.getElementById('testimonialError');
    if (!container) return;

    container.innerHTML = '<div class="empty">Memuat…</div>';
    if (errorEl) errorEl.style.display = 'none';

    try {
      const res = await fetch(getSheetUrl(SHEET_NAME, 'csv'));
      if (!res.ok) throw new Error(res.statusText);
      const text = await res.text();

      // gunakan parser yang sama dengan Perpustakaan
      const rows = robustCsvParser(text);
      rows.shift(); // header

      // mapping ke struktur "book-card" Perpustakaan
      const items = rows
        .filter(r => r && (r[1] || r[0]))
        .map(r => ({
          title: (r[2] || r[0] || 'Testimoni').trim(), // pakai komentar jika ada, else nama
          coverUrl: (r[1] || '').trim(),               // gambar screenshot
          linkUrl: (r[1] || '').trim(),                // klik = buka gambar
        }))
        .filter(x => x.coverUrl);

      renderTestimonialGrid(items);
    } catch (err) {
      console.error('Failed to load testimonials:', err);
      container.innerHTML = '';
      if (errorEl) {
        errorEl.textContent = 'Gagal memuat testimoni. Coba lagi nanti.';
        errorEl.style.display = 'block';
      }
    }

    function renderTestimonialGrid(items) {
      if (!items || items.length === 0) {
        container.innerHTML = '<div class="empty">Belum ada testimoni.</div>';
        return;
      }
      container.innerHTML = '';
      const frag = document.createDocumentFragment();
      items.forEach(x => {
        const card = document.createElement('a');
        card.className = 'book-card';   // kelas yang dipakai Perpustakaan
        card.href = x.linkUrl;
        card.target = '_blank';
        card.rel = 'noopener';
        card.innerHTML = `
          <img src="${x.coverUrl}" alt="${x.title}" class="cover" loading="lazy"
               referrerpolicy="no-referrer" crossorigin="anonymous"
               onerror="this.onerror=null; this.src='logo.jpeg'; this.style.objectFit='contain';">
          <div class="overlay"></div>
          <div class="title">${x.title}</div>
        `;
        frag.appendChild(card);
      });
      container.appendChild(frag);
    }
  }

  // Aktifkan view Testimoni & load saat dipilih
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

  // Hook ke setMode yang sudah ada di script.js
  const originalSetMode = window.setMode;
  window.setMode = function(nextMode) {
    if (typeof originalSetMode === 'function') {
      try { originalSetMode(nextMode); } catch (_) {}
    }
    if (nextMode === 'testimoni') {
      activateTestimoniView();
      initializeTestimonials();
    }
  };

  // Listener klik langsung pada item menu Testimoni
  document.addEventListener('click', function(e){
    const link = e.target.closest('.sidebar-nav .nav-item[data-mode="testimoni"]');
    if (!link) return;
    e.preventDefault();
    window.setMode('testimoni');
  });

})();
