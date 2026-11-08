// ── Analytics transport ──────────────────────────────────────────────────────
// Posts a generation record to this server's own API (/api/generations). The
// server validates and rate-limits every record, so nothing here is trusted.
// Exposed as window.Analytics.
//   Analytics.log(record) -> Promise<boolean>  (never rejects, silent on failure)
window.Analytics = (function () {
  'use strict';
  const ENDPOINT = '/api/generations';

  function log(record) {
    const payload = Object.assign({}, record || {});
    if (!payload.email && window.EmailGate) payload.email = EmailGate.get() || '';
    if (!navigator.onLine) return Promise.resolve(false);
    try {
      return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        keepalive: true,
      }).then(res => res.ok).catch(() => false);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  return { log: log };
})();
