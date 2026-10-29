(function () {
  'use strict';

  // A connector must be embedded directly by Trello. This is a guard, not authentication.
  const hostOrigin = 'https://trello.com';
  function embeddedByTrello() {
    if (window.parent === window || window.location.protocol !== 'https:') return false;
    const ancestors = window.location.ancestorOrigins;
    if (ancestors && ancestors.length) {
      return Array.from(ancestors).every(origin => origin === hostOrigin);
    }
    try { return new URL(document.referrer).origin === hostOrigin; }
    catch (_) { return false; }
  }

  if (!embeddedByTrello()) return;
  function showUnavailable() {
    const status = document.getElementById('status');
    if (status) status.textContent = '表示を開始できません';
  }
  try {
    const sdk = window.TrelloPowerUp;
    if (!sdk || typeof sdk.PostMessageIO !== 'function' ||
        typeof sdk.Promise?.onPossiblyUnhandledRejection !== 'function') {
      throw new Error('Unsupported connection library');
    }
    // The pinned SDK otherwise logs rejected startup promises and IO errors.
    sdk.Promise.onPossiblyUnhandledRejection(function () { showUnavailable(); });
    class QuietIO extends sdk.PostMessageIO {
      constructor(options) { super({ ...options, noisy: false }); }
    }
    // Drop any incoming query/fragment; they are never included in asset URLs.
    const directory = new URL('.', window.location.origin + window.location.pathname).href;
    const handlers = window.CardDisplayAdapter.createHandlers(directory);
    sdk.initialize(handlers, {
      targetOrigin: hostOrigin,
      helpfulStacks: false,
      io: QuietIO
    });
  } catch (_) {
    // Fail closed without copying SDK errors or context to logs or external reporting.
    showUnavailable();
  }
})();
