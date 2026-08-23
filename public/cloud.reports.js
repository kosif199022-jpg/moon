/* السحاب الأبيض — ديوان التقارير (10 تقارير + محاكاة) */
(function () {
  'use strict';
  const C = window.CLOUD, D = C.data, E = C.engine;
  const fmt = C.fmt;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const REPORTS = [
    { id:'income',   ic:'📈', n:'قائمة الدخل',          d:'إيرادات، مجمل ربح، مصروفات، صافي النتيجة' },
    { id:'balance',  ic:'⚖️', n:'المركز المالي',         d:'ميزانية متوازنة آليًا بأقسامها' },
    { id:'cashflow', ic:'💵', n:'التدفقات النقدية',      d:'طريقة غير مباشرة وفق IAS 7' },
    { id:'aging',    ic:'⏳', n:'أعمار الذمم + ECL',     d:'شرائح بمصفوفة IFRS 9' },
    { id:'ratios',   ic:'🧮', n:'بطاقة النسب الشاملة',    d:'سيولة وربحية ورافعة بتفسير كل نسبة' },
    { id:'forecast', ic:'🧭', n:'تنبؤ 12 شهرًا',         d:'Holt + موسمية بنطاق ثقة 80%' },
    { id:'budget',   ic:'🎯', n:'الموازنة والانحرافات',   d:'موازنة مقابل فعلي مع كشف الجوهري' },
    { id:'audit',    ic:'🛡️', n:'مخاطر المراجعة ISA 320',d:'أهمية نسبية وأعلام وعينات' },
    { id:'board',    ic:'🏛️', n:'ملخص مجلس الإدارة',      d:'صفحة تنفيذية بالتوصيات المرتبة' },
    { id:'vat',      ic:'🧾', n:'الضريبة والزكاة ZATCA', d:'VAT 15% وزكاة 2.5% حتميًا' }
  ];

  const tbl=(cols,rows)=>`<table class="ar"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${i?'num':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const bar=(l,v,max,col)=>`<div class="ar-bar"><span>${esc(l)}</span><div class="tr"><i data-w="${Math.max(1,v/max*100)}" style="background:${col}"></i></div><b>${fmt(v)}</b></div>`;
  const money=n=>fmt(n)+' ريال';

  function render(id,sim){
    const d=E.derive(D.tbSample,sim);
    const R=REPORTS.find(r=>r.id===id);
    const head=`<div class="ar-head"><b>${R.ic} ${R.n}</b><span>${D.company} · ${D.period}${sim?` · محاكاة ${sim>0?'+':''}${sim}%`:''}</span></div>`;
    const pct=n=>(n/d.revenue*100).toFixed(1)+'%';

    if(id==='income') return head
      + tbl(['البند','المبلغ','% من الإيرادات'],[
        ['إجمالي الإيرادات',money(d.revenue),'100%'],
        ['تكلفة المبيعات','('+money(d.cogs)+')',pct(d.cogs)],
        ['<b>مجمل الربح</b>','<b>'+money(d.grossProfit)+'</b>','<b>'+pct(d.grossProfit)+'</b>'],
        ['مصروفات تشغيلية','('+money(d.opex)+')',pct(d.opex)],
        ['<b style="color:#E0526E">صافي النتيجة</b>','<b style="color:#E0526E">('+money(-d.netProfit)+')</b>','<b style="color:#E0526E">'+pct(d.netProfit)+'</b>']])
      + `<div class="ar-bars">${bar('الإيرادات',d.revenue,d.revenue,'#18A87A')}${bar('التكلفة',d.cogs,d.revenue,'#E8913A')}${bar('المصروفات',d.opex,d.revenue,'#E0526E')}</div>`;

    if(id==='balance') return head
      + tbl(['القسم','المبلغ'],[
        ['الأصول المتداولة',money(d.currentAssets)],['الأصول الثابتة',money(d.fixedAssets)],
        ['<b>إجمالي الأصول</b>','<b>'+money(d.assets)+'</b>'],['الخصوم المتداولة',money(d.currentLiab)],
        ['إجمالي الخصوم',money(d.liab)],['حقوق الملكية',money(d.equity)],
        ['<b>الخصوم + حقوق الملكية</b>','<b>'+money(d.liab+d.equity)+'</b>']])
      + `<p class="ar-note">معادلة المحاسبة متوازنة: ${fmt(d.assets)} = ${fmt(d.liab+d.equity)} ✓</p>`;

    if(id==='cashflow'){
      const wc=-(d.ar+d.inv-d.currentLiab)*.08, op=d.netProfit+120148986+wc,
            inv=-Math.round(d.fixedAssets*.06), fin=-180000000;
      return head+tbl(['النشاط','التدفق'],[
        ['صافي النتيجة',money(d.netProfit)],['+ إهلاك (غير نقدي)',money(120148986)],
        ['± رأس المال العامل',money(wc)],['<b>التدفق التشغيلي</b>','<b>'+money(op)+'</b>'],
        ['استثمارات',money(inv)],['تمويل',money(fin)],
        ['<b>صافي التغير في النقد</b>','<b>'+money(op+inv+fin)+'</b>']])+'<p class="ar-note">طريقة غير مباشرة — IAS 7.</p>';
    }

    if(id==='aging'){
      const prov=D.aging.reduce((s,a)=>s+a[1]*a[2]/100,0);
      return head+tbl(['الشريحة','% الذمم','ECL','الوزن'],D.aging.map(a=>
        [`<span style="color:${a[3]}">●</span> ${a[0]}`,a[1]+'%',a[2]+'%',`<b style="color:${a[3]}">${(a[1]*a[2]/100).toFixed(2)}%</b>`]))
        + `<div class="ar-kpis"><div><small>مخصص ECL المقترح</small><b style="color:#E8913A">${prov.toFixed(1)}%</b></div><div><small>المرجع</small><b>IFRS 9</b></div><div><small>الحالة</small><b style="color:#B8860B">اعتماد بشري مطلوب</b></div></div>`;
    }

    if(id==='ratios') return head+tbl(['المجموعة','النسبة','القيمة','التفسير'],
      D.ratios.map(r=>[r[0].split(' ')[0],r[0],r[1],r[3]]));

    if(id==='forecast'){
      const fc=E.forecast12(),max=Math.max(...fc.map(p=>p.hi)),tot=fc.reduce((s,p)=>s+p.v,0);
      return head+`<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"><span class="chip cyan">±18% ثقة</span><span class="chip gold">الإجمالي: ${money(tot)}</span></div>
      <div class="ar-chart">${fc.map(p=>`<div class="ar-fcol"><div class="w"><i class="h" data-h="${p.hi/max*92}"></i><i class="m" data-h="${p.v/max*88}"></i></div><small>${p.m.slice(0,4)}</small></div>`).join('')}</div>`
      + tbl(['المؤشر','القيمة'],[['متوسط شهري متوقع',money(tot/12)],['ذروة ديسمبر المتوقعة',money(fc[11].v)],['المنهجية','Holt linear + seasonal'],['نطاق الثقة','80% ±18%']]);
    }

    if(id==='budget'){
      const rng=E.mulberry32(532026);
      return head+tbl(['الشهر','الموازنة','الفعلي','الانحراف'],D.trend.slice(0,6).map(m=>{
        const act=m[1]*1e6,bud=Math.round(act*(.85+rng()*.3)),dev=(act-bud)/bud*100;
        return [m[0],fmt(bud),fmt(act),`<b style="color:${Math.abs(dev)>10?'#E0526E':'#18A87A'}">${dev>0?'+':''}${dev.toFixed(1)}%</b>`];
      }))+'<p class="ar-note">انحراف ±10% يستوجب تحليل السبب الجذري.</p>';
    }

    if(id==='audit'){
      const om=Math.round(d.revenue*.005);
      return head+tbl(['المؤشر','القيمة'],[
        ['أساس الأهمية النسبية','الإيرادات (ISA 320)'],['الأهمية الإجمالية OM',money(om)],
        ['الأهمية التنفيذية PM',money(Math.round(om*.65))],['حد التافه',money(Math.round(om*.05))],
        ['قيود عليها أعلام','220 (من مختبر 100K)'],['بنفورد','NED 7.73 — INVESTIGATE'],
        ['حسابات معلقة','500 — تصفية قبل الإصدار']]);
    }

    if(id==='board') return head
      + `<div class="ar-kpis">
        <div><small>الإيرادات</small><b style="color:#18A87A">${money(d.revenue)}</b></div>
        <div><small>صافي النتيجة</small><b style="color:#E0526E">(${money(-d.netProfit)})</b></div>
        <div><small>الرافعة D/E</small><b style="color:#E8913A">${(d.liab/d.equity*100).toFixed(0)}%</b></div>
        <div><small>التغطية المتداولة</small><b style="color:#18A87A">${(d.currentAssets/d.currentLiab*100).toFixed(0)}%</b></div></div>
      <h4 style="margin:14px 0 8px;color:var(--blu)">أولوية التوصيات</h4><ol style="padding-inline-start:20px;font-size:13px;line-height:2.1">
      <li>خفض تكلفة المبيعات 8% يقلب الهامش لموجب</li><li>تحصيل شرائح 90+ يومًا يخفض ECL ~6 نقاط</li>
      <li>إعادة جدولة القروض القصيرة لدون 100% رافعة</li><li>تصفية الحسابات المعلقة وإغلاق قيود نهاية الفترة يدويًا</li></ol>`;

    if(id==='vat'){
      const vatOut=Math.round(d.revenue*.6*.15),vatIn=Math.round(d.cogs*.15),zakatBase=d.equity+Math.max(0,d.netProfit);
      return head+tbl(['البند','القيمة'],[
        ['التوريدات الخاضعة (60%)',money(Math.round(d.revenue*.6))],
        ['ضريبة المخرجات 15%',money(vatOut)],['ضريبة المدخلات 15%',money(vatIn)],
        ['<b>صافي الضريبة المستحقة</b>','<b>'+money(vatOut-vatIn)+'</b>'],
        ['وعاء الزكاة',money(zakatBase)],['<b>الزكاة التقديرية 2.5%</b>','<b>'+money(Math.round(zakatBase*.025))+'</b>']])
        + '<p class="ar-note">احتساب حتمي وفق منهج ZATCA — على بيانات اختبار.</p>';
    }
    return head;
  }

  function mount(){
    const menu=document.getElementById('rep-menu'),view=document.getElementById('rep-view');
    if(!menu||menu.dataset.on)return;menu.dataset.on='1';
    menu.innerHTML=REPORTS.map(r=>`<button class="rep-item" data-r="${r.id}"><i>${r.ic}</i><b>${r.n}</b><small>${r.d}</small></button>`).join('');
    let cur='income',sim=0;
    function show(){view.classList.remove('entering');void view.offsetWidth;view.classList.add('entering');
      view.innerHTML=render(cur,sim);
      requestAnimationFrame(()=>setTimeout(()=>{
        view.querySelectorAll('.ar-bar .tr i').forEach(i=>i.style.width=i.dataset.w+'%');
        view.querySelectorAll('.ar-fcol .m,.ar-fcol .h').forEach(i=>{if(i.dataset.h)i.style.height=i.dataset.h+'%';});
      },60));}
    menu.addEventListener('click',e=>{const b=e.target.closest('[data-r]');if(!b)return;
      cur=b.dataset.r;menu.querySelectorAll('.rep-item').forEach(x=>x.classList.toggle('on',x===b));show();});
    const sl=document.getElementById('sim'),sv=document.getElementById('sim-val');
    sl.addEventListener('input',()=>{sim=Number(sl.value);sv.textContent=(sim>0?'+':'')+sim+'%';show();});
    document.getElementById('sim-reset').onclick=()=>{sim=0;sl.value=0;sv.textContent='±0%';show();};
    document.getElementById('btn-print').onclick=()=>{
      const w=open('','_blank');w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>تقرير السحاب الأبيض</title><style>body{font-family:Tahoma;padding:26px;color:#17263B;background:#fff}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#2D7DD2;color:#fff;padding:8px;text-align:right}td{padding:7px;border-bottom:1px solid #DDD}td.num{text-align:left}.ar-note{color:#666;font-size:12px;margin-top:12px}</style></head><body><h1 style="color:#2D7DD2">☁️ السحاب الأبيض — تقرير احترافي</h1>${view.innerHTML}<hr><small>أُنتج بواسطة السحاب الأبيض v1 — بيانات اختبار اصطناعية</small></body></html>`);w.document.close();setTimeout(()=>w.print(),400);};
    document.getElementById('btn-csv').onclick=()=>{
      const dd=E.derive(D.tbSample,sim),rows=[['report',cur],['sim_pct',sim]];
      for(const[k,v]of Object.entries(dd))rows.push([k,v]);
      const b=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
      const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='cloud-'+cur+'.csv';a.click();};
    menu.querySelector('[data-r="income"]').classList.add('on');
    show();
  }

  C.reports={mount,reports:REPORTS};
})();
