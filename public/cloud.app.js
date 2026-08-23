/* السحاب الأبيض — التطبيق الرئيسي: مشاهد + شات بمجلس مراجعة */
(function () {
  'use strict';
  const C = window.CLOUD, D = C.data;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  function kpi(i,ic,l,v,d,tone,c){return `<div class="kpi ${tone}" style="--i:${i};--c:${c}"><div class="l">${ic} ${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;}

  function renderHome(){
    const k=D.k5k;
    $('#home-kpis').innerHTML=[
      kpi(0,'💰','إيرادات السنة',C.fmtAr(k.revenue),'ريال سعودي · 2026','','#2D7DD2'),
      kpi(1,'🏛️','أصول المحفظة',C.fmtAr(k.assets),'حقوق ملكية '+k.equityPct+'%','','#8B5CF6'),
      kpi(2,'💎','أطلس الحسابات','100,000','حسابًا من مختبر الحجم الأقصى','','#18A87A'),
      kpi(3,'🕊️','حارس المخاطر','57.4 /100','ELEVATED — مرتفع','down','#E0526E')
    ].join('');
    const caps=[
      ['pulse','💓','نبض الأعمال','موجات شهرية + عدادات صحة + النسب الجوهرية'],
      ['foresee','🧭','بوصلة المستقبل','تنبؤ Holt-Winters لـ12 شهرًا بنطاق ثقة'],
      ['radar','🕊️','حارس المخاطر','بنفورد، أعمار، شذوذ، ألتمان Z تحت مجهر'],
      ['ledger','💎','كنز الحسابات','بحث لحظي في 100 ألف حساب'],
      ['reports','📜','ديوان التقارير','10 تقارير + محاكاة ±40% + طباعة PDF'],
      ['sky','🌤','الأجواء','48 ثيمًا سماويًا حيًا بثمانية عوالم'],
      ['lab','🧪','مختبر الشهادات','شهادات تنفيذ موثقة بالبذرة']
    ];
    $('#caps').innerHTML=caps.map(c=>`<button class="cap" data-goto="${c[0]}"><span class="go">←</span><b><i>${c[1]}</i>${c[2]}</b><p>${c[3]}</p></button>`).join('');
    const items=[['إيرادات 2026','2.41B ريال'],['ميزان 100K','54.83B'],['قيود مختبر 5K','1,601'],['شذوذ مرصود','313'],['ثيمات سماوية','48'],['تقارير الديوان','10'],['بنفورد NED','7.73'],['زكاة ZATCA','2.5%']];
    $('#ticker').innerHTML=(items.concat(items)).map(x=>`<span>${x[0]} <b>${x[1]}</b></span>`).join('');
  }

  function renderPulse(){
    const max=Math.max(...D.trend.map(t=>t[1]));
    $('#pulse-bars').innerHTML=D.trend.map((t,i)=>`
      <div class="bar-col"><div class="bar ${i===11?'hot':''}" data-h="${Math.max(4,t[1]/max*92)}"><span class="tip">${t[0]}: ${C.fmt(t[1])}M</span></div>
      <span class="bar-val">${C.fmt(t[1])}</span><span class="bar-lbl">${t[0].slice(0,4)}</span></div>`).join('');
    setTimeout(()=>$$('#pulse-bars .bar').forEach(b=>b.style.height=b.dataset.h+'%'),150);
    $('#pulse-kpis').innerHTML=[
      kpi(0,'⚡','ذروة ديسمبر','1,356M','4.8× المتوسط الشهري','warn','#E8913A'),
      kpi(1,'📉','أدنى شهر','220M','سبتمبر','','#2D7DD2'),
      kpi(2,'📊','متوسط الأشهر','282M','بدون ديسمبر','','#18A87A'),
      kpi(3,'🌊','إجمالي العام','4.17B','مجموع الحركة','','#FFD98E')
    ].join('');
    const g=[['السيولة',72,'#18A87A'],['التغطية',58,'#2D7DD2'],['جودة الذمم',49,'#E8913A'],['الكفاءة',66,'#8B5CF6']];
    $('#gauges').innerHTML=g.map(x=>`<div class="gauge"><div class="ring" style="--rc:${x[2]}" data-v="${x[1]}"><b>${x[1]}%</b></div><small>${x[0]}</small></div>`).join('');
    setTimeout(()=>$$('.gauge .ring').forEach(r=>r.style.setProperty('--v',r.dataset.v)),200);
    $('#ratios').innerHTML=D.ratios.map(r=>`<div class="ratio-row"><div class="n">${r[0]}<small>${r[3]}</small></div><span class="val" style="--c:${r[2]}">${r[1]}</span></div>`).join('');
  }

  function renderForecast(){
    const fc=C.engine.forecast12(),max=Math.max(...fc.map(p=>p.hi));
    $('#forecast-chart').innerHTML=fc.map(p=>`
      <div class="fc-col"><div class="fc-band">
        <div class="fc-hi" data-h="${p.hi/max*94}" title="${p.m}: أعلى ${C.fmt(p.hi)}"></div>
        <div class="fc-lo" style="width:70%" data-h="${p.lo/max*80}"></div>
        <div class="fc-mid" data-h="${p.v/max*86}" title="${p.m}: ${C.fmt(p.v)}"></div>
      </div><small>${p.m.slice(0,4)}</small></div>`).join('');
    setTimeout(()=>{
      $$('#forecast-chart .fc-hi').forEach(x=>x.style.height=x.dataset.h+'%');
      $$('#forecast-chart .fc-lo').forEach(x=>x.style.height=x.dataset.h+'%');
      $$('#forecast-chart .fc-mid').forEach(x=>x.style.height=x.dataset.h+'%');
    },180);
    const tot=fc.reduce((s,p)=>s+p.v,0);
    $('#fc-total').textContent='إجمالي متوقع: '+C.fmt(tot)+' ريال ('+C.fmtAr(Math.round(tot/1e6))+' مليون)';
    $('#forecast-kpis').innerHTML=[
      kpi(0,'📈','متوسط شهري متوقع',C.fmtAr(Math.round(tot/12))+'M','بنطاق ±18%','','#2D7DD2'),
      kpi(1,'🎄','ذروة ديسمبر القادمة',C.fmtAr(fc[11].v)+'M','العامل الموسمي مطبّق','warn','#E8913A'),
      kpi(2,'🎯','أدنى نطاق (يناير)',C.fmtAr(fc[0].lo)+'M','حد الثقة الأدنى','','#18A87A')
    ].join('');
  }

  function renderRadar(){
    let cur=0;const target=57.4,el=$('#risk-big');
    const iv=setInterval(()=>{cur=Math.min(target,cur+.9);el.textContent=cur.toFixed(1);if(cur>=target)clearInterval(iv);},30);
    $('#risk-parts').innerHTML=D.riskParts.map(p=>`<div class="risk-part"><span class="n">${p[0]}</span><span class="track"><i data-w="${p[1]}"></i></span><span class="sc">${p[1]}</span></div>`).join('');
    setTimeout(()=>$$('.risk-part i').forEach(i=>i.style.width=i.dataset.w+'%'),250);
    $('#threats').innerHTML=D.threats.map(t=>`<div class="threat"><b>⚠️ ${t[0]}</b>${t[1]}</div>`).join('');
  }

  const TB={q:'',type:'',sort:'code'};
  function renderTypeStats(){
    const s={asset:['أصول','30,000'],liability:['خصوم','22,000'],equity:['حقوق ملكية','10,000'],revenue:['إيرادات','19,000'],expense:['مصروفات','18,500'],suspense:['معلّقة','500']};
    $('#type-stats').innerHTML=Object.values(s).map(x=>`<span class="mini-chip">${x[0]} <b>${x[1]}</b></span>`).join('')+'<span class="mini-chip">الإجمالي <b>100,000</b></span>';
  }
  function drawTable(){
    let rows=D.tbSample;
    if(TB.type)rows=rows.filter(r=>r.type===TB.type);
    if(TB.q){const q=TB.q.toLowerCase();rows=rows.filter(r=>r.name.includes(TB.q)||r.code.includes(q));}
    if(TB.sort==='bal')rows=[...rows].sort((a,b)=>Math.abs(b.bal)-Math.abs(a.bal));
    const TAG={asset:['أصول','#18A87A'],liability:['خصوم','#2D7DD2'],equity:['حقوق','#8B5CF6'],revenue:['إيرادات','#B8860B'],expense:['مصروفات','#E0526E'],suspense:['معلّقة','#E8913A']};
    $('#tbl tbody').innerHTML=rows.map(r=>`<tr><td class="num">${r.code}</td><td>${esc(r.name)}</td><td><span class="type-tag" style="background:${TAG[r.type][1]}1A;color:${TAG[r.type][1]}">${TAG[r.type][0]}</span></td><td class="num"><b>${C.fmt(r.bal)}</b></td></tr>`).join('');
  }

  function renderLab(){
    $('#cert-100k').textContent=D.cert100k;
    $('#cert-5k').textContent=D.cert5k;
    const passes=['دليل حسابات 100,000 كود فريد','قيد افتتاحي متوازن 99,500 حساب','12,000 قيد حركة متوازنة','ميزان مراجعة متوازن (فرق = 0)','أهمية نسبية ISA 320 حتمية','عيّنة منهجية 250 قيدًا','VAT 15% وزكاة 2.5% بأعداد صحيحة','سلسلة بصمات SHA-256 سليمة','بوابة مجلس المراجعين قبل كل إجابة','48 ثيمًا بمؤثرات سماوية'];
    $('#pass-list').innerHTML=passes.map(p=>`<div class="pass-item"><b>✓</b>${p}</div>`).join('');
  }

  /* ═══ الشات المباشر ═══ */
  const KB=[
    [/سيولة|متداولة/,()=>'السيولة المتداولة ≈ 143% والسريعة ≈ 100%. جيدة كمّيًا لكن 51% من الذمم متأخرة +90 يومًا — راقب جودة التحصيل.'],
    [/أعمار|ذمم|ائتمان/,()=>{const p=D.aging.reduce((s,a)=>s+a[1]*a[2]/100,0);return 'شرائح الأعمار: جارية 17%، حتى 90 يوم 52%، فوقها 31%. مخصص ECL وفق IFRS 9 ≈ '+p.toFixed(1)+'%. توصية: حملة تحصيل للشريحة المتعثرة.'}],
    [/تنبؤ|توقع/,()=>'تنبؤ الـ12 شهرًا (Holt+موسمية): إجمالي ≈ 3.7 مليار ريال بنطاق ±18%، وذروة ديسمبر. افتح «بوصلة المستقبل» للرسم.'],
    [/بنفورد|تلاعب|تزوير/i,()=>'NED = 7.73 (INVESTIGATE): الرقمان 2 و3 فوق المنحنى — نمط مبالغ مصطنعة قرب أهداف. الانحراف يستوجب اختبارًا تفصيليًا.'],
    [/ألتمان|z.?score|ضائقة/i,()=>'ألتمان Z = 0.31 < 1.23 → DISTRESS. مدفوع بخسارة سيناريو الاختبار؛ عمليًا يستوجب خطة استمرارية ISA 570.'],
    [/مخاطر|risk/i,()=>'المؤشر المركب 57.4/100 (مرتفع): شذوذ 93، أعمار 100، بنفورد 78، رافعة 45، سيولة 10. أخطر ما: قيود يدوية نهاية-فترة عبر حسابات معلقة.'],
    [/تقرير|قائمة|ميزان/,()=>'«ديوان التقارير» فيه 10 تقارير احترافية مع محاكاة ±40% وطباعة PDF وتصدير CSV.'],
    [/ثيم|جو|سماء|مظهر/,()=>'تبويب «الأجواء»: 48 ثيمًا بثمانية عوالم سماوية — فجر، ظهيرة، غروب، ليل هادئ، عاصفة ثلجية، شفق قطبي، مرج، ومحيط.'],
    [/100|مئة ألف/,()=>'مختبر الحجم الأقصى: 100,000 حساب، 12,001 قيدًا متوازنًا، ميزان 54.83 مليار ريال، صفر ثوابت فادحة. البذرة تعيد كل شيء للأبد.']
  ];
  function answer(q){for(const k of KB)if(k[0].test(q))return k[1]();
    return 'سؤال جميل. على البيانات الاختبارية: إيرادات 2.41 مليار، خسارة 1.61 مليار، رافعة 139%. اسأل عن: السيولة، الأعمار، بنفورد، ألتمان، التنبؤ، التقارير، أو الأجواء.';}
  function council(q){
    const c=[];
    if(/ضمان|متأكد|مؤكد قطعًا/.test(q))c.push('تجنب اليقين المطلق — الأرقام تقديرية');
    if(/اشترِ|بع|استثمر/.test(q))c.push('القرارات الاستثمارية لمستشار مرخّص');
    if(!c.length)c.push('مبني على بيانات اصطناعية اختبارية');
    c.push('اعتماد بشري موثق إلزامي');return c;
  }
  function mountChat(){
    if($('#chat-fab').dataset.on)return;$('#chat-fab').dataset.on='1';
    const panel=$('#chat-panel'),msgs=$('#chat-msgs'),fab=$('#chat-fab'),q=$('#chat-q');
    $('#chat-hints').innerHTML=['ما وضع السيولة؟','توقع 2027','ما مؤشر المخاطر؟','اشرح بنفورد'].map(h=>`<button class="hint-chip">${h}</button>`).join('');
    add('bot','مرحبًا! أنا مساعد السحاب ☁️\nاسأل عن السيولة، الأعمار، بنفورد، التنبؤ…\n🔒 كل إجابة تمر على بوابة المجلس أولًا.');
    fab.onclick=()=>{const open=panel.classList.toggle('show');fab.textContent=open?'✕':'💬';if(open)q.focus();};
    $('#chat-close').onclick=()=>{panel.classList.remove('show');fab.textContent='💬';};
    $('#chat-hints').addEventListener('click',e=>{const c=e.target.closest('.hint-chip');if(c)ask(c.textContent);});
    $('#chat-send').onclick=()=>{const t=q.value.trim();if(t){ask(t);q.value='';}};
    q.addEventListener('keydown',e=>{if(e.key==='Enter'&&q.value.trim()){ask(q.value.trim());q.value='';}});
    $('#chat-mic').onclick=()=>{
      const R=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!R){add('bot','الصوت غير مدعوم هنا — اكتب سؤالك.');return;}
      let rec;const mic=$('#chat-mic');
      if(mic.classList.contains('on')){try{rec.stop();}catch(_){}return;}
      rec=new R();rec.lang='ar-SA';rec.interimResults=false;
      rec.onstart=()=>mic.classList.add('on');
      rec.onend=rec.onerror=()=>mic.classList.remove('on');
      rec.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript;if(t)ask(t);};
      try{rec.start();add('bot','🎧 أسمعك…');}catch(_){}
    };
    function speak(t){if(!('speechSynthesis'in window))return;speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(String(t).replace(/[«»*#•]/g,'').slice(0,280));u.lang='ar-SA';u.rate=.98;
      const vs=speechSynthesis.getVoices?.()||[];u.voice=vs.find(v=>/^ar/i.test(v.lang))||null;speechSynthesis.speak(u);}
    function add(kind,text,stamp){const d=document.createElement('div');d.className='cm '+kind;
      d.innerHTML=text+(kind==='bot'&&stamp?`<span class="guard-stamp">🛡 المجلس: ${stamp.map(esc).join(' · ')}</span>`:'');
      msgs.appendChild(d);msgs.scrollTop=1e9;return d;}
    function ask(text){
      add('user',esc(text));
      const t=add('bot','<span class="typing"><i></i><i></i><i></i></span> يُعرض على المجلس…');
      setTimeout(()=>{const a=answer(text),checks=council(text);
        t.innerHTML=a.replace(/\n/g,'<br>')+`<span class="guard-stamp">🛡 المجلس: ${checks.map(esc).join(' · ')}</span>`;
        msgs.scrollTop=1e9;speak(a);},650+Math.random()*550);
    }
  }

  /* ═══ التنقل والإقلاع ═══ */
  function navTo(id){
    $$('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+id));
    $$('.nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===id));
    scrollTo({top:0});
    requestAnimationFrame(()=>setTimeout(()=>{
      if(id==='pulse')renderPulse();
      if(id==='foresee')renderForecast();
      if(id==='radar')renderRadar();
      if(id==='reports')C.reports.mount();
      if(id==='sky')C.themes.build();
    },120));
  }

  function boot(){
    try{
      const saved=(()=>{try{return localStorage.getItem('cloud_theme')}catch(_){return null}})();
      C.themes.apply(saved||'noon-1');
      renderHome();renderLab();renderTypeStats();drawTable();mountChat();
      $$('.nav button').forEach(b=>b.onclick=()=>navTo(b.dataset.v));
      document.body.addEventListener('click',e=>{const g=e.target.closest('[data-goto]');if(g)navTo(g.dataset.goto);});
      $('#btn-launch').onclick=()=>navTo('pulse');
      $('#q').addEventListener('input',e=>{TB.q=e.target.value.trim();drawTable();});
      $('#ftype').addEventListener('change',e=>{TB.type=e.target.value;drawTable();});
      $('#fsort').addEventListener('change',e=>{TB.sort=e.target.value;drawTable();});
      setInterval(()=>{$('#clock').textContent=new Date().toLocaleTimeString('en-GB');},1000);
      navTo('home');
    }catch(err){console.error('Cloud boot error',err);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
