// ── DBIT PageCraft PWA Helper ─────────────────────────────────────────────────
// Handles:
//   1. Service Worker registration
//   2. "Add to Home Screen" install prompt banner
//   3. SW update notification (new version available toast)

(function () {
  'use strict';

  // ── 1. Register Service Worker ──────────────────────────────────────────────
  if (!('serviceWorker' in navigator)) return; // older browsers - silent exit

  let swRegistration = null;

  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then((reg) => {
      swRegistration = reg;

      // Listen for a new SW waiting to take over (update available)
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });
    })
    .catch((err) => {
      console.warn('[PWA] Service worker registration failed:', err);
    });

  // ── 2. Install Prompt Banner ─────────────────────────────────────────────────
  // Capture the browser's beforeinstallprompt event so we can show it on our
  // own button rather than relying on the browser's default mini-bar.
  let deferredPrompt = null;
  const DISMISSED_KEY = 'dbit_pwa_install_dismissed';

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // prevent automatic mini-bar
    deferredPrompt = e;

    // Don't show if the user already dismissed it this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    // Don't show if already installed as a standalone app
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    showInstallBanner();
  });

  // Hide the banner once the app is installed
  window.addEventListener('appinstalled', () => {
    hideBanner();
    deferredPrompt = null;
  });

  // ── Banner DOM ───────────────────────────────────────────────────────────────
  let banner = null;

  function injectStyles() {
    if (document.getElementById('pwa-styles')) return;
    const style = document.createElement('style');
    style.id = 'pwa-styles';
    style.textContent =
      // Install banner
      '#pwa-install-banner{position:fixed;bottom:0;left:0;right:0;z-index:8888;' +
      'background:#1e3a5f;color:#fff;display:flex;align-items:center;gap:12px;' +
      'padding:14px 18px;box-shadow:0 -4px 24px rgba(0,0,0,0.3);' +
      'transform:translateY(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);' +
      'font-family:"Outfit",sans-serif;}' +
      '#pwa-install-banner.show{transform:translateY(0);}' +
      '#pwa-install-banner img.pwa-banner-icon{width:40px;height:40px;border-radius:10px;flex-shrink:0;}' +
      '#pwa-install-banner .pwa-banner-text{flex:1;min-width:0;}' +
      '#pwa-install-banner .pwa-banner-title{font-weight:700;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '#pwa-install-banner .pwa-banner-sub{font-size:.78rem;opacity:.75;margin-top:1px;}' +
      '#pwa-install-btn{background:#4f46e5;color:#fff;border:none;border-radius:8px;' +
      'padding:9px 18px;font-size:.88rem;font-weight:600;cursor:pointer;' +
      'font-family:inherit;white-space:nowrap;transition:background .2s;}' +
      '#pwa-install-btn:hover{background:#4338ca;}' +
      '#pwa-dismiss-btn{background:none;border:none;color:rgba(255,255,255,0.6);' +
      'font-size:1.25rem;cursor:pointer;padding:4px 8px;line-height:1;flex-shrink:0;}' +
      '#pwa-dismiss-btn:hover{color:#fff;}' +
      // Update toast
      '#pwa-update-toast{position:fixed;top:16px;right:16px;z-index:8888;' +
      'background:#1e3a5f;color:#fff;border-radius:12px;padding:14px 18px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;align-items:center;gap:12px;' +
      'font-family:"Outfit",sans-serif;font-size:.88rem;max-width:320px;' +
      'transform:translateX(120%);transition:transform .35s cubic-bezier(.4,0,.2,1);}' +
      '#pwa-update-toast.show{transform:translateX(0);}' +
      '#pwa-reload-btn{background:#4f46e5;color:#fff;border:none;border-radius:6px;' +
      'padding:7px 14px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;}' +
      '#pwa-reload-btn:hover{background:#4338ca;}';
    document.head.appendChild(style);
  }

  function showInstallBanner() {
    injectStyles();
    if (banner) { banner.classList.add('show'); return; }

    banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML =
      '<img class="pwa-banner-icon" src="/assets/icon-192.png" alt="PageCraft icon">' +
      '<div class="pwa-banner-text">' +
        '<div class="pwa-banner-title">Install DBIT PageCraft</div>' +
        '<div class="pwa-banner-sub">Works offline. Add to your home screen.</div>' +
      '</div>' +
      '<button id="pwa-install-btn" type="button">Install</button>' +
      '<button id="pwa-dismiss-btn" type="button" aria-label="Dismiss">&times;</button>';
    document.body.appendChild(banner);

    // Animate in after paint
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('show')));

    banner.querySelector('#pwa-install-btn').addEventListener('click', () => {
      hideBanner();
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((result) => {
          if (result.outcome === 'accepted') deferredPrompt = null;
        });
      }
    });

    banner.querySelector('#pwa-dismiss-btn').addEventListener('click', () => {
      hideBanner();
      sessionStorage.setItem(DISMISSED_KEY, '1');
    });
  }

  function hideBanner() {
    if (!banner) return;
    banner.classList.remove('show');
    setTimeout(() => { if (banner) banner.remove(); banner = null; }, 400);
  }

  // ── 3. Update Toast ─────────────────────────────────────────────────────────
  function showUpdateToast() {
    injectStyles();
    const toast = document.createElement('div');
    toast.id = 'pwa-update-toast';
    toast.innerHTML =
      '<span>A new version of PageCraft is ready.</span>' +
      '<button id="pwa-reload-btn" type="button">Reload</button>';
    document.body.appendChild(toast);

    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

    toast.querySelector('#pwa-reload-btn').addEventListener('click', () => {
      toast.classList.remove('show');
      // Tell the waiting SW to activate, then reload
      if (swRegistration && swRegistration.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      setTimeout(() => window.location.reload(), 300);
    });
  }

})();
