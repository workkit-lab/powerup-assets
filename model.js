(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardDisplayModel = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function field(description, keys) {
    const values = String(description || '').split(/\r?\n/).flatMap(function (line) {
      const match = line.trim().match(/^([^：:]+)[：:]\s*(.*)$/);
      return match && keys.includes(match[1].trim()) ? [match[2].trim()] : [];
    });
    const unique = [...new Set(values)];
    return { value: unique.length === 1 ? unique[0] : '', conflict: unique.length > 1 };
  }

  function civilDate(value) {
    const match = String(value || '').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (year < 2000 || year > 2199 || date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('/');
  }

  function nativeDate(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return null;
    if (!civilDate(value.slice(0, 10))) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
  }

  function textValue(result) {
    if (result.conflict) return '要確認';
    return result.value || '未記載';
  }

  function deadline(card) {
    const stored = card.due && typeof card.due === 'object' ? card.due.date : card.due;
    const date = nativeDate(stored);
    if (stored && !date) return { value: '要確認', date: null };
    if (date) return { value: date, date: date };
    return { value: '未設定', date: null };
  }

  function reviewDate(description) {
    const result = field(description, ['次回確認日']);
    if (result.conflict) return '要確認';
    if (!result.value || /^未設定/.test(result.value)) return null;
    const match = result.value.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})([（(]予定。時刻未共有[）)])?$/);
    if (!match || !civilDate(match[1])) return '要確認';
    return civilDate(match[1]) + (match[2] || '');
  }

  function fromCard(card) {
    const description = card.desc ?? card.description ?? '';
    return {
      major: textValue(field(description, ['大分類', '大カテゴリ'])),
      middle: textValue(field(description, ['業務分類', '中カテゴリ'])),
      ball: textValue(field(description, ['現在のボール'])),
      ballOwner: (function () {
        const owner = field(description, ['現在のボール担当者', 'ボール担当者']);
        return owner.conflict || !owner.value ? '要確認' : owner.value;
      })(),
      deadline: deadline(card),
      review: reviewDate(description)
    };
  }

  function badges(model) {
    const result = [{ text: model.major + ' / ' + model.middle }];
    result.push({ text: '担当：' + model.ballOwner });
    if (!model.deadline.date) {
      result.push({ text: model.deadline.value === '未設定' ? '期限未設定' : '期限要確認' });
    }
    if (model.review) {
      const displayDate = /^\d{4}\/\d{2}\/\d{2}/.test(model.review) ? model.review.slice(5, 10) : model.review;
      result.push({ text: '次回確認：' + displayDate });
    }
    return result;
  }

  return Object.freeze({ fromCard: fromCard, badges: badges, civilDate: civilDate, nativeDate: nativeDate });
});
