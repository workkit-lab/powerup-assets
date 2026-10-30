(function () {
  'use strict';
  function start(t) {
    const model = window.TaskListModel;
    const el = id => document.getElementById(id);
    let cards = [], lists = [], loaded = false, version = 0, asOf = new Date();
    const settings = { self: '', listModes: {} };
    const filters = { search: '', priority: '', owner: '', ball: '', major: '', middle: '', list: '', scope: '', bucket: '', sort: '' };
    function node(tag, text, className) {
      const n = document.createElement(tag);
      if (text !== undefined) n.textContent = text;
      if (className) n.className = className;
      return n;
    }
    function options(select, values, emptyLabel) {
      const old = select.value;
      select.replaceChildren(node('option', emptyLabel)); select.firstChild.value = '';
      for (const [value, label] of values) {
        const option = node('option', label); option.value = value; select.appendChild(option);
      }
      select.value = values.some(v => v[0] === old) ? old : '';
    }
    function distinct(values) { return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ja')).map(v => [v, v]); }
    function configure(rows) {
      for (const [id, key] of [['owner', 'owner'], ['major', 'major'], ['middle', 'middle']]) {
        options(el(id), distinct(rows.map(r => r[key])), { owner: 'すべての保持者', major: 'すべての大分類', middle: 'すべての中分類' }[id]);
        filters[id] = el(id).value;
      }
      options(el('list'), lists.map(l => [l.id, l.name]), 'すべての状態'); filters.list = el('list').value;
      options(el('self'), distinct(rows.filter(r => r.ball !== 'unknown').map(r => r.owner)), '未指定（自動判定しません）');
      settings.self = el('self').value;
      el('list-settings').replaceChildren();
      for (const list of lists) {
        const label = node('label', list.name), select = node('select');
        select.setAttribute('aria-label', 'リストの扱い：' + list.name);
        options(select, [['hold', '保留'], ['done', '完了']], '進行中');
        select.value = settings.listModes[list.id] || '';
        select.addEventListener('change', function () { settings.listModes[list.id] = select.value; render(); });
        label.appendChild(select); el('list-settings').appendChild(label);
      }
    }
    function render() {
      if (!loaded) return;
      const rows = model.rows(cards, lists, settings, asOf);
      const base = model.filter(rows, filters, false), counts = model.summarize(base);
      const visible = model.sort(model.filter(rows, filters, true), filters.sort);
      for (const button of el('summary').querySelectorAll('button')) {
        const key = button.dataset.bucket;
        button.querySelector('strong').textContent = String(counts[key]);
        button.setAttribute('aria-pressed', String(filters.bucket === key));
      }
      el('later').textContent = '8日以降 ' + counts.later;
      el('unknown').textContent = '日付未確認 ' + counts.unknown;
      el('follow').textContent = '要フォロー ' + counts.follow;
      el('hold').textContent = '保留の期限超過 ' + counts.holdOverdue;
      for (const key of ['later', 'unknown', 'follow']) el(key).setAttribute('aria-pressed', String(filters.bucket === key));
      el('selection').textContent = filters.bucket === 'follow' ? '要フォロー' : filters.bucket === 'holdOverdue' ? '保留の期限超過' : model.bucketNames[filters.bucket] || 'すべての対応期限';
      el('result').textContent = visible.length + '件を表示';
      el('mapping-note').textContent = settings.self ? '自分のボール：' + settings.self + '（今回の一覧内だけ）' : '自分の名前は未指定です。「自分／他者」は推測しません。';
      el('mine-option').disabled = !settings.self; el('others-option').disabled = !settings.self;
      el('rows').replaceChildren();
      const grouped = Object.keys(filters).every(key => !filters[key]);
      let previousGroup = '';
      for (const row of visible) {
        if (grouped) {
          const group = row.state === 'hold' ? '保留（通常の期限集計から除外）' :
            row.state === 'done' ? '完了' : ['overdue', 'today', 'soon'].includes(row.bucket) ?
            '優先して確認するタスク · 期限超過／本日／1〜3日以内' : row.bucket === 'week' ?
            '直近の準備が必要なタスク · 4〜7日以内' : 'その他の管理対象';
          if (group !== previousGroup) {
            const heading = node('tr', undefined, 'group-heading'), cell = node('th', group);
            cell.colSpan = 6; cell.scope = 'colgroup'; heading.appendChild(cell); el('rows').appendChild(heading);
            previousGroup = group;
          }
        }
        const tr = node('tr'); tr.className = row.state + (row.priority === 'A' ? ' priority-a-row' : '');
        const pr = node('td'), dot = node('span', '', 'priority ' + row.priority);
        dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', '優先度 ' + ({ check: '要確認', unset: '未設定' }[row.priority] || row.priority));
        dot.title = dot.getAttribute('aria-label'); pr.appendChild(dot);
        if (['check', 'unset'].includes(row.priority)) pr.appendChild(node('small', row.priority === 'check' ? '要確認' : '未設定'));
        const date = node('td', undefined, 'date-cell ' + (row.state === 'active' ? row.bucket : ''));
        date.appendChild(node('strong', row.action.unknown ? '未確認' : row.action.date ? row.action.date.slice(5) : '未設定',
          row.state === 'active' && row.bucket === 'overdue' ? 'overdue' : ''));
        if (row.action.date) date.appendChild(node('small', row.action.kind.replace(/^完了/, '締切')));
        date.title = '完了期限：' + row.due.value + '\n次回確認日：' + (row.review || '未設定');
        const title = node('td'), button = node('button', row.name, 'card-link');
        button.addEventListener('click', async function () {
          button.disabled = true;
          try { await t.showCard(row.id); }
          catch (_) { el('status').textContent = 'カードを開けませんでした。ボードから開き直してください。'; }
          finally { button.disabled = false; }
        });
        title.appendChild(button);
        if (row.flags.length) title.appendChild(node('small', row.flags.join(' · '), 'flags'));
        const major = node('td', row.major, 'major-cell'); major.title = row.major + ' / ' + row.middle;
        const owner = node('td', row.owner, row.ball === 'unknown' ? 'muted' : 'owner-cell');
        const state = node('td', row.listName);
        if (row.state !== 'active') state.appendChild(node('small', row.state === 'done' ? '完了' : '保留' + (row.bucket === 'overdue' ? '・期限超過' : '')));
        tr.append(pr, date, title, major, owner, state); el('rows').appendChild(tr);
      }
      el('empty').hidden = visible.length !== 0;
    }
    async function load() {
      const ticket = ++version;
      loaded = false; el('workspace').hidden = true; el('rows').replaceChildren();
      el('status').textContent = 'Trelloから読み込んでいます…'; el('reload').disabled = true;
      let timer;
      try {
        const data = await Promise.race([
          Promise.all([t.cards('id', 'name', 'desc', 'due', 'dueComplete', 'closed', 'labels', 'idList'), t.lists('id', 'name')]),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Unavailable')), 15000); })
        ]);
        if (ticket !== version) return;
        const now = new Date(); model.rows(data[0], data[1], settings, now);
        cards = data[0]; lists = data[1]; asOf = now;
        configure(model.rows(cards, lists, settings, asOf));
        loaded = true; render(); el('workspace').hidden = false;
        el('status').textContent = '取得：' + model.today(asOf) + ' ' + new Intl.DateTimeFormat('ja-JP', {
          timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }).format(asOf) + ' JST · Ver.1.1 · 閲覧専用';
      } catch (_) {
        if (ticket !== version) return;
        cards = []; lists = []; el('status').textContent = '取得できませんでした。0件ではありません。「再読み込み」で再試行してください。';
      } finally { clearTimeout(timer); if (ticket === version) el('reload').disabled = false; }
    }
    for (const id of ['search', 'priority', 'owner', 'ball', 'major', 'middle', 'list', 'scope', 'sort']) {
      el(id).addEventListener(id === 'search' ? 'input' : 'change', function () {
        filters[id] = el(id).value;
        if (id === 'scope') filters.bucket = '';
        render();
      });
    }
    el('self').addEventListener('change', function () {
      settings.self = el('self').value;
      if (!settings.self && ['mine', 'others'].includes(filters.ball)) { filters.ball = ''; el('ball').value = ''; }
      render();
    });
    for (const button of el('summary').querySelectorAll('button')) {
      button.addEventListener('click', function () {
        filters.bucket = filters.bucket === button.dataset.bucket ? '' : button.dataset.bucket;
        filters.scope = ''; el('scope').value = ''; render();
      });
    }
    for (const key of ['later', 'unknown', 'follow']) el(key).addEventListener('click', function () {
      filters.bucket = filters.bucket === key ? '' : key; filters.scope = ''; el('scope').value = ''; render();
    });
    el('hold').addEventListener('click', function () { filters.scope = 'hold'; el('scope').value = 'hold'; filters.bucket = 'holdOverdue'; render(); });
    el('clear').addEventListener('click', function () {
      for (const key of Object.keys(filters)) { filters[key] = ''; if (el(key)) el(key).value = ''; }
      render();
    });
    el('reload').addEventListener('click', load);
    load();
  }
  window.TaskListView = Object.freeze({ start });
})();
