/** Homepage interactions are local presentation only; workspace routing owns URL state. */
export function mountCosmootHome(root, { reducedMotion = () => false } = {}) {
  if (!root) return;
  const tabs = [...root.querySelectorAll('[data-preview]')];
  const destinations = {
    governance: { label: 'Proposals', action: 'Open governance', href: '#governance' },
    treasury: { label: 'Treasury', action: 'Open treasury', href: '#treasury' },
    delegation: {
      label: 'Delegation',
      action: 'Open Delegation Programme',
      href: '/community-tools/delegation/'
    }
  };
  function selectTab(tab, focus = false) {
    const destination = destinations[tab.dataset.preview];
    if (!destination) return;
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      root.querySelector(`#${item.getAttribute('aria-controls')}`).hidden = !selected;
    }
    root.querySelector('#home-preview-location').textContent = destination.label;
    const link = root.querySelector('#home-panel-open');
    link.setAttribute('href', destination.href);
    link.textContent = `${destination.action} →`;
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[next], true);
    });
  });
  root.querySelectorAll('[data-home-scroll]').forEach((button) => {
    button.addEventListener('click', () => {
      const section = root.querySelector(`#${button.dataset.homeScroll}`);
      if (!section) return;
      section.focus({ preventScroll: true });
      section.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' });
    });
  });
}

if (typeof document !== 'undefined') {
  mountCosmootHome(document.querySelector('#home-view'), {
    reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  });
}
