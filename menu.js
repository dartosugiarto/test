(function (global) {
  const MENU_ITEMS = [
    { id:'toKatalog',  label:'Katalog',         type:'route', value:'katalog' },
    { id:'toPreorder', label:'Lacak Pre-Order', type:'route', value:'preorder' },
    { id:'toAccounts', label:'Akun Game',       type:'route', value:'accounts' },
    { divider:true },
    { id:'film',    label:'Tonton Film (Gratis)',  type:'route', value:'film' },
    { id:'donasi',  label:'Donasi (Saweria)',      type:'link',  href:'https://saweria.co/playpal' },
    { id:'ebook',   label:'E-book',        type:'link', href:'#' },
    { id:'assets',  label:'Asset Editing', type:'link', href:'#' }
  ];

  function renderMenu(container, items, onRoute, closeAll) {
    if (!container) return;
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    items.forEach(it => {
      if (it.divider) {
        const div = document.createElement('div');
        div.style.height = '1px';
        div.style.background = 'var(--separator)';
        div.style.margin = '10px 0';
        frag.appendChild(div);
        return;
      }
      const a = document.createElement('a');
      a.className = 'nav-item';
      a.href = it.type === 'link' ? it.href : '#';
      a.textContent = it.label;
      if (it.type === 'route') {
        a.addEventListener('click', e => { e.preventDefault(); closeAll && closeAll(); onRoute && onRoute(it.value); });
      } else {
        a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
      }
      frag.appendChild(a);
    });
    container.appendChild(frag);
  }

  function init({ menuCat, menuPO, menuAcc, onRoute, closeAll }) {
    renderMenu(menuCat, MENU_ITEMS, onRoute, closeAll);
    renderMenu(menuPO, MENU_ITEMS, onRoute, closeAll);
    renderMenu(menuAcc, MENU_ITEMS, onRoute, closeAll);
    return {
      remove(id){
        const i = MENU_ITEMS.findIndex(m => m.id === id);
        if (i >= 0) {
          MENU_ITEMS.splice(i,1);
          [menuCat, menuPO, menuAcc].forEach(m => renderMenu(m, MENU_ITEMS, onRoute, closeAll));
        }
      },
      add(item){
        MENU_ITEMS.push(item);
        [menuCat, menuPO, menuAcc].forEach(m => renderMenu(m, MENU_ITEMS, onRoute, closeAll));
      },
      insertAt(i,item){
        MENU_ITEMS.splice(i,0,item);
        [menuCat, menuPO, menuAcc].forEach(m => renderMenu(m, MENU_ITEMS, onRoute, closeAll));
      }
    };
  }

  global.MenuModule = { init };
})(window);
