'use strict';
(() => {
  const M=window.Moon;
  const renderers={command:'viewCommand',acceptance:'viewAcceptance',tb:'viewTB',materiality:'viewMateriality',risk:'viewRisk',procedures:'viewProcedures',je:'viewJE',sampling:'viewSampling',evidence:'viewEvidence',misstatements:'viewMisstatements',opinion:'viewOpinion',archive:'viewArchive'};
  const toast=(message)=>{const element=document.querySelector('#toast');element.textContent=message;element.classList.add('show');clearTimeout(element.timer);element.timer=setTimeout(()=>element.classList.remove('show'),3600);};
  const openCouncil=()=>{document.querySelector('#drawer-body').innerHTML=M.council();document.querySelector('#drawer').classList.add('open');document.querySelector('#drawer').setAttribute('aria-hidden','false');document.querySelector('#scrim').classList.add('open');};
  const closeCouncil=()=>{document.querySelector('#drawer').classList.remove('open');document.querySelector('#drawer').setAttribute('aria-hidden','true');document.querySelector('#scrim').classList.remove('open');};
  const render=()=>{
    const ready=M.readiness();
    document.querySelector('#rail-nav').innerHTML=M.VIEWS.map((item)=>{const gate=M.GATES.find((row)=>row.view===item.id);const state=gate?ready.gates.find((row)=>row.id===gate.id):null;return `<button data-view="${item.id}" ${M.view===item.id?'aria-current="page"':''}><span class="step">${item.step}</span><span>${M.esc(item.label)}</span><span class="tick ${state?.approved?'done':state?.blockers.length?'blocked':''}"></span></button>`;}).join('');
    document.querySelector('#eng-name').textContent=M.state.client.name||'مهمة بلا اسم';
    document.querySelector('#eng-meta').textContent=`${M.state.client.periodEnd||'فترة غير محددة'} · ${M.state.meta.id}${M.state.meta.locked?' · مؤرشف':''}`;
    const name=document.querySelector('#u-name'); const role=document.querySelector('#u-role');
    if(document.activeElement!==name)name.value=M.state.user.name;
    if(document.activeElement!==role)role.value=M.state.user.role;
    const renderer=M[renderers[M.view]]||M.viewCommand;
    document.querySelector('#view').innerHTML=renderer();
  };
  Object.assign(M,{toast,openCouncil,closeCouncil,render});
})();
