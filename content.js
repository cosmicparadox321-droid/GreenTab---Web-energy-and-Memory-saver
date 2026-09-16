/**
 * GreenTab — content script
 *
 * Runs on every page (see manifest content_scripts) and reclaims wasted
 * energy/memory by:
 *
 *   1. Removing hidden, non-functional DOM nodes (decorative leftovers,
 *      invisible and unreachable wrappers, etc.).
 *   2. Pausing offscreen, autoplaying (muted) media.
 *   3. Lazy-loading images that sit far below the fold.
 *
 * Safety: focusable / interactive / media / scripting elements are NEVER
 * removed, and anything living inside a toggle container (modal, dropdown,
 * accordion, tooltip, drawer, menu, ...) is left alone so page behaviour
 * is not broken.
 */

(() => {
  'use strict';

  if (!window.chrome || !window.chrome.runtime || !window.chrome.runtime.onMessage) {
    return;
  }

  // Guard against duplicate injection (the popup may re-inject us as a
  // fallback when the content script is not yet present on a tab).
  if (window.__greenTabLoaded) return;
  window.__greenTabLoaded = true;

  // Nodes that must never be discarded: interactive, media or scripting.
  const IMPORTANT_TAGS =
    'a[href],button,input,textarea,select,optgroup,option,datalist,progress,meter,' +
    'iframe,frame,object,embed,video,audio,canvas,script,style,link[rel],' +
    '[tabindex],[contenteditable],[role],[aria-live]';

  // Containers that scripts commonly toggle open/closed; their hidden
  // descendants are usually stateful UI, so we skip everything inside.
  const TOGGLE_HINT =
    /(^|_|-)(modal|dialog|popover|popup|tooltip|dropdown|drop-down|drawer|offcanvas|toast|tabpanel|tab-panel|accordion|collapse|collapsible|menu|sheet|carousel|slider|tabs|toggle|pop-up)/i;

  const state = {
    nodesCleaned: 0,
    mediaPaused: 0,
    lazyLoaded: 0,
  };

  /* ---------------------------------------------------------------- */

  function isHidden(el) {
    if (el.hidden) return true;
    const cs = getComputedStyle(el);
    return cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0';
  }

  function hasImportantContent(el) {
    return el.matches(IMPORTANT_TAGS) || Boolean(el.querySelector(IMPORTANT_TAGS));
  }

  function mayContainVisibleContent(el) {
    // 'visibility' can be overridden to 'visible' by descendants, so a
    // visibility:hidden wrapper may still contain rendered content. Guard
    // against removing it. display:none / hidden / opacity:0 can't be escaped.
    if (getComputedStyle(el).visibility !== 'hidden') return false;
    const descendants = el.querySelectorAll('*');
    for (let i = 0; i < descendants.length; i++) {
      if (getComputedStyle(descendants[i]).visibility === 'visible') return true;
    }
    return false;
  }

  function isInToggleContainer(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const id = String(node.id || '');
      const cls = typeof node.className === 'string' ? node.className : '';
      if (TOGGLE_HINT.test(id) || TOGGLE_HINT.test(cls)) return true;
      node = node.parentElement;
    }
    return false;
  }

  function isTrimCandidate(el) {
    if (el === document.documentElement || el === document.body || el === document.head) return false;
    if (!el.isConnected) return false;
    if (!isHidden(el)) return false;
    if (mayContainVisibleContent(el)) return false;
    if (hasImportantContent(el)) return false;
    if (isInToggleContainer(el)) return false;
    return true;
  }

  function cleanHiddenNodes() {
    // Static snapshot, walked bottom-up so children are accounted for
    // before (possibly) their hidden wrapper parents.
    const all = Array.from(document.querySelectorAll('*'));
    const targets = [];
    for (let i = all.length - 1; i >= 0; i--) {
      if (isTrimCandidate(all[i])) targets.push(all[i]);
    }

    let removed = 0;
    for (const el of targets) {
      if (el.isConnected) {
        el.remove();
        removed++;
      }
    }
    return removed;
  }

  function pauseOffscreenAutoplayMedia() {
    let paused = 0;
    document.querySelectorAll('video, audio').forEach((media) => {
      if (media.paused || media.ended || media.readyState === 0) return;
      if (!media.muted) return; // never disturb audible content
      const rect = media.getBoundingClientRect();
      const isOnScreen =
        rect.bottom > 0 && rect.top < window.innerHeight &&
        rect.right > 0 && rect.left < window.innerWidth;
      if (!isOnScreen) {
        try {
          media.pause();
          paused++;
        } catch {
          /* ignore */
        }
      }
    });
    return paused;
  }

  function lazyLoadDistantImages() {
    let updated = 0;
    document.querySelectorAll('img').forEach((img) => {
      if (img.hasAttribute('loading')) return;
      if (!img.src) return;
      const rect = img.getBoundingClientRect();
      if (rect.top > window.innerHeight + 200) {
        img.setAttribute('loading', 'lazy');
        updated++;
      }
    });
    return updated;
  }

  function runCleanup() {
    const delta = {
      nodesCleaned: cleanHiddenNodes(),
      mediaPaused: pauseOffscreenAutoplayMedia(),
      lazyLoaded: lazyLoadDistantImages(),
    };

    state.nodesCleaned += delta.nodesCleaned;
    state.mediaPaused += delta.mediaPaused;
    state.lazyLoaded += delta.lazyLoaded;

    return {
      ok: true,
      nodesCleaned: delta.nodesCleaned,
      mediaPaused: delta.mediaPaused,
      lazyLoaded: delta.lazyLoaded,
      total: { ...state },
    };
  }

  /* ---------------------------------------------------------------- */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.action === 'greentab.optimize') {
      sendResponse(runCleanup());
    }
  });

  // One gentle automatic pass once the page has loaded.
  const start = () => runCleanup();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();