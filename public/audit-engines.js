'use strict';
(() => {
  const M = window.Moon;
  const { Money } = M;
  const estimateTypes = new Set(['receivable','inventory','ppe','provision']);
  const materiality = (input) => {
    const overall = Money.applyBp(Money.abs(input.base), input.bp);
    return {
      benchmark:input.benchmark, base:Money.abs(input.base), bp:input.bp,
      overall, performance:Money.applyBp(overall, input.pmBp), trivial:Money.applyBp(overall, input.cttBp),
      pmBp:input.pmBp, cttBp:input.cttBp, rationale:input.rationale || '', engineVersion:'moon.materiality.v1',
      inputHash:M.textHash(input)
    };
  };
  const assessRisks = (state) => {
    const pm = state.materiality?.performance ?? 0n;
    const evidenceCodes = new Set(state.evidence.map((item) => item.riskCode).filter(Boolean));
    return (state.tb?.lines || []).filter((line) => Money.abs(line.balance) > 0n).map((line) => {
      const absolute = Money.abs(line.balance);
      const size = pm > 0n ? Math.min(35, Number((absolute * 35n) / pm)) : 0;
      const estimate = estimateTypes.has(line.type) ? 15 : 4;
      const change = line.prior === null ? 10 : Math.min(15, Number((Money.abs(absolute - Money.abs(line.prior)) * 15n) / (Money.abs(line.prior) || 1n)));
      const evidenceGap = evidenceCodes.has(line.code) ? 0 : 25;
      const nature = ['revenue','receivable','inventory'].includes(line.type) ? 10 : 4;
      const score = Math.min(100, size + estimate + change + evidenceGap + nature);
      return {
        code:line.code, name:line.name, type:line.type, balance:line.balance, score, significant:score >= 70,
        assertions:M.assertions[line.type] || M.assertions.other,
        breakdown:[['الحجم',size],['التقدير',estimate],['التغير',change],['فجوة الأدلة',evidenceGap],['طبيعة الحساب',nature]],
        rationale:`درجة ${score}: الحجم ${size}، التقدير ${estimate}، التغير ${change}، فجوة الأدلة ${evidenceGap}، طبيعة الحساب ${nature}.`,
        engineVersion:'moon.risk.v1', inputHash:M.textHash([line.code,line.balance,pm,line.prior,evidenceGap])
      };
    }).sort((a,b) => b.score-a.score);
  };
  const buildProcedures = (risks) => risks.flatMap((risk) => {
    const base = [{ id:`P-${risk.code}-1`, riskCode:risk.code, type:risk.significant?'fraud':'substantive', objective:`اختبار استجابة ${risk.significant?'غير متوقعة ':''}لخطر ${risk.name}.`, status:'planned' }];
    return base.concat(risk.assertions.slice(0,2).map((assertion,index) => ({ id:`P-${risk.code}-${index+2}`, riskCode:risk.code, type:assertion === 'valuation'?'analytical':'substantive', objective:`اختبار تأكيد ${assertion} لحساب ${risk.name}.`, status:'planned' })));
  });
  const runJournalTests = (entries, periodEnd, threshold = 10000000n) => {
    const flags = [];
    const add = (entry, rule, detail, severity='medium') => flags.push({ id:`${rule}:${entry.id}`, entryId:entry.id, rule, detail, severity, state:'flagged' });
    const totals = new Map();
    for (const entry of entries) totals.set(entry.journalId, (totals.get(entry.journalId) || 0n) + entry.amount);
    for (const entry of entries) {
      const amount = Money.abs(entry.amount);
      const day = new Date(`${entry.date}T00:00:00Z`).getUTCDay();
      if ([5,6].includes(day)) add(entry,'WEEKEND','ترحيل في عطلة نهاية الأسبوع.');
      if (entry.date > periodEnd) add(entry,'AFTER_END','ترحيل بعد نهاية الفترة.','high');
      if (amount >= 5000000n && amount % 100000n === 0n) add(entry,'ROUND','مبلغ كبير ومدوّر.','low');
      if (amount >= Money.applyBp(threshold,9500) && amount < threshold) add(entry,'THRESHOLD','أسفل حد الاعتماد مباشرة.','high');
      if (entry.source === 'manual' && entry.reversal) add(entry,'MANUAL_REV','قيد يدوي معكوس.','high');
    }
    for (const [journalId, net] of totals) {
      if (net !== 0n) add(entries.find((entry) => entry.journalId === journalId), 'UNBALANCED', `القيد غير متوازن بفارق ${Money.format(net)}.`, 'high');
    }
    return { entriesCount:entries.length, flags, populationHash:M.textHash(entries), engineVersion:'moon.je.v1', ranAt:new Date().toISOString() };
  };
  const seeded = (seed) => { let value = parseInt(M.textHash(seed),16) || 1; return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; }; };
  const drawSample = (items, size, seed) => {
    const random = seeded(seed); const selected = items.map((item,index) => ({item,index,key:random()})).sort((a,b) => a.key-b.key || a.index-b.index).slice(0,Math.min(size,items.length)).map((row) => row.item);
    return { method:'random', seed, requested:size, selected, populationHash:M.textHash(items), selectionHash:M.textHash([seed,size,items]), engineVersion:'moon.sampling.v1' };
  };
  const evaluateMisstatements = (state) => {
    const trivial = state.materiality?.trivial ?? 0n;
    const relevant = state.misstatements.filter((item) => Money.abs(item.amount) > trivial && !item.corrected);
    const aggregate = Money.sum(relevant.map((item) => item.amount));
    return { count:relevant.length, aggregate, gross:Money.sum(relevant.map((item) => Money.abs(item.amount))), exceedsOverall:Money.abs(aggregate) > (state.materiality?.overall ?? 0n), pervasive:relevant.some((item) => item.pervasive) };
  };
  const deriveOpinion = (state) => {
    const evaluation = evaluateMisstatements(state); const input = state.opinionInput;
    let type='unmodified', label='رأي غير معدّل', isa='ISA 700', reason='الأدلة كافية ولا توجد تحريفات جوهرية غير مصححة.';
    if (input.scope === 'pervasive' || (!input.sufficient && input.pervasive)) { type='disclaimer'; label='عدم إبداء رأي'; isa='ISA 705.9'; reason='قيد متفشٍ على النطاق أو نقص متفشٍ في الأدلة.'; }
    else if (input.scope === 'material' || !input.sufficient) { type='qualified'; label='رأي متحفظ'; isa='ISA 705.7'; reason='قيد جوهري غير متفشٍ على النطاق أو نقص في الأدلة.'; }
    else if (evaluation.exceedsOverall && (evaluation.pervasive || input.pervasive)) { type='adverse'; label='رأي معارض'; isa='ISA 705.8'; reason='تحريفات جوهرية ومتفشية.'; }
    else if (evaluation.exceedsOverall) { type='qualified'; label='رأي متحفظ'; isa='ISA 705.7'; reason='تحريفات جوهرية غير متفشية.'; }
    return { type,label,isa,reason,evaluation,extra:{goingConcern:input.goingConcern,emphasis:input.emphasis}, engineVersion:'moon.opinion.v1', inputHash:M.textHash([input,evaluation]) };
  };
  Object.assign(M, { materiality, assessRisks, buildProcedures, runJournalTests, drawSample, evaluateMisstatements, deriveOpinion });
})();
