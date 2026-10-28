/**
 * Ordinary disclosure navigation, not a role="menu" application widget.
 * Link text navigates to its landing page; neighboring buttons toggle panels.
 * Fine-pointer hover is an enhancement, never the only way to reach content.
 */
export function mountSiteChromeHeaders(): void {
  document.querySelectorAll<HTMLElement>('[data-mws-chrome-header]').forEach(header => {
    if (header.dataset.mwsMounted === '1') return;
    header.dataset.mwsMounted = '1';

    const mobileButton = header.querySelector<HTMLButtonElement>('[data-mws-mobile-toggle]');
    const mobileNav = header.querySelector<HTMLElement>('[data-mws-mobile-nav]');
    const items = [...header.querySelectorAll<HTMLElement>('[data-mws-nav-item]')];
    const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');
    const desktopWidth = window.matchMedia('(min-width: 1024px)');
    const closeTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

    const elements = (item: HTMLElement) => ({
      button: item.querySelector<HTMLButtonElement>('[data-mws-disclosure]'),
      panel: item.querySelector<HTMLElement>('[data-mws-panel]'),
    });
    function cancelClose(item: HTMLElement): void {
      const timer = closeTimers.get(item);
      if (timer !== undefined) clearTimeout(timer);
    }
    function setOpen(item: HTMLElement, open: boolean): void {
      cancelClose(item);
      const { button, panel } = elements(item);
      if (!button || !panel) return;
      button.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      item.toggleAttribute('data-mws-open', open);
    }
    function closeAll(except?: HTMLElement): void {
      items.forEach(item => { if (item !== except) setOpen(item, false); });
    }
    function open(item: HTMLElement): void {
      closeAll(item);
      setOpen(item, true);
    }
    function closeMobile(restoreFocus = false): void {
      closeAll();
      if (!mobileButton || !mobileNav) return;
      const wasOpen = mobileButton.getAttribute('aria-expanded') === 'true';
      mobileButton.setAttribute('aria-expanded', 'false');
      mobileButton.setAttribute('aria-label', mobileButton.dataset.openLabel ?? 'Open menu');
      mobileNav.hidden = true;
      if (wasOpen && restoreFocus) mobileButton.focus();
    }

    items.forEach(item => {
      const { button, panel } = elements(item);
      if (!button || !panel) return;
      button.addEventListener('click', () => {
        const next = button.getAttribute('aria-expanded') !== 'true';
        if (next) open(item);
        else setOpen(item, false);
      });
      button.addEventListener('keydown', event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        open(item);
        const links = [...panel.querySelectorAll<HTMLAnchorElement>('a[href]')];
        (event.key === 'ArrowDown' ? links[0] : links[links.length - 1])?.focus();
      });
      // Moving between top-level link, disclosure button and its panel is safe.
      item.addEventListener('focusout', event => {
        const target = event.relatedTarget;
        if (target instanceof Node && !item.contains(target)) setOpen(item, false);
      });
      const desktopItem = !!item.closest('.mws-chrome-desktop-nav');
      if (desktopItem) {
        item.addEventListener('pointerenter', event => {
          if (event.pointerType === 'mouse' && hoverCapable.matches && desktopWidth.matches) open(item);
        });
        item.addEventListener('pointerleave', event => {
          if (event.pointerType !== 'mouse' || !hoverCapable.matches) return;
          cancelClose(item);
          closeTimers.set(item, setTimeout(() => setOpen(item, false), 130));
        });
      }
    });

    mobileButton?.addEventListener('click', () => {
      if (!mobileNav) return;
      const show = mobileButton.getAttribute('aria-expanded') !== 'true';
      closeAll();
      mobileButton.setAttribute('aria-expanded', String(show));
      mobileButton.setAttribute('aria-label',
        show ? (mobileButton.dataset.closeLabel ?? 'Close menu') : (mobileButton.dataset.openLabel ?? 'Open menu'));
      mobileNav.hidden = !show;
      if (show) mobileNav.querySelector<HTMLAnchorElement>('a[href]')?.focus();
    });

    header.addEventListener('click', event => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (link) closeMobile(false);
    });
    document.addEventListener('pointerdown', event => {
      if (event.target instanceof Node && !header.contains(event.target)) closeMobile(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const current = items.find(item => elements(item).button?.getAttribute('aria-expanded') === 'true');
      if (current) {
        event.preventDefault();
        const button = elements(current).button;
        setOpen(current, false);
        button?.focus();
      } else if (mobileButton?.getAttribute('aria-expanded') === 'true') {
        event.preventDefault();
        closeMobile(true);
      }
    });
    desktopWidth.addEventListener('change', () => closeMobile(false));
  });
}
