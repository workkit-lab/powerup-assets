(function () {
  'use strict';
  const hostOrigin = 'https://trello.com';
  function unavailable() {
    document.getElementById('status').textContent = '一覧を開始できません。Trelloのボードから開き直してください。';
  }
  function embedded() {
    if (window.parent === window || window.location.protocol !== 'https:') return false;
    const ancestors = window.location.ancestorOrigins;
    if (ancestors && ancestors.length) return Array.from(ancestors).every(o => o === hostOrigin);
    try { return new URL(document.referrer).origin === hostOrigin; } catch (_) { return false; }
  }
  if (!embedded()) return;
  try {
    const sdk = window.TrelloPowerUp;
    sdk.Promise.onPossiblyUnhandledRejection(unavailable);
    class QuietIO extends sdk.PostMessageIO {
      constructor(options) { super({ ...options, noisy: false }); }
    }
    const t = sdk.iframe({ targetOrigin: hostOrigin, helpfulStacks: false, io: QuietIO });
    window.TaskListView.start(t);
  } catch (_) { unavailable(); }
})();
