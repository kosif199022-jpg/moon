'use strict';
(() => {
  const M = window.Moon;
  const GATES = [
    ['G1','قبول العميل','acceptance'], ['G2','اعتماد الأهمية النسبية','materiality'], ['G3','اعتماد المخاطر الهامة','risk'],
    ['G4','اعتماد إجراءات الاستجابة','procedures'], ['G5','خلاصة كفاية الأدلة','evidence'], ['G6','تقييم التحريفات','misstatements'],
    ['G7','اعتماد الرأي','opinion'], ['G8','قفل الأرشيف','archive']
  ].map(([id,label,view]) => ({id,label,view}));
  const VIEWS = [
    ['command','مركز القيادة',''], ['acceptance','قبول العميل','01'], ['tb','ميزان المراجعة','02'],
    ['materiality','الأهمية النسبية','03'], ['risk','تقييم المخاطر','04'], ['procedures','إجراءات الاستجابة','05'],
    ['je','قيود اليومية ISA 240','06'], ['sampling','العينات','07'], ['evidence','الأدلة','08'],
    ['misstatements','التحريفات','09'], ['opinion','الرأي والتقرير','10'], ['archive','الأرشيف والسجل','11']
  ].map(([id,label,step]) => ({id,label,step}));
  const ROLES = {
    partner:{label:'شريك',gates:GATES.map((gate) => gate.id)},
    manager:{label:'مدير مهمة',gates:['G1','G2','G3','G4','G5','G6']},
    senior:{label:'مراجع أول',gates:[]}, junior:{label:'مراجع',gates:[]}, quality:{label:'مراقب جودة',gates:['G5']}
  };
  const emptyState = () => ({
    meta:{id:`ENG-${Date.now().toString(36).toUpperCase()}`,createdAt:new Date().toISOString(),locked:false,schema:'moon.browser.v1'},
    user:{name:'',role:'manager'},
    client:{name:'',periodStart:'2025-01-01',periodEnd:'2025-12-31',framework:'IFRS',currency:'SAR',independence:false,note:''},
    tb:null, materiality:null, risks:[], procedures:[], journalEntries:[], journalRun:null, sample:null,
    evidence:[], misstatements:[], opinionInput:{sufficient:true,scope:'none',pervasive:false,goingConcern:'none',emphasis:false}, opinion:null,
    gates:{}, log:[]
  });
  const replacer = (_key,value) => typeof value === 'bigint' ? `${value}n` : value;
  const reviver = (_key,value) => M.Money.revive(value);
  const load = () => {
    try { const text = localStorage.getItem('moon.audit.v1'); return text ? JSON.parse(text,reviver) : emptyState(); }
    catch { return emptyState(); }
  };
  const save = () => { try { localStorage.setItem('moon.audit.v1',JSON.stringify(M.state,replacer)); } catch {} };
  const appendLog = async (action,target,payload={}) => {
    const previousHash = M.state.log.at(-1)?.hash || '0'.repeat(64);
    const record = { seq:M.state.log.length+1, at:new Date().toISOString(), actor:M.state.user.name || 'غير محدد', role:M.state.user.role, action, target, payloadHash:M.textHash(payload), previousHash };
    record.hash = await M.sha256(record);
    M.state.log.push(record);
  };
  const commit = async (action,target,payload,mutation) => {
    if (M.state.meta.locked && action !== 'RESET_FILE') return M.toast('الملف مقفل في الأرشيف.');
    mutation(); await appendLog(action,target,payload); save(); M.render();
  };
  const gateBlockers = (id,state=M.state) => {
    const approved = (gate) => Boolean(state.gates[gate]?.approved);
    const blockers = [];
    if (id === 'G1') {
      if (!state.client.name.trim()) blockers.push('اسم العميل غير مسجل.');
      if (!state.client.independence) blockers.push('فحص الاستقلال لم يكتمل.');
      if (state.client.note.trim().length < 15) blockers.push('مذكرة القبول أقصر من 15 حرفاً.');
    }
    if (id === 'G2') {
      if (!approved('G1')) blockers.push('قبول العميل غير معتمد.');
      if (!state.tb?.balanced) blockers.push('ميزان المراجعة غير متوازن أو غير مرفوع.');
      if (!state.materiality) blockers.push('الأهمية النسبية لم تُحتسب.');
      else if (state.materiality.rationale.trim().length < 20) blockers.push('مبرر الأهمية النسبية مطلوب.');
    }
    if (id === 'G3') {
      if (!approved('G2')) blockers.push('الأهمية النسبية غير معتمدة.');
      if (!state.risks.length) blockers.push('تقييم المخاطر لم يُنفذ.');
      if (state.risks.some((risk) => risk.significant && risk.rationale.trim().length < 15)) blockers.push('خطر هام بلا مبرر كافٍ.');
    }
    if (id === 'G4') {
      if (!approved('G3')) blockers.push('المخاطر الهامة غير معتمدة.');
      const covered = new Set(state.procedures.map((item) => item.riskCode));
      if (!state.procedures.length) blockers.push('الإجراءات لم تُولّد.');
      if (state.risks.some((risk) => risk.significant && !covered.has(risk.code))) blockers.push('يوجد خطر هام بلا إجراء.');
    }
    if (id === 'G5') {
      if (!approved('G4')) blockers.push('إجراءات الاستجابة غير معتمدة.');
      if (state.procedures.some((item) => item.status !== 'completed')) blockers.push('توجد إجراءات غير مكتملة.');
      const accepted = new Set(state.evidence.filter((item) => item.accepted).map((item) => item.riskCode));
      const gaps = state.risks.filter((risk) => risk.significant && !accepted.has(risk.code));
      if (gaps.length) blockers.push(`${gaps.length} خطر هام بلا دليل مقبول.`);
    }
    if (id === 'G6') {
      if (!approved('G5')) blockers.push('خلاصة الأدلة غير معتمدة.');
      if (!state.materiality) blockers.push('الأهمية النسبية مطلوبة.');
      if (state.misstatements.some((item) => !item.classification)) blockers.push('تحريف بلا تصنيف.');
    }
    if (id === 'G7') {
      if (!approved('G6')) blockers.push('تقييم التحريفات غير معتمد.');
      if (!state.opinion) blockers.push('مسار الرأي لم يُشتق.');
      if ((state.opinion?.rationale || '').trim().length < 25) blockers.push('مبرر الرأي مطلوب.');
    }
    if (id === 'G8') {
      if (!approved('G7')) blockers.push('الرأي غير معتمد من الشريك.');
      if (state.journalRun?.flags.some((flag) => flag.state === 'flagged')) blockers.push('توجد مؤشرات قيود يومية لم يُبت فيها.');
      if (state.evidence.some((item) => !item.accepted)) blockers.push('توجد أدلة غير مقبولة.');
    }
    return blockers;
  };
  const readiness = () => {
    const gates = GATES.map((gate) => ({...gate,approved:Boolean(M.state.gates[gate.id]?.approved),blockers:gateBlockers(gate.id)}));
    const done = gates.filter((gate) => gate.approved).length;
    return {gates,done,total:gates.length,percent:Math.round(done/gates.length*100),next:gates.find((gate) => !gate.approved)};
  };
  const verifyLog = async () => {
    let previousHash = '0'.repeat(64);
    for (const record of M.state.log) {
      if (record.previousHash !== previousHash) return {ok:false,seq:record.seq,reason:'ارتباط السلسلة مكسور.'};
      const {hash,...body} = record;
      if (await M.sha256(body) !== hash) return {ok:false,seq:record.seq,reason:'محتوى حدث تغير.'};
      previousHash = hash;
    }
    return {ok:true,count:M.state.log.length};
  };
  Object.assign(M,{GATES,VIEWS,ROLES,emptyState,state:load(),view:'command',save,appendLog,commit,gateBlockers,readiness,verifyLog});
})();
