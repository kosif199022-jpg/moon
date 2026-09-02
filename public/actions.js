'use strict';
(() => {
  const M=window.Moon;
  const byId=(id)=>document.getElementById(id);
  const value=(id)=>byId(id)?.value ?? '';
  const number=(id,fallback=0)=>{const parsed=Number(value(id));return Number.isFinite(parsed)?parsed:fallback;};
  const demoSource=`code,name,debit,credit,prior
1101,البنك,2500000,0,2100000
1201,العملاء,1800000,0,1300000
1301,المخزون,1450000,0,900000
1501,الممتلكات والمعدات,3900000,0,4200000
1502,مجمع الإهلاك,0,1100000,850000
2101,الموردون,0,2100000,1600000
2201,تمويل مرابحة,0,1700000,1900000
2301,مخصص منافع الموظفين,0,650000,520000
3101,رأس المال,0,2500000,2500000
3201,أرباح مبقاة,0,600000,300000
4101,إيرادات المبيعات,0,7200000,5800000
5101,تكلفة المبيعات,4900000,0,3900000
5201,مصروفات تشغيلية,1300000,0,1100000`;
  const journalPopulation=()=>{
    const entries=[]; const accounts=['1101','1201','1301','2101','4101','5101'];
    for(let index=1;index<=30;index+=1){
      const journalId=`JE-${String(index).padStart(3,'0')}`; let date=`2025-${String((index%12)+1).padStart(2,'0')}-${String((index%25)+1).padStart(2,'0')}`;
      if(index===29) date='2026-01-03';
      const amount=index===7?9700000n:index%6===0?5000000n:BigInt(120000+index*17300);
      entries.push({id:`${journalId}-D`,journalId,docNo:`JV-${1000+index}`,date,account:accounts[index%accounts.length],amount,source:index%5===0?'manual':'system',reversal:index===15});
      entries.push({id:`${journalId}-C`,journalId,docNo:`JV-${1000+index}`,date,account:accounts[(index+3)%accounts.length],amount:-amount,source:index%5===0?'manual':'system',reversal:index===15});
    }
    entries.push({id:'JE-999-X',journalId:'JE-999',docNo:'JV-1099',date:'2025-12-27',account:'4101',amount:1250000n,source:'manual',reversal:false});
    return entries;
  };
  const loadDemo=async()=>{
    const tb=M.parseTrialBalance(demoSource); const totals=M.deriveTotals(tb.lines);
    const state=M.emptyState(); state.user={name:'محمود القصيف',role:'partner'}; state.client={name:'شركة القمر للتجارة',periodStart:'2025-01-01',periodEnd:'2025-12-31',framework:'IFRS',currency:'SAR',independence:true,note:'اكتملت إجراءات قبول واستمرار العميل ولم تظهر تعارضات غير معالجة.'}; state.tb=tb;
    state.materiality=M.materiality({benchmark:'revenue',base:totals.revenue,bp:75,pmBp:6500,cttBp:400,rationale:'الإيرادات مؤشر مستقر يعكس حجم النشاط التشغيلي، واختيرت النسبة ضمن سياسة المكتب.'});
    M.state=state; state.risks=M.assessRisks(state); state.procedures=M.buildProcedures(state.risks).map((item)=>({...item,status:'completed'}));
    state.journalEntries=journalPopulation(); state.journalRun=M.runJournalTests(state.journalEntries,state.client.periodEnd); state.journalRun.flags.forEach((flag)=>{flag.state='reviewed';});
    state.sample=M.drawSample(state.journalEntries,8,state.meta.id);
    for(const risk of state.risks.filter((item)=>item.significant)) state.evidence.push({id:`EV-${risk.code}`,name:`دليل خارجي لحساب ${risk.name}`,source:'طرف خارجي',riskCode:risk.code,relevance:5,reliability:5,accepted:true});
    state.misstatements=[{id:'MIS-1',description:'فرق فصل زمني في المبيعات',amount:85000n,classification:'factual',corrected:false,pervasive:false}];
    state.opinion=M.deriveOpinion(state); state.opinion.rationale='استندت التوصية إلى كفاية الأدلة وتقييم التحريفات وعدم وجود قيد جوهري على النطاق.';
    await M.appendLog('DEMO_LOADED','engagement',{engagementId:state.meta.id}); M.save(); M.view='command'; M.render(); M.toast('تم تحميل ملف تجريبي متكامل.');
  };
  const approveGate=async(button)=>{
    const id=button.dataset.gate; const blockers=M.gateBlockers(id); if(blockers.length)return M.toast(blockers[0]);
    if(!M.ROLES[M.state.user.role]?.gates.includes(id))return M.toast('دورك الحالي لا يملك صلاحية الاعتماد.');
    const rationale=value(`gate-${id}`).trim(); if(rationale.length<10)return M.toast('اكتب مبرراً مهنياً من 10 أحرف على الأقل.');
    await M.commit('GATE_APPROVED',id,{rationale},()=>{M.state.gates[id]={approved:true,by:M.state.user.name||M.ROLES[M.state.user.role].label,role:M.state.user.role,rationale,at:new Date().toISOString()};if(id==='G8')M.state.meta.locked=true;});
  };
  document.addEventListener('click',async(event)=>{
    const button=event.target.closest('button,[data-view]'); if(!button)return;
    const view=button.dataset.view; if(view){M.view=view;M.render();document.querySelector('#view').focus();return;}
    const action=button.dataset.action;
    if(action==='open-council')return M.openCouncil(); if(action==='ai-close')return M.closeCouncil();
    if(action==='load-demo')return loadDemo(); if(action==='demo-tb'){byId('tb-source').value=demoSource;return;}
    if(action==='save-client')return M.commit('CLIENT_CONTEXT_UPDATED','client',{},()=>{M.state.client={...M.state.client,name:value('client-name').trim(),framework:value('framework'),periodStart:value('period-start'),periodEnd:value('period-end'),independence:byId('independence').checked,note:value('accept-note').trim()};});
    if(action==='parse-tb'){const source=value('tb-source');return M.commit('TRIAL_BALANCE_IMPORTED','trial-balance',{sourceHash:M.textHash(source)},()=>{M.state.tb=M.parseTrialBalance(source);M.state.materiality=null;M.state.risks=[];M.state.procedures=[];});}
    if(action==='calculate-materiality'){
      if(!M.state.tb?.balanced)return M.toast('ميزان متوازن مطلوب.'); const benchmark=value('mat-benchmark'); const totals=M.deriveTotals(M.state.tb.lines); const base=totals[benchmark]??0n;
      return M.commit('MATERIALITY_CALCULATED','materiality',{benchmark},()=>{M.state.materiality=M.materiality({benchmark,base,bp:Math.round(number('mat-bp',.75)*100),pmBp:Math.round(number('mat-pm',65)*100),cttBp:Math.round(number('mat-ctt',4)*100),rationale:value('mat-rationale').trim()});M.state.risks=[];M.state.procedures=[];});
    }
    if(action==='assess-risks'){if(!M.state.materiality)return M.toast('احسب الأهمية النسبية أولاً.');return M.commit('RISKS_ASSESSED','risks',{},()=>{M.state.risks=M.assessRisks(M.state);M.state.procedures=[];});}
    if(action==='build-procedures'){if(!M.state.risks.length)return M.toast('شغّل تقييم المخاطر أولاً.');return M.commit('PROCEDURES_BUILT','procedures',{},()=>{M.state.procedures=M.buildProcedures(M.state.risks);});}
    if(action==='toggle-procedure'){const id=button.dataset.id;return M.commit('PROCEDURE_STATUS_CHANGED',id,{},()=>{const item=M.state.procedures.find((row)=>row.id===id);item.status=item.status==='completed'?'planned':'completed';});}
    if(action==='load-journal')return M.commit('JOURNAL_POPULATION_LOADED','journal',{},()=>{M.state.journalEntries=journalPopulation();M.state.journalRun=null;M.state.sample=null;});
    if(action==='run-journal')return M.commit('JOURNAL_TESTS_RUN','journal-run',{},()=>{M.state.journalRun=M.runJournalTests(M.state.journalEntries,M.state.client.periodEnd);});
    if(action==='review-flag'){const id=button.dataset.id;return M.commit('JOURNAL_FLAG_REVIEWED',id,{},()=>{const flag=M.state.journalRun.flags.find((row)=>row.id===id);flag.state=flag.state==='reviewed'?'flagged':'reviewed';});}
    if(action==='draw-sample')return M.commit('SAMPLE_SELECTED','sample',{},()=>{M.state.sample=M.drawSample(M.state.journalEntries,Math.max(1,Math.round(number('sample-size',8))),value('sample-seed').trim()||M.state.meta.id);});
    if(action==='add-evidence'){
      const name=value('evidence-name').trim(); if(!name)return M.toast('وصف الدليل مطلوب.');
      return M.commit('EVIDENCE_CAPTURED','evidence',{},()=>{M.state.evidence.push({id:`EV-${Date.now().toString(36)}`,name,source:value('evidence-source').trim()||'غير محدد',riskCode:value('evidence-risk'),relevance:Math.min(5,Math.max(1,Math.round(number('evidence-relevance',3)))),reliability:Math.min(5,Math.max(1,Math.round(number('evidence-reliability',3)))),accepted:false});});
    }
    if(action==='toggle-evidence'){const id=button.dataset.id;return M.commit('EVIDENCE_REVIEW_CHANGED',id,{},()=>{const item=M.state.evidence.find((row)=>row.id===id);item.accepted=!item.accepted;});}
    if(action==='add-misstatement'){
      const amount=M.Money.parse(value('mis-amount')); if(amount===null)return M.toast('المبلغ غير صالح.'); const description=value('mis-description').trim(); if(!description)return M.toast('الوصف مطلوب.');
      return M.commit('MISSTATEMENT_RECORDED','misstatement',{},()=>{M.state.misstatements.push({id:`MIS-${Date.now().toString(36)}`,description,amount,classification:value('mis-class'),corrected:byId('mis-corrected').checked,pervasive:byId('mis-pervasive').checked});M.state.opinion=null;});
    }
    if(action==='derive-opinion')return M.commit('OPINION_RECOMMENDED','opinion',{},()=>{M.state.opinionInput={sufficient:byId('op-sufficient').checked,scope:value('op-scope'),pervasive:byId('op-pervasive').checked,goingConcern:value('op-going'),emphasis:byId('op-emphasis').checked};M.state.opinion=M.deriveOpinion(M.state);M.state.opinion.rationale=value('op-rationale').trim();});
    if(action==='approve-gate')return approveGate(button);
    if(action==='verify-log'){const result=await M.verifyLog();return M.toast(result.ok?`السجل سليم: ${result.count} حدث.`:`خلل عند الحدث ${result.seq}: ${result.reason}`);}
    if(action==='reset-file'){if(!confirm('سيُحذف ملف المتصفح الحالي. هل أنت متأكد؟'))return;localStorage.removeItem('moon.audit.v1');M.state=M.emptyState();M.view='command';M.render();return M.toast('تمت إعادة ضبط الملف.');}
    if(action==='print')return window.print();
    if(action==='export-json'){const blob=new Blob([JSON.stringify(M.state,(_key,item)=>typeof item==='bigint'?item.toString():item,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`moon-${M.state.meta.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
  });
  document.querySelector('#scrim').addEventListener('click',M.closeCouncil);
  document.querySelector('#u-name').addEventListener('change',(event)=>{M.state.user.name=event.target.value.trim();M.save();M.render();});
  document.querySelector('#u-role').addEventListener('change',(event)=>{M.state.user.role=event.target.value;M.save();M.render();});
})();
