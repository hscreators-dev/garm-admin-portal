// ─── Instant styled tooltips ──────────────────────────────────────────────────
// The portal marks up interactive controls with the native `title` attribute.
// Native title tooltips are slow (~1s delay) and render inconsistently inside
// embedded browser panels (e.g. the VS Code Simple Browser), so they can look
// "not working". This promotes every `title` to a `data-tip` attribute that our
// CSS renders as an instant, on-brand tooltip (see [data-tip] in index.css),
// and removes the native title so there's no doubled/duplicate tooltip.
//
// It's driven by a MutationObserver, so tooltips also work on content React
// renders later (modals, newly added rows). Purely additive — it only touches
// the `title` attribute on real DOM elements; React component props named
// `title` (Modal, Section) never reach the DOM as a title attribute, so they're
// untouched. Safe to run once at startup.

function promote(el: Element) {
  const t = el.getAttribute('title');
  if (t && t.trim() && !el.hasAttribute('data-tip')) {
    el.setAttribute('data-tip', t);
    el.removeAttribute('title'); // avoid the slow native tooltip on top
  }
}

export function initTooltips() {
  if (typeof document === 'undefined') return;
  const scan = (root: ParentNode) => {
    if (root instanceof Element && root.hasAttribute('title')) promote(root);
    root.querySelectorAll?.('[title]').forEach(promote);
  };
  scan(document.body);
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'attributes' && m.target instanceof Element) promote(m.target);
      m.addedNodes.forEach((n) => { if (n instanceof Element) scan(n); });
    }
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });
}
