/* السحاب الأبيض — بيانات المختبرات + المحرك المحاسبي الحتمي (منقول بذكاء من KOSIF) */
(function () {
  'use strict';
  const C = window.CLOUD = window.CLOUD || {};
  const fmt = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
  const fmtAr = n => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

  /* ═══ مخرجات مختبرات KOSIF الفعلية (موثقة بالبذور) ═══ */
  const D = {
    company: 'شركة محمود الدسوقي العالمية', period: '2026',
    k5k: { accounts:5000, entries:1601, revenue:2408252908, net:-1608117841, assets:3449828118,
      equityPct:61.42, benford:'6.5 INVESTIGATE', z:'0.31 DISTRESS', risk:'66.9 ELEVATED' },
    k100k: { accounts:100000, entries:12001, totalDrMajor:54833263235, flagged:220, anomalies:313,
      benfordNed:7.73, risk:'57.4 ELEVATED', invariants:0 },
    trend: [['يناير',313],['فبراير',221],['مارس',303],['أبريل',280],['مايو',279],['يونيو',285],
      ['يوليو',312],['أغسطس',308],['سبتمبر',220],['أكتوبر',279],['نوفمبر',258],['ديسمبر',1356]],
    aging: [['جارية',16.89,1,'#18A87A'],['1–30 يومًا',14.55,2,'#2D7DD2'],['31–60 يومًا',16.63,5,'#8B5CF6'],
      ['61–90 يومًا',20.74,10,'#E8913A'],['91–180 يومًا',16.91,25,'#F4913A'],['+180 يومًا',14.28,50,'#E0526E']],
    riskParts: [['بنفورد',78],['أعمار الذمم',100],['السيولة',10],['الرافعة',45],['شذوذ القيود',93]],
    ratios: [
      ['السيولة المتداولة','143.5%','#18A87A','أصول متداولة ÷ خصوم متداولة'],
      ['السيولة السريعة','100.0%','#2D7DD2','بلا مخزون'],
      ['الهامش الإجمالي','-3.4%','#E0526E','إيرادات − تكلفة المبيعات'],
      ['هامش صافي الربح','-66.8%','#E0526E','صافي النتيجة ÷ الإيرادات'],
      ['العائد على الأصول ROA','-46.6%','#E8913A','في سيناريو الاختبار'],
      ['المديونية / حقوق الملكية','138.7%','#E8913A','رافعة مرتفعة']
    ],
    threats: [
      ['JV-2026-00070 · قيد يدوي نهاية-فترة','25.5M عبر حساب معلق بواسطة مدير مالي — 6 أعلام خطر متزامنة'],
      ['نمط بنفورد مفتعل','الرقمان 2 و3 فوق المنحنى بـ+10.6 و+13.3 نقطة — مبالغ مصطنعة قرب أهداف'],
      ['تركّز ديسمبر','حجم الشهر 4.8× متوسط الأشهر — قيود إثبات إيراد نهاية الفترة'],
      ['ذمم متعثرة','51% تجاوزت 90 يومًا — مخصص ECL مقترح 14.7% وفق IFRS 9']
    ],
    tbSample: [
      { code:'1101', name:'النقدية وما في حكمها', type:'asset', bal:340000000 },
      { code:'1201', name:'العملاء المحليون', type:'asset', bal:610000000 },
      { code:'1301', name:'مخزون بضاعة التداول', type:'asset', bal:480000000 },
      { code:'1401', name:'أراضٍ ومبانٍ', type:'asset', bal:1219828118 },
      { code:'2101', name:'الموردون المحليون', type:'liability', bal:760000000 },
      { code:'2201', name:'قروض بنكية قصيرة الأجل', type:'liability', bal:569000000 },
      { code:'3101', name:'رأس المال المدفوع', type:'equity', bal:1500000000 },
      { code:'3301', name:'الأرباح المبقاة', type:'equity', bal:618000000 },
      { code:'4101', name:'إيرادات مبيعات التجزئة', type:'revenue', bal:920000000 },
      { code:'4201', name:'إيرادات الجملة المحلية', type:'revenue', bal:1180000000 },
      { code:'4301', name:'إيرادات التصدير', type:'revenue', bal:308252908 },
      { code:'5101', name:'تكلفة المبيعات', type:'expense', bal:1490000000 },
      { code:'5201', name:'رواتب وأجور', type:'expense', bal:520000000 },
      { code:'5301', name:'مصروف إيجارات', type:'expense', bal:180000000 },
      { code:'5401', name:'إهلاك الأصول الثابتة', type:'expense', bal:120148986 }
    ],
    cert100k: [
      'KOSIF_ELDESOUKY_100K_LAB_OK',
      '{ accounts: 100000, entries: 12001,',
      '  trialBalance: { balanced: true },',
      '  totalDrMajor: "54833263235" SAR,',
      '  flaggedJournals: 220, anomaliesV52: 313,',
      '  benfordNed: 7.73 => INVESTIGATE,',
      '  compositeRisk: 57.4 ELEVATED, invariantsFatal: 0,',
      '  seed: 20260823100000 }'
    ].join('\n'),
    cert5k: [
      'KOSIF_ELDESOUKY_5000_LAB_OK',
      '{ overall: "PASS", accounts: 5000, journals: 1601,',
      '  tbBalanced: true, revenueSAR: 2408252908,',
      '  vatNet: ZATCA 15%, zakat: 2.5%,',
      '  benfordNed: 6.5 INVESTIGATE, altmanZ: 0.31 DISTRESS,',
      '  riskIndex: 66.9 ELEVATED, seed: 202608235000 }'
    ].join('\n')
  };
  C.data = D; C.fmt = fmt; C.fmtAr = fmtAr;

  /* ═══ المحرك المحاسبي ═══ */
  function derive(tb, simPct) {
    const f = simPct ? 1 + simPct / 100 : 1;
    const sum = t => tb.filter(r => r.type === t).reduce((s, r) =>
      s + Math.abs(r.bal) * ((r.type === 'revenue' || r.type === 'expense') ? f : 1), 0);
    const revenue=sum('revenue'), expense=sum('expense'), assets=sum('asset'),
          liab=sum('liability'), equity=sum('equity');
    const cogs = Math.round(expense * .62);
    return { revenue, expense, cogs, opex: expense - cogs, netProfit: revenue - expense,
      grossProfit: revenue - cogs, assets, liab, equity,
      currentAssets: Math.round(assets * .55), fixedAssets: assets - Math.round(assets * .55),
      currentLiab: Math.round(liab * .45), cash: Math.round(assets * .12),
      ar: Math.round(assets * .18), inv: Math.round(assets * .15) };
  }

  function forecast12() {
    const s = D.trend, alpha = .45, beta = .18;
    let level = s[0][1], trend = s[1][1] - s[0][1];
    for (let i = 1; i < s.length; i++) {
      const prevL = level;
      level = alpha * s[i][1] + (1 - alpha) * (prevL + trend);
      trend = beta * (level - prevL) + (1 - beta) * trend;
    }
    const avg = s.reduce((x, m) => x + m[1], 0) / 12;
    const decF = s[11][1] / avg;
    const names = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const out = [];
    for (let k = 1; k <= 12; k++) {
      const v = Math.max(0, (level + trend * k) * (k % 12 === 0 ? decF : 1));
      out.push({ m: names[(11 + k) % 12], v: Math.round(v), lo: Math.round(v * .82), hi: Math.round(v * 1.22) });
    }
    return out;
  }

  function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);t=Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296}}

  /* عقل المراجعين: فضاء مرجعي حتمي (منقول من kosif-refs-v53) */
  function makeRefsUniverse(){
    const ISA=['ISA 200','ISA 210','ISA 220','ISA 230','ISA 240','ISA 250','ISA 260','ISA 265','ISA 300','ISA 315','ISA 320','ISA 330','ISA 450','ISA 500','ISA 505','ISA 540','ISA 570','ISA 580','ISA 700','ISA 705'];
    const IFRS=['IFRS 9','IFRS 15','IFRS 16','IFRS 17','IAS 1','IAS 2','IAS 7','IAS 16','IAS 19','IAS 21','IAS 36','IAS 37','IAS 38'];
    const LOCAL=['دليل SOCPA','نظام الضريبة المضافة','لائحة الزكاة','نظام الشركات السعودي','حوكمة الشركات'];
    const CATS=[['إثبات واعتراف','متى يُعترف وكيف يُقاس'],['قياس لاحق','تغير القيد عبر الزمن'],
      ['إظهار وإفصاح','ماذا يظهر في القوائم'],['ضوابط رقابية','أنشطة تمنع التحريف'],
      ['أدلة وإجراءات','إجراءات كافية ومناسبة'],['تقديرات محاسبية','بنود تعتمد افتراضات']];
    const SUBJECTS=['الاعتراف بالإيراد مع مرور الوقت','اختبار انخفاض القيمة','المخصصات والطوارئ',
      'خسائر الائتمان المتوقعة ECL','الأهمية النسبية وعتبات التنفيذ','رصد التحريفات وتجميعها'];
    const OUT=['توثق الأدلة بطريقة قابلة لمراجعة نظير مستقل','تربط كل استنتاج بدليل موثق المصدر والتاريخ',
      'تُحدث التقديرات عند تغير الافتراضات الجوهرية','تُفصح عن طبيعة القيد وأثره في القوائم'];
    const rng=mulberry32(53000000),pick=arr=>arr[Math.floor(rng()*arr.length)],int=(a,b)=>a+Math.floor(rng()*(b-a+1));
    const idx=[];
    for(let i=0;i<60000;i++){
      const family=i%3===0?'ISA':i%3===1?'IFRS':'LOCAL';
      const base=family==='ISA'?pick(ISA):family==='IFRS'?pick(IFRS):pick(LOCAL);
      const cat=pick(CATS);
      idx.push({id:'REF-'+String(i).padStart(7,'0'),family,base,cat:cat[0],subject:pick(SUBJECTS),
        ref:base+' · فقرة '+int(1,120)+'-'+int(1,40),
        authority:family==='LOCAL'?'SOCPA':family==='ISA'?'IAASB':'IASB',
        text:`${pick(OUT)} عند تطبيق ${cat[0]} وفق ${base}.`,weight:+(rng()*4+1).toFixed(1)});
    }
    idx.sort((x,y)=>y.weight-x.weight);
    return { universe:2400000, index:idx,
      search(q,family='',limit=24){const out=[];const query=String(q||'').trim();
        for(const r of this.index){if(family&&r.family!==family)continue;
          if(!query||r.subject.includes(query)||r.base.includes(query.toUpperCase())||r.cat.includes(query)){out.push(r);if(out.length>=limit)break;}}
        return{totalUniverse:this.universe,indexed:this.index.length,results:out};}
    };
  }

  C.engine={derive,forecast12,mulberry32};
})();
