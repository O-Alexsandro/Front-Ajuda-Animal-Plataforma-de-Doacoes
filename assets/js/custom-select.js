// Lightweight custom select replacement
(function(){
    function createCustomSelect(originalSelect){
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'custom-select__button';
        button.setAttribute('aria-haspopup','listbox');

        const labelSpan = document.createElement('span');
        labelSpan.className = 'custom-select__label';

        const arrow = document.createElement('span');
        arrow.className = 'custom-select__arrow';
        arrow.innerHTML = "<svg viewBox='0 0 24 24' width='16' height='16' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>";

        button.appendChild(labelSpan);
        button.appendChild(arrow);

        const menu = document.createElement('div');
        menu.className = 'custom-select__menu';
        menu.tabIndex = -1;
        menu.setAttribute('role','listbox');
        // start closed
        menu.style.display = 'none';

        // build items
        Array.from(originalSelect.options).forEach((opt, idx)=>{
            const item = document.createElement('div');
            item.className = 'custom-select__item';
            item.setAttribute('role','option');
            item.tabIndex = 0;
            item.dataset.value = opt.value;
            item.textContent = opt.textContent;
            if(opt.disabled) item.setAttribute('aria-disabled','true');
            if(opt.selected){
                item.setAttribute('aria-selected','true');
                labelSpan.textContent = opt.textContent;
            }
            item.addEventListener('click', ()=>{
                selectValue(idx);
                close();
                originalSelect.dispatchEvent(new Event('change', {bubbles:true}));
            });
            item.addEventListener('keydown', (e)=>{
                if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); item.click(); }
                if(e.key === 'ArrowDown'){ e.preventDefault(); focusNext(item); }
                if(e.key === 'ArrowUp'){ e.preventDefault(); focusPrev(item); }
            });
            menu.appendChild(item);
        });

        // fallback label
        if(!labelSpan.textContent) labelSpan.textContent = originalSelect.options[originalSelect.selectedIndex]?.textContent || '';

        // hide original
        originalSelect.classList.add('select-hidden');
        originalSelect.style.display = 'none';

        wrapper.appendChild(button);
        // keep reference to the menu on the wrapper for closing other menus
        wrapper._menu = menu;
        // append menu to body so it doesn't get clipped or interfere with field hover
        document.body.appendChild(menu);

        let __isMobile = document.body.classList.contains('is-mobile');
        function positionMenu(){
            const rect = button.getBoundingClientRect();
            menu.style.boxSizing = 'border-box';
            // mobile: make menu a fixed bottom sheet-like panel
            if(__isMobile){
                menu.style.position = 'fixed';
                menu.style.left = Math.round(window.innerWidth * 0.05) + 'px';
                menu.style.width = Math.round(window.innerWidth * 0.9) + 'px';
                menu.style.bottom = '10px';
                menu.style.top = 'auto';
                menu.style.maxHeight = Math.round(window.innerHeight * 0.6) + 'px';
            } else {
                // desktop: position under the button as before
                menu.style.position = 'absolute';
                menu.style.width = rect.width + 'px';
                menu.style.maxWidth = Math.round(window.innerWidth * 0.9) + 'px';
                menu.style.left = rect.left + window.scrollX + 'px';
                menu.style.top = rect.bottom + window.scrollY + 'px';
                menu.style.bottom = 'auto';
                menu.style.maxHeight = Math.round(window.innerHeight * 0.5) + 'px';
            }
        }

        function open(){
            // close other open custom-selects to avoid multiple open menus
            document.querySelectorAll('.custom-select.open').forEach(function(other){
                if(other !== wrapper){
                    other.classList.remove('open');
                    const otherMenu = other.querySelector('.custom-select__menu');
                    if(otherMenu) otherMenu.style.display = 'none';
                }
            });
            wrapper.classList.add('open');
            // mark body so we can disable interactions/hover on underlying fields
            document.body.classList.add('menu-open');
            positionMenu();
            menu.style.display = 'block';
            // focus first selected or first item
            const sel = menu.querySelector("[aria-selected='true']") || menu.querySelector('.custom-select__item');
            if(sel) sel.focus();
            document.addEventListener('click', onDocClick);
            document.addEventListener('keydown', onDocKey);
            window.addEventListener('resize', positionMenu);
            window.addEventListener('scroll', positionMenu, true);
        }
        function close(){
            wrapper.classList.remove('open');
            menu.style.display = 'none';
            // remove marker so underlying fields react normally
            document.body.classList.remove('menu-open');
            document.removeEventListener('click', onDocClick);
            document.removeEventListener('keydown', onDocKey);
            window.removeEventListener('resize', positionMenu);
            window.removeEventListener('scroll', positionMenu, true);
            // remove mobile listener when closing
            try{ window.removeEventListener('mobilechange', onMobileChange); }catch(e){}
            button.focus();
        }
        function toggle(){ wrapper.classList.contains('open') ? close() : open(); }

        function onDocClick(e){ if(!wrapper.contains(e.target) && !menu.contains(e.target)) close(); }
        function onDocKey(e){ if(e.key === 'Escape') close(); }

        function selectValue(index){
            const options = originalSelect.options;
            const items = menu.querySelectorAll('.custom-select__item');
            if(index < 0 || index >= options.length) return;
            // update original
            originalSelect.selectedIndex = index;
            // update items
            items.forEach(it => it.removeAttribute('aria-selected'));
            const selectedItem = items[index];
            selectedItem.setAttribute('aria-selected','true');
            // update label
            labelSpan.textContent = selectedItem.textContent;
            // set value
            originalSelect.value = selectedItem.dataset.value;
        }

        function focusNext(curr){
            const items = Array.from(menu.querySelectorAll('.custom-select__item'));
            const idx = items.indexOf(curr);
            if(idx < items.length -1) items[idx+1].focus();
        }
        function focusPrev(curr){
            const items = Array.from(menu.querySelectorAll('.custom-select__item'));
            const idx = items.indexOf(curr);
            if(idx > 0) items[idx-1].focus();
        }

        // keyboard support on button
        button.addEventListener('click', (e)=>{ e.preventDefault(); toggle(); });
        button.addEventListener('keydown', (e)=>{
            if(e.key === 'ArrowDown'){ e.preventDefault(); open(); }
            if(e.key === 'ArrowUp'){ e.preventDefault(); open(); }
            if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); }
        });

        // sync if original select changed programmatically
        originalSelect.addEventListener('change', ()=>{
            const sel = originalSelect.selectedIndex;
            const items = menu.querySelectorAll('.custom-select__item');
            items.forEach(it=> it.removeAttribute('aria-selected'));
            if(items[sel]){
                items[sel].setAttribute('aria-selected','true');
                labelSpan.textContent = items[sel].textContent;
            }
        });

        // listen for mobile change events so we can switch positioning behavior
        function onMobileChange(e){ __isMobile = !!(e && e.detail && e.detail.isMobile); positionMenu(); }
        window.addEventListener('mobilechange', onMobileChange);

        return {wrapper, open, close};
    }

    function init(){
        const ids = ['categoria','estado','estadoConservacao'];
        ids.forEach(id => {
            const sel = document.getElementById(id);
            if(!sel) return;
            // don't initialize twice
            if(sel.dataset.customized) return;
            sel.dataset.customized = '1';
            const comp = createCustomSelect(sel);
            sel.parentNode.insertBefore(comp.wrapper, sel);
        });
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
