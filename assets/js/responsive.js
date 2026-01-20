// Responsive helper: toggles `is-mobile` class and emits `mobilechange` events
(function(){
    function isMobileQuery(){ return window.matchMedia && window.matchMedia('(max-width:480px)').matches; }
    function emit(){
        const isMobile = isMobileQuery();
        try{ document.body.classList.toggle('is-mobile', isMobile); }catch(e){}
        const ev = new CustomEvent('mobilechange', { detail: { isMobile } });
        try{ window.dispatchEvent(ev); }catch(e){}
    }
    function debounce(fn, wait){ let t; return function(){ clearTimeout(t); t = setTimeout(()=> fn.apply(this, arguments), wait); } }
    // emit on load and when resizing
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', emit); else emit();
    window.addEventListener('resize', debounce(emit, 120));
    // adjust open modals when mobile state changes
    function adjustOpenModalsForMobile(isMobile){
        try{
            const openModals = Array.from(document.querySelectorAll('.modal[aria-hidden="false"]'));
            openModals.forEach(modal => {
                const card = modal.querySelector('.modal-card');
                if(!card) return;
                if(isMobile){
                    modal.style.alignItems = 'flex-end';
                    modal.style.padding = '8px';
                    card.style.width = 'calc(100% - 16px)';
                    card.style.maxHeight = '80vh';
                    card.style.borderRadius = '12px 12px 0 0';
                } else {
                    modal.style.alignItems = '';
                    modal.style.padding = '';
                    card.style.width = '';
                    card.style.maxHeight = '';
                    card.style.borderRadius = '';
                }
            });
        }catch(e){}
    }

    window.addEventListener('mobilechange', (ev)=>{ adjustOpenModalsForMobile(!!(ev && ev.detail && ev.detail.isMobile)); });

// Mobile hamburger menu: move `#header-buttons` into a side panel on mobile
;(function(){
    let overlay, panel, hamburgerBtn, originalParent, originalNext;
    function ensureElements(){
        if(overlay) return;
        // inject styles
        const s = document.createElement('style'); s.id = 'mobile-hamburger-styles';
        s.textContent = `
            .mobile-menu-overlay{ position:fixed; inset:0; display:none; z-index:9999; }
            .mobile-menu-overlay.open{ display:block; }
            .mobile-menu-backdrop{ position:absolute; inset:0; background:rgba(0,0,0,0.4); }
            .mobile-menu-panel{ position:fixed; top:0; right:0; height:100vh; width:85%; max-width:340px; background:#fff; box-shadow:-8px 0 24px rgba(0,0,0,0.16); padding:18px; box-sizing:border-box; overflow:auto; transform:translateX(100%); transition:transform .28s ease; }
            .mobile-menu-overlay.open .mobile-menu-panel{ transform:translateX(0); }
            #mobile-hamburger-btn{ background:transparent;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;gap:8px }
            #mobile-hamburger-btn .bar{ display:inline-block;width:20px;height:2px;background:var(--text-color,#222); border-radius:2px; box-shadow:0 6px 0 var(--text-color,#222), 0 -6px 0 var(--text-color,#222); }
            .mobile-menu-close{ background:#fff;border:1px solid #eee;padding:8px;border-radius:8px;cursor:pointer }
        `;
        document.head.appendChild(s);

        // overlay
        overlay = document.createElement('div'); overlay.className = 'mobile-menu-overlay'; overlay.id = 'mobile-menu-overlay'; overlay.setAttribute('aria-hidden','true');
        const backdrop = document.createElement('div'); backdrop.className = 'mobile-menu-backdrop'; overlay.appendChild(backdrop);
        panel = document.createElement('div'); panel.className = 'mobile-menu-panel'; panel.id = 'mobile-menu-panel';
        const close = document.createElement('button'); close.className = 'mobile-menu-close'; close.textContent = 'Fechar'; close.addEventListener('click', ()=> closeMenu());
        panel.appendChild(close);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        backdrop.addEventListener('click', ()=> closeMenu());
    }

    // create default nav items markup when a page doesn't have #header-buttons
    function createDefaultNavItems(){
        const wrap = document.createElement('div'); wrap.className = 'mobile-nav-items';
        wrap.innerHTML = `
            <div class="nav-item" onclick="window.location.href='./homepage.html'">
                <img src="assets/img/homepage/heart.svg" alt="">
                <button type="button" class="nav-btn ">Doações</button>
            </div>
            <div class="nav-item" onclick="window.location.href='./historico.html'">
                <img src="assets/img/homepage/history.svg" alt="">
                <button type="button" class="nav-btn">Histórico</button>
            </div>
            <div class="nav-item" onclick="window.location.href='./adicionar.html'">
                <img src="assets/img/homepage/add.svg" alt="">
                <button type="button" class="nav-btn">Adicionar</button>
            </div>
            <div class="nav-item" onclick="window.location.href='./chat.html'">
                <img src="assets/img/homepage/chat.svg" alt="">
                <button type="button" class="nav-btn">Chat</button>
            </div>
            <div class="nav-item" onclick="window.location.href='./perfil.html'">
                <img src="assets/img/homepage/user.svg" alt="">
                <button type="button" class="nav-btn">Perfil</button>
            </div>
            <div class="nav-item">
                <button type="button" class="logout-btn">Logout</button>
            </div>
        `;
        return wrap;
    }

    // populate panel with a single set of nav items (clear previous ones to avoid duplicates)
    function populatePanelNav(){
        if(!panel) return;
        // remove previous nav-related nodes except the close button
        try{
            const toRemove = panel.querySelectorAll('#header-buttons-clone, .mobile-nav-items, .mobile-nav-clone, .nav-item');
            toRemove.forEach(n => {
                if(n && n.classList && n.classList.contains('mobile-menu-close')) return;
                n.remove();
            });
        }catch(e){}

        const hb = document.getElementById('header-buttons');
        if(hb){
            try{
                const hbClone = hb.cloneNode(true);
                hbClone.id = 'header-buttons-clone';
                hbClone.classList.add('mobile-nav-clone');
                panel.appendChild(hbClone);
            }catch(e){
                // fallback to defaults
                panel.appendChild(createDefaultNavItems());
            }
        } else {
            panel.appendChild(createDefaultNavItems());
        }

        try{ ensurePanelNavCompleteness(); }catch(e){}
    }

    // ensure panel contains each canonical nav item (avoid duplicates)
    function ensurePanelNavCompleteness(){
        if(!panel) return;
        const items = [
            { label: 'Doações', href: './homepage.html', img: 'assets/img/homepage/heart.svg' },
            { label: 'Histórico', href: './historico.html', img: 'assets/img/homepage/history.svg' },
            { label: 'Adicionar', href: './adicionar.html', img: 'assets/img/homepage/add.svg' },
            { label: 'Chat', href: './chat.html', img: 'assets/img/homepage/chat.svg' },
            { label: 'Perfil', href: './perfil.html', img: 'assets/img/homepage/user.svg' },
            { label: 'Logout', href: null, img: null }
        ];

        function hasLabel(lbl){
            // check any button text inside the panel (covers both .nav-btn and .logout-btn)
            const btns = Array.from(panel.querySelectorAll('button'));
            return btns.some(b => (b.textContent||'').trim() === lbl);
        }

        const hb = document.getElementById('header-buttons');

        items.forEach(it => {
            if(hasLabel(it.label)) return; // already present

            // try to clone from original header-buttons if available
            if(hb){
                const candidate = Array.from(hb.querySelectorAll('.nav-item')).find(n => {
                    const b = n.querySelector('.nav-btn'); return b && (b.textContent||'').trim() === it.label;
                });
                if(candidate){ panel.appendChild(candidate.cloneNode(true)); return; }
            }

            // otherwise create a new item
            const wrap = document.createElement('div'); wrap.className = 'nav-item';
            if(it.href) wrap.setAttribute('onclick', `window.location.href='${it.href}'`);
            if(it.img){ const im = document.createElement('img'); im.src = it.img; wrap.appendChild(im); }
            const btn = document.createElement('button'); btn.type = 'button'; btn.className = (it.label === 'Logout' ? 'logout-btn' : 'nav-btn'); btn.textContent = it.label;
            wrap.appendChild(btn);
            panel.appendChild(wrap);
        });
    }

    function openMenu(){ if(!overlay) return; overlay.classList.add('open'); overlay.setAttribute('aria-hidden','false'); }
    function closeMenu(){ if(!overlay) return; overlay.classList.remove('open'); overlay.setAttribute('aria-hidden','true'); }

    function enableHamburger(){
        try{
            ensureElements();
            // locate header (id or semantic)
            const header = document.getElementById('header') || document.querySelector('header');
            if(!header) return;

            // create a compact mobile header that will replace the visible header on small screens
            let mobileHeader = document.getElementById('mobile-header');
            if(!mobileHeader){
                mobileHeader = document.createElement('div');
                mobileHeader.id = 'mobile-header';
                mobileHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;gap:12px;background:var(--mobile-header-bg,#fff);box-shadow:0 1px 0 rgba(0,0,0,0.04);z-index:10000';

                // hamburger button
                hamburgerBtn = document.createElement('button'); hamburgerBtn.id = 'mobile-hamburger-btn'; hamburgerBtn.type = 'button'; hamburgerBtn.setAttribute('aria-label','Abrir menu');
                const bar = document.createElement('span'); bar.className = 'bar'; hamburgerBtn.appendChild(bar);
                hamburgerBtn.addEventListener('click', ()=> openMenu());

                // try to clone a logo from header if present
                const logo = header.querySelector('img');
                let logoClone = null;
                if(logo){ logoClone = logo.cloneNode(true); logoClone.style.maxHeight = '36px'; logoClone.style.display = 'block'; }

                // title/placeholder container
                const titleWrap = document.createElement('div'); titleWrap.style.flex = '1'; titleWrap.style.display = 'flex'; titleWrap.style.alignItems = 'center';
                if(logoClone) titleWrap.appendChild(logoClone);

                mobileHeader.appendChild(hamburgerBtn);
                mobileHeader.appendChild(titleWrap);

                // insert mobile header before main container (at top of body)
                document.body.insertBefore(mobileHeader, document.body.firstChild);
            } else {
                hamburgerBtn = document.getElementById('mobile-hamburger-btn');
                if(hamburgerBtn && !hamburgerBtn.onclick) hamburgerBtn.addEventListener('click', ()=> openMenu());
            }

            // hide original header visually but keep it in DOM (so event handlers remain attached)
            if(!header.dataset.__origDisplay) header.dataset.__origDisplay = header.style.display || '';
            header.style.display = 'none';

            // populate panel once (clears previous items to prevent duplicates)
            populatePanelNav();
        }catch(e){/* ignore */}
    }

    function disableHamburger(){
        try{
            closeMenu();

            // remove any cloned header-buttons or default mobile nav items from panel
            try{
                if(panel){
                    const clone = panel.querySelector('#header-buttons-clone'); if(clone) clone.remove();
                    const defs = panel.querySelectorAll('.mobile-nav-items'); defs.forEach(n=>n.remove());
                    const clones = panel.querySelectorAll('.mobile-nav-clone'); clones.forEach(n=>{ if(n.id !== 'header-buttons-clone') n.remove(); });
                }
            }catch(e){}

            // restore original header visibility
            const header = document.getElementById('header') || document.querySelector('header');
            if(header && header.dataset && header.dataset.__origDisplay !== undefined){
                header.style.display = header.dataset.__origDisplay || '';
                delete header.dataset.__origDisplay;
            }

            // remove mobile header if present
            const mobileHeader = document.getElementById('mobile-header'); if(mobileHeader) mobileHeader.remove();

            // remove hamburger button (if still present elsewhere)
            const btn = document.getElementById('mobile-hamburger-btn'); if(btn) btn.remove();
            // remove overlay and styles
            const ov = document.getElementById('mobile-menu-overlay'); if(ov){ ov.remove(); }
            const s = document.getElementById('mobile-hamburger-styles'); if(s) s.remove(); overlay = null; panel = null;
        }catch(e){ }
    }

    // respond to mobilechange
    window.addEventListener('mobilechange', (ev)=>{
        const mobile = !!(ev && ev.detail && ev.detail.isMobile);
        if(mobile) enableHamburger(); else disableHamburger();
    });

    // initial run based on current class
    try{ if(document.body.classList.contains('is-mobile')) enableHamburger(); }catch(e){}
})();

})();
