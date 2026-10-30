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
    return {
      'card-badges': async function (t) {
        try {
          const card = await t.card('desc', 'due');
          return model.badges(model.fromCard(card));
        } catch (_) {
          return [{ text: '表示を取得できません' }];
        }
      },
      'board-buttons': function () {
        return [{
          text: 'タスク一覧',
          condition: 'signedIn',
          callback: function (t) {
            return t.modal({ url: new URL('tasks.html?v=1.2-guide1', parsed.href).href,
              fullscreen: true, title: 'タスク管理一覧 Ver.1.2' });
          }
        }];
      }
    };
  }

  return Object.freeze({ createHandlers: createHandlers });
});
