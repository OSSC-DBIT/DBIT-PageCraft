// ── Email Gate ───────────────────────────────────────────────────────────────
// Asks the user for their email the first time they export anything, caches it
// in localStorage, and never asks again on that device. Exposed as window.EmailGate.
//   EmailGate.get()              -> cached email string (or '')
//   EmailGate.require()          -> Promise<string|null> (null if user cancels)
//   EmailGate.gate(selector)     -> intercept clicks on matching export buttons
//   EmailGate.clear()            -> forget the cached email
window.EmailGate = (function () {
  'use strict';
  const KEY = 'dbit_pagecraft_email';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let modal = null;

  function get() {
    try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }
  function set(email) {
    try { localStorage.setItem(KEY, email); } catch (e) { /* ignore */ }
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  function injectModal() {
    if (modal) return modal;
    const style = document.createElement('style');
    style.textContent =
      '.eg-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(3px);' +
      'display:none;align-items:center;justify-content:center;z-index:9999;font-family:"Outfit",sans-serif;}' +
      '.eg-overlay.show{display:flex;}' +
      '.eg-modal{background:#fff;border-radius:16px;padding:28px 26px;width:min(92vw,400px);' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.25);animation:eg-pop .15s ease;}' +
      '@keyframes eg-pop{from{transform:scale(.95);opacity:0}to{transform:scale(1);opacity:1}}' +
      '.eg-modal h3{font-size:1.25rem;font-weight:700;color:#0f172a;margin:0 0 6px;}' +
      '.eg-modal p{font-size:0.88rem;color:#64748b;margin:0 0 18px;line-height:1.45;}' +
      '.eg-input{width:100%;padding:12px 14px;border:1px solid #cbd5e1;border-radius:8px;' +
      'font-size:1rem;font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s;}' +
      '.eg-input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.15);}' +
      '.eg-error{color:#ef4444;font-size:0.8rem;margin-top:8px;min-height:1em;}' +
      '.eg-actions{display:flex;gap:10px;margin-top:18px;}' +
      '.eg-actions button{flex:1;padding:12px;border-radius:8px;font-size:0.95rem;font-weight:600;' +
      'cursor:pointer;font-family:inherit;border:none;transition:all .2s;}' +
      '.eg-ok{background:#4f46e5;color:#fff;}.eg-ok:hover{background:#4338ca;}' +
      '.eg-cancel{background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0;}.eg-cancel:hover{background:#e2e8f0;}';
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'eg-overlay';
    overlay.innerHTML =
      '<div class="eg-modal" role="dialog" aria-modal="true" aria-label="Enter your email">' +
      '<h3>Enter your email</h3>' +
      '<p>Please enter your email to download. We\u2019ll remember it on this device so you won\u2019t be asked again.</p>' +
      '<input type="email" class="eg-input" placeholder="you@example.com" autocomplete="email" />' +
      '<div class="eg-error"></div>' +
      '<div class="eg-actions"><button type="button" class="eg-cancel">Cancel</button>' +
      '<button type="button" class="eg-ok">Continue</button></div></div>';
    document.body.appendChild(overlay);
    modal = {
      overlay: overlay,
      input: overlay.querySelector('.eg-input'),
      error: overlay.querySelector('.eg-error'),
      ok: overlay.querySelector('.eg-ok'),
      cancel: overlay.querySelector('.eg-cancel')
    };
    return modal;
  }

  function require() {
    const cached = get();
    if (cached && EMAIL_RE.test(cached)) return Promise.resolve(cached);

    const m = injectModal();
    return new Promise(resolve => {
      let done = false;
      function finish(val) {
        if (done) return;
        done = true;
        m.overlay.classList.remove('show');
        m.ok.removeEventListener('click', onOk);
        m.cancel.removeEventListener('click', onCancel);
        m.input.removeEventListener('keydown', onKey);
        resolve(val);
      }
      function onOk() {
        const v = m.input.value.trim();
        if (!EMAIL_RE.test(v)) { m.error.textContent = 'Please enter a valid email address.'; m.input.focus(); return; }
        set(v);
        finish(v);
      }
      function onCancel() { finish(null); }
      function onKey(e) {
        if (e.key === 'Enter') { e.preventDefault(); onOk(); }
        else if (e.key === 'Escape') { onCancel(); }
      }
      m.error.textContent = '';
      m.input.value = cached || '';
      m.ok.addEventListener('click', onOk);
      m.cancel.addEventListener('click', onCancel);
      m.input.addEventListener('keydown', onKey);
      m.overlay.classList.add('show');
      setTimeout(() => m.input.focus(), 30);
    });
  }

  // Intercept clicks on export buttons; block until an email is provided, then
  // re-dispatch the original click so the real export handler runs.
  function gate(selector) {
    document.addEventListener('click', function (e) {
      const btn = e.target.closest(selector);
      if (!btn) return;
      if (get() && EMAIL_RE.test(get())) return; // already have email -> allow
      e.preventDefault();
      e.stopImmediatePropagation();
      require().then(email => { if (email) btn.click(); });
    }, true); // capture phase, runs before the button's own handler
  }

  return { get: get, set: set, clear: clear, require: require, gate: gate };
})();
