(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardDisplayModel = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const managementKeys = new Set(['大分類', '大カテゴリ', '業務分類', '中カテゴリ',
    '現在のボール', '現在のボール担当者', 'ボール担当者', '次回確認日']);
  const historyHeading = /履歴|過去(?:の)?(?:暫定)?(?:記録|情報)|^(?:過去|旧(?:暫定|登録|情報|記録|版)|移行時|Excel記録|初回登録(?:内容|時)|元カード.*記録)/i;
  const currentHeading = /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+)?(?:現行|現在|最新)(?:の)?(?:管理(?:項目|情報)?|基本(?:項目|情報)|項目|情報)(?=$|[\s（(：:])/;

  function currentFields(description) {
    const fields = new Map();
    let historyDepth = 0, fence = '';
    for (const line of description.split(/\r?\n/)) {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        if (marker && marker[1].startsWith(fence) && !marker[2].trim()) fence = '';
        continue;
      }
      if (marker) { fence = marker[1]; continue; }

      const heading = line.match(/^ {0,3}(#{1,6})[ \t]+(.+)$/);
      if (heading) {
        const depth = heading[1].length, title = heading[2].replace(/[ \t]+#+[ \t]*$/, '').trim();
        if (historyHeading.test(title)) historyDepth = historyDepth ? Math.min(historyDepth, depth) : depth;
        // Imported history can contain sibling headings. An explicit current section resumes parsing.
        else if (historyDepth && depth <= historyDepth && currentHeading.test(title)) historyDepth = 0;
        continue;
      }
      const text = line.trim();
      if (historyDepth || text.startsWith('>')) continue;
      const match = text.match(/^([^：:]+)[：:]\s*(.*)$/);
      const key = match?.[1].trim();
      if (!managementKeys.has(key)) continue;
      if (!fields.has(key)) fields.set(key, []);
      fields.get(key).push(match[2].trim());
    }
    return fields;
  }

  function field(fields, keys) {
    const unique = [...new Set(keys.flatMap(key => fields.get(key) || []))];
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

  function reviewDate(fields) {
    const values = (fields.get('次回確認日') || []).map(function (value) {
      // A proposal inside an explicitly undated field is not an agreed review date.
      if (!value || /^未設定/.test(value) || /^未確定(?:$|[（(])/.test(value)) return null;
      const match = value.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})(（[^（）()\r\n]*）|\([^（）()\r\n]*\))?[。.]?$/);
      if (!match || !civilDate(match[1])) return '要確認';
      return civilDate(match[1]) + (match[2] || '');
    });
    // Compare calendar dates rather than explanatory text; retain genuine conflicts.
    if (values.includes('要確認') || new Set(values.map(value => value && value.slice(0, 10))).size > 1) return '要確認';
    return values[0] || null;
  }

  function fromCard(card) {
    const description = card.desc ?? card.description;
    const fields = currentFields(typeof description === 'string' ? description : '');
    const owner = field(fields, ['現在のボール担当者', 'ボール担当者']);
    return {
      major: textValue(field(fields, ['大分類', '大カテゴリ'])),
      middle: textValue(field(fields, ['業務分類', '中カテゴリ'])),
      ball: textValue(field(fields, ['現在のボール'])),
      ballOwner: owner.conflict || !owner.value ? '要確認' : owner.value,
      deadline: deadline(card),
      review: reviewDate(fields)
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
