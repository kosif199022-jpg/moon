'use strict';
window.Moon = window.Moon || {};
(() => {
  const M = window.Moon;
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const cleanDigits = (value) => Array.from(String(value ?? '')).map((ch) => {
    const a = AR.indexOf(ch); if (a >= 0) return String(a);
    const f = FA.indexOf(ch); return f >= 0 ? String(f) : ch;
  }).join('');
  const stable = (value) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'bigint') return `"${value}n"`;
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  };
  const textHash = (value) => {
    let hash = 2166136261;
    for (const ch of stable(value)) { hash ^= ch.codePointAt(0); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16).padStart(8, '0');
  };
  const sha256 = async (value) => {
    const bytes = new TextEncoder().encode(stable(value));
    const result = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, '0')).join('');
  };
  const Money = {
    parse(value) {
      if (typeof value === 'bigint') return value;
      let text = cleanDigits(value).trim();
      if (!text) return null;
      let negative = false;
      if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1); }
      text = text.replace(/[٫]/g, '.').replace(/[٬،,_\s]/g, '').replace(/[^\d.+-]/g, '');
      if (text.endsWith('-')) { negative = true; text = text.slice(0, -1); }
      if (text.startsWith('-')) { negative = !negative; text = text.slice(1); }
      if (text.startsWith('+')) text = text.slice(1);
      if (!/^\d+(?:\.\d*)?$/.test(text)) return null;
      const [integer, fraction = ''] = text.split('.');
      let minor = BigInt(integer) * 100n + BigInt((fraction + '00').slice(0, 2));
      if (fraction.length > 2 && Number(fraction[2]) >= 5) minor += 1n;
      return negative ? -minor : minor;
    },
    abs: (value) => value < 0n ? -value : value,
    sum: (items) => items.reduce((total, item) => total + item, 0n),
    applyBp(value, bp) {
      const negative = value < 0n;
      const absolute = negative ? -value : value;
      const numerator = absolute * BigInt(bp);
      let result = numerator / 10000n;
      if ((numerator % 10000n) * 2n >= 10000n) result += 1n;
      return negative ? -result : result;
    },
    format(value, currency = '') {
      const negative = value < 0n;
      const absolute = negative ? -value : value;
      const integer = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const fraction = (absolute % 100n).toString().padStart(2, '0');
      return `${negative ? '−' : ''}${integer}.${fraction}${currency ? ` ${currency}` : ''}`;
    },
    serialize(value) { return typeof value === 'bigint' ? `${value}n` : value; },
    revive(value) { return typeof value === 'string' && /^-?\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value; }
  };

  const accountType = (code, name) => {
    const text = `${code} ${name}`.replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').toLowerCase();
    const rules = [
      [/نقد|صندوق|بنك/, 'cash'], [/عميل|عملاء|مدين|قبض/, 'receivable'], [/مخزون|بضاعه/, 'inventory'],
      [/مبنى|مباني|معدات|سيار|اثاث|اصل ثابت|اصول ثابته|اهلاك/, 'ppe'], [/مورد|دائن|دفع/, 'payable'],
      [/قرض|تمويل|مرابحه|تورق/, 'borrowing'], [/مخصص|زكاه|ضريبه|نهايه الخدمه/, 'provision'],
      [/راس المال|احتياطي|ارباح مبقاه|حقوق/, 'equity'], [/ايراد|مبيعات|دخل/, 'revenue'], [/مصروف|تكلفه|رواتب|مشتريات/, 'expense']
    ];
    for (const [pattern, type] of rules) if (pattern.test(text)) return type;
    return ({ '1':'asset', '2':'payable', '3':'equity', '4':'revenue', '5':'expense', '6':'expense' })[String(code)[0]] || 'other';
  };
  const assertions = {
    cash:['existence','completeness','presentation'], receivable:['existence','valuation','rights'],
    inventory:['existence','valuation','completeness'], ppe:['existence','valuation','rights'],
    payable:['completeness','valuation','obligations'], borrowing:['completeness','obligations','presentation'],
    provision:['completeness','valuation'], equity:['presentation','rights'], revenue:['occurrence','cutoff','accuracy'],
    expense:['occurrence','completeness','cutoff'], asset:['existence','valuation'], other:['existence','completeness']
  };
  const parseTrialBalance = (source) => {
    const errors = [];
    const rows = String(source).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!rows.length) return { balanced:false, lines:[], errors:['لا توجد بيانات.'], totals:{debit:0n,credit:0n,diff:0n}, sourceHash:textHash('') };
    const split = (line) => (line.includes('\t') ? line.split('\t') : line.split(',')).map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const first = split(rows[0]);
    const start = first.some((cell) => /رمز|حساب|مدين|دائن|code|name|debit|credit/i.test(cell)) ? 1 : 0;
    const lines = [];
    for (let index = start; index < rows.length; index += 1) {
      const cells = split(rows[index]);
      if (cells.length < 4) { errors.push(`السطر ${index + 1}: أربعة أعمدة مطلوبة.`); continue; }
      const debit = Money.parse(cells[2]); const credit = Money.parse(cells[3]);
      if (debit === null || credit === null) { errors.push(`السطر ${index + 1}: مبلغ غير صالح.`); continue; }
      lines.push({ code:cleanDigits(cells[0]), name:cells[1], debit, credit, balance:debit-credit, prior:Money.parse(cells[4]), type:accountType(cells[0], cells[1]) });
    }
    const debit = Money.sum(lines.map((line) => line.debit));
    const credit = Money.sum(lines.map((line) => line.credit));
    const diff = debit - credit;
    if (diff !== 0n) errors.push(`الميزان غير متوازن بفارق ${Money.format(diff)}.`);
    return { balanced:diff === 0n && lines.length > 0, lines, errors, totals:{debit,credit,diff}, sourceHash:textHash(source), engineVersion:'moon.tb.v1' };
  };
  const deriveTotals = (lines) => {
    const total = (types) => Money.sum(lines.filter((line) => types.includes(line.type)).map((line) => Money.abs(line.balance)));
    const revenue = total(['revenue']); const expense = total(['expense']);
    return { revenue, expense, pbt:revenue-expense, assets:total(['cash','receivable','inventory','ppe','asset']), equity:total(['equity']) };
  };

  Object.assign(M, { cleanDigits, stable, textHash, sha256, Money, accountType, assertions, parseTrialBalance, deriveTotals });
})();
