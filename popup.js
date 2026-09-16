/**
 * GreenTab — popup script
 *
 * Drives the "Optimize Page" button: asks the content script on the active
 * tab to run a cleanup pass, and accumulates the results into a session-wide
 * "Session Savings" summary that survives closing the popup (stored in
 * chrome.storage.session so it resets with the browser session).
 */

(() => {
  'use strict';

  const optimizeBtn = document.getElementById('optimizeBtn');
  const optimizeLabel = document.getElementById('optimizeLabel');
  const statsBox = document.getElementById('statsBox');
  const nodesCountEl = document.getElementById('nodesCount');
  const mediaPausedEl = document.getElementById('mediaPaused');
  const lazyLoadedEl = document.getElementById('lazyLoaded');
  const cpuSavedEl = document.getElementById('cpuSaved');

  const STORAGE_KEY = 'greentab.session.v1';
  const MAX_SESSION_CPU = 45; // percentage cap for the estimate

  let session = null;

  const defaultSession = () => ({ nodesCleaned: 0, mediaPaused: 0, lazyLoaded: 0, cpuSaved: 0, hasRun: false });

  /* ---------------- persistence ---------------- */

  async function loadSession() {
    if (session) return session;
    session = defaultSession();
    try {
      const box = await chrome.storage.session.get(STORAGE_KEY);
      const stored = box[STORAGE_KEY];
      if (stored && Number.isFinite(stored.nodesCleaned)) {
        session.nodesCleaned = stored.nodesCleaned;
        session.mediaPaused = Number.isFinite(stored.mediaPaused) ? stored.mediaPaused : 0;
        session.lazyLoaded = Number.isFinite(stored.lazyLoaded) ? stored.lazyLoaded : 0;
        session.cpuSaved = Number.isFinite(stored.cpuSaved) ? stored.cpuSaved : 0;
        session.hasRun = stored.hasRun === true;
      }
    } catch {
      // Storage unavailable (e.g. restricted context) — in-memory session still works.
    }
    return session;
  }

  async function saveSession() {
    if (!session) return;
    try {
      await chrome.storage.session.set({ [STORAGE_KEY]: session });
    } catch {
      // Best effort only.
    }
  }

  /* ---------------- estimates & rendering ---------------- */

  // Rough model: every ~25 cleaned nodes buys ~1% CPU relief, at least 1%
  // per cleanup so the user sees progress even on light pages.
  function estimateCpuDelta(nodes) {
    if (!nodes || nodes <= 0) return 0;
    return Math.min(12, Math.max(1, Math.round(nodes / 25)));
  }

  function refreshStats() {
    nodesCountEl.textContent = String(session.nodesCleaned);
    mediaPausedEl.textContent = String(session.mediaPaused);
    lazyLoadedEl.textContent = String(session.lazyLoaded);
    cpuSavedEl.textContent = `${session.cpuSaved}%`;
    statsBox.hidden = !session.hasRun && session.nodesCleaned === 0 && session.mediaPaused === 0 && session.lazyLoaded === 0;
  }

  /* ---------------- tab messaging ---------------- */

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function requestOptimize(tabId) {
    const payload = { action: 'greentab.optimize' };
    try {
      return await chrome.tabs.sendMessage(tabId, payload);
    } catch {
      // Content script not present yet (e.g. tab opened before install);
      // inject it now, then ask again.
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      return await chrome.tabs.sendMessage(tabId, payload);
    }
  }

  /* ---------------- button behaviour ---------------- */

  let optimizeFailed = false;

  function setBusy(busy) {
    optimizeBtn.disabled = busy;
    if (busy) {
      optimizeLabel.textContent = 'Optimizing…';
    } else if (optimizeLabel.textContent === 'Optimizing…') {
      optimizeLabel.textContent = optimizeFailed ? 'Try another page' : 'Optimize Page';
    }
  }

  async function handleOptimize() {
    const tab = await getActiveTab();
    if (!tab || tab.id === undefined) return;

    setBusy(true);
    optimizeFailed = false;
    try {
      const res = await requestOptimize(tab.id);
      if (!res || !Number.isFinite(res.nodesCleaned)) return;

      // Handle the full response object: all three metrics.
      const nodesAdded = Math.max(0, Math.round(res.nodesCleaned));
      const mediaAdded = Math.max(0, Math.round(res.mediaPaused || 0));
      const lazyAdded = Math.max(0, Math.round(res.lazyLoaded || 0));

      session.hasRun = true;
      session.nodesCleaned += nodesAdded;
      session.mediaPaused += mediaAdded;
      session.lazyLoaded += lazyAdded;
      session.cpuSaved = Math.min(MAX_SESSION_CPU, session.cpuSaved + estimateCpuDelta(nodesAdded));

      await saveSession();
      refreshStats();
    } catch (error) {
      console.error('[GreenTab] Could not optimize this tab.', error);
      optimizeFailed = true;
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- init ---------------- */

  async function init() {
    await loadSession();
    refreshStats();
    optimizeBtn.addEventListener('click', handleOptimize);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();