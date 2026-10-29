(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./model.js') : root.CardDisplayModel);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardDisplayAdapter = api;
})(typeof globalThis === 'object' ? globalThis : this, function (model) {
  'use strict';

  // Supply a fixed deployment directory, never a URL built from card or member data.
  function createHandlers(assetBaseUrl) {
    const parsed = new URL(assetBaseUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        !parsed.pathname.endsWith('/') || parsed.search || parsed.hash) {
      throw new Error('A fixed HTTPS deployment directory without a query or fragment is required.');
    }
    const iconUrl = new URL('priority-dot.svg', parsed).href;
    return {
      'card-badges': async function (t) {
        try {
          const card = await t.card('desc', 'labels', 'due');
          return model.badges(model.fromCard(card), iconUrl);
        } catch (_) {
          return [{ text: '表示を取得できません' }];
        }
      }
    };
  }

  return Object.freeze({ createHandlers: createHandlers });
});
