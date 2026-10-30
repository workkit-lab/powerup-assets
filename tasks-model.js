(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./model.js') : root.CardDisplayModel);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TaskListModel = api;
})(typeof globalThis === 'object' ? globalThis : this, function (display) {
  'use strict';
  const buckets = ['overdue', 'today', 'soon', 'week', 'later', 'unset', 'unknown'];
  const bucketNames = { overdue: '期限超過', today: '本日', soon: '1〜3日以内', week: '4〜7日以内',
    later: '8日以降', unset: '対応期限未設定', unknown: '日付未確認' };
  function dayNumber(date) {
    const value = display.civilDate(date);
    return value ? Date.parse(value.replaceAll('/', '-') + 'T00:00:00Z') / 86400000 : null;
  }
  function today(now) {
    return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric',
      month: '2-digit', day: '2-digit' }).format(now);
  }
  function priority(labels) {
    const values = new Set(); let invalid = false;
    const names = { '優先A': ['A', 'red'], '優先B': ['B', 'yellow'], '優先C': ['C', 'green'] };
    for (const label of labels || []) {
      if (label.name === '優先度要確認') invalid = true;
      const entry = Object.hasOwn(names, label.name) ? names[label.name] : null;
      if (entry) { values.add(entry[0]); if (label.color !== entry[1]) invalid = true; }
    }
    return invalid || values.size > 1 ? 'check' : values.size ? [...values][0] : 'unset';
  }
  function actionDate(due, review) {
    if (due.value === '要確認' || review === '要確認') return { date: null, kind: '未確認', unknown: true };
    const d = due.date, r = review ? review.slice(0, 10) : null;
    if (!d && !r) return { date: null, kind: '未設定', unknown: false };
    if (d && r && d === r) return { date: d, kind: '完了・確認', unknown: false };
    return d && (!r || d < r) ? { date: d, kind: '完了', unknown: false } : { date: r, kind: '確認', unknown: false };
  }
  function bucket(action, currentDay) {
    if (action.unknown) return 'unknown';
    if (!action.date) return 'unset';
    const days = dayNumber(action.date) - dayNumber(currentDay);
    return days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 3 ? 'soon' : days <= 7 ? 'week' : 'later';
  }
  function rows(cards, lists, settings, now) {
    if (!Array.isArray(cards) || !Array.isArray(lists) || cards.some(c => !c || typeof c.id !== 'string' ||
        typeof c.name !== 'string' || !Array.isArray(c.labels)) ||
        lists.some(l => !l || typeof l.id !== 'string' || typeof l.name !== 'string')) throw new Error('Unavailable data');
    const names = new Map(lists.map(l => [l.id, l.name]));
    const currentDay = today(now);
    return cards.filter(c => !c.closed).map(function (card) {
      const m = display.fromCard(card), action = actionDate(m.deadline, m.review);
      const mode = settings.listModes?.[card.idList];
      const done = card.dueComplete === true || card.complete === true || card.due?.complete === true || mode === 'done';
      const state = done ? 'done' : mode === 'hold' ? 'hold' : 'active';
      const ownerUnknown = /^(要確認|未記載|未設定)$/.test(m.ballOwner);
      const self = settings.self || '';
      const ball = ownerUnknown ? 'unknown' : !self ? 'unmapped' : m.ballOwner === self ? 'mine' : 'others';
      const flags = [];
      if (ownerUnknown) flags.push('ボール未確定');
      if (m.review === '要確認' || m.deadline.value === '要確認') flags.push('日付未確認');
      if (ball === 'others') {
        if (m.review && m.review !== '要確認' && dayNumber(m.review.slice(0, 10)) <= dayNumber(currentDay)) flags.push('確認日到来');
        if (m.deadline.date && dayNumber(m.deadline.date) - dayNumber(currentDay) <= 7) flags.push('完了期限が近い');
        if (m.deadline.date && !m.review) flags.push('確認日なし');
        if (!m.deadline.date && !m.review) flags.push('日付なし');
      }
      return { id: card.id, name: card.name, major: m.major, middle: m.middle, owner: m.ballOwner,
        listId: card.idList, listName: names.get(card.idList) || '状態未確認', state, ball,
        priority: priority(card.labels), due: m.deadline, review: m.review, action,
        bucket: bucket(action, currentDay), flags, follow: state === 'active' && flags.length > 0 };
    });
  }
  function filter(rows, options, includeBucket) {
    const q = (options.search || '').trim().toLocaleLowerCase('ja');
    return rows.filter(r => {
      if (options.scope === 'done' ? r.state !== 'done' : options.scope === 'hold' ? r.state !== 'hold' : r.state === 'done') return false;
      if (options.priority && r.priority !== options.priority) return false;
      if (options.owner && r.owner !== options.owner) return false;
      if (options.ball && r.ball !== options.ball) return false;
      if (options.major && r.major !== options.major) return false;
      if (options.middle && r.middle !== options.middle) return false;
      if (options.list && r.listId !== options.list) return false;
      if (q && ![r.name, r.major, r.middle, r.owner, r.listName].some(v => v.toLocaleLowerCase('ja').includes(q))) return false;
      if (includeBucket && options.bucket) {
        if (options.bucket === 'follow') return r.follow;
        if (options.bucket === 'holdOverdue') return r.state === 'hold' && r.bucket === 'overdue';
        if (r.state !== 'active' || r.bucket !== options.bucket) return false;
      }
      return true;
    });
  }
  function sort(rows, mode) {
    const ranks = { A: 0, B: 1, C: 2, check: 3, unset: 4 };
    const states = { active: 0, hold: 1, done: 2 };
    return [...rows].sort((a, b) => {
      const state = states[a.state] - states[b.state];
      if (state) return state;
      const p = ranks[a.priority] - ranks[b.priority];
      if (mode === 'priority' && p) return p;
      const group = buckets.indexOf(a.bucket) - buckets.indexOf(b.bucket);
      if (group) return group;
      if (p) return p;
      return (a.action.date || '').localeCompare(b.action.date || '') || a.name.localeCompare(b.name, 'ja');
    });
  }
  function summarize(rows) {
    const counts = Object.fromEntries(buckets.map(b => [b, 0]));
    counts.follow = 0; counts.holdOverdue = 0;
    for (const row of rows) {
      if (row.state === 'active') { counts[row.bucket]++; if (row.follow) counts.follow++; }
      if (row.state === 'hold' && row.bucket === 'overdue') counts.holdOverdue++;
    }
    return counts;
  }
  function collectionView(rows, options) {
    return { counts: summarize(filter(rows, { ...options, bucket: '' }, false)),
      visible: sort(filter(rows, options, true), options.sort) };
  }
  function configuration(lists, settings) {
    return { listsReady: lists.every(l => ['active', 'hold', 'done'].includes(settings.listModes?.[l.id])),
      selfReady: Boolean(settings.self) };
  }
  function guidance(config, options, hasHold) {
    const hold = options.bucket === 'holdOverdue';
    const follow = options.bucket === 'follow' || ['mine', 'others'].includes(options.ball);
    const messages = [];
    if ((hold || follow) && !config.listsReady) messages.push(hasHold ?
      'まだ未指定のリストがあります。各リストの扱いを指定してください。' :
      '保留リストを指定してください。保留以外のリストも進行中・完了に指定してください。');
    if (follow && !config.selfReady) messages.push('自分の名前を指定してください。');
    return { message: messages.join(' '), target: !config.listsReady ? 'lists' : 'self' };
  }
  return Object.freeze({ rows, filter, sort, summarize, today, bucketNames, actionDate, collectionView, configuration, guidance });
});
