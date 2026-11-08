// ── Form Auto-Save Helper ────────────────────────────────────────────────────
// Persists form state to localStorage so a refresh / page switch keeps the
// user's data (session-like). Exposed as window.FormCache.
window.FormCache = (function () {
  'use strict';
  function save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* quota / privacy mode */ }
  }
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function clear(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms == null ? 250 : ms); };
  }
  return { save: save, load: load, clear: clear, debounce: debounce };
})();
