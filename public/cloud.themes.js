/* السحاب الأبيض — 48 ثيمًا سماويًا: 8 أجواء × 6 حالات + سحب حية */
(function () {
  'use strict';
  const A = window.CLOUD = window.CLOUD || {};

  const FAMILIES = [
    { id:'dawn',     name:'الفجر',        fx:'birds',   bgs:['#FFF3E0','#FFE8CC','#FFD9A8','#FFF8EE','#FFEFD6','#FCE4C4'] },
    { id:'noon',     name:'الظهيرة',      fx:'rays',    bgs:['#E3F2FF','#D0EAFF','#BDE2FF','#EAF6FF','#D8EDFF','#C6E5FF'] },
    { id:'sunset',   name:'الغروب',       fx:'waves',   bgs:['#FFE5DB','#FFD6C7','#FFC9BC','#FFEBDD','#FFDCCB','#FFCFBF'] },
    { id:'night',    name:'الليل الهادئ', fx:'stars',   bgs:['#1B2A44','#22334F','#2A3C5C','#16233A','#243652','#1E2E48'] },
    { id:'storm',    name:'عاصفة ثلجية',  fx:'snow',    bgs:['#E8EDF4','#DCE4EE','#D0DAE8','#EEF2F7','#E2E9F1','#D6DFEB'] },
    { id:'aurora',   name:'شفق قطبي',     fx:'dust',    bgs:['#101B2E','#14243D','#182C48','#0C1626','#16263F','#121F35'] },
    { id:'meadow',   name:'مرج',          fx:'petals',  bgs:['#EFFAE8','#E2F5D8','#D4EFc8','#F5FCF0','#E8F7DC','#DCF1CE'] },
    { id:'ocean',    name:'محيط هادئ',    fx:'bubbles', bgs:['#E0F5FA','#D0EEF6','#BFE7F2','#EAF9FD','#D8F1F8','#C8ECF4'] }
  ];
  const ACCENTS = [
    ['#2D7DD2','#7CC4FF','#FFD98E'], ['#18A87A','#5AD4B0','#B8E2FF'],
    ['#8B5CF6','#B79CF8','#FFD98E'], ['#E0526E','#F49BB0','#7CC4FF'],
    ['#E8913A','#FFC46B','#7CC4FF'], ['#2D9DD2','#5AD4E8','#FFB35C'],
    ['#6B5CE7','#A78BFA','#7CD4FF'], ['#1287B8','#4AC0E0','#FFD98E']
  ];
  const MOODS = ['ناعم','صافٍ','عميق','مشرق','دافئ','هادئ'];

  A.THEMES = [];
  FAMILIES.forEach((f, fi) => {
    for (let i = 0; i < 6; i++) {
      const acc = ACCENTS[(fi + i) % ACCENTS.length];
      const dark = f.id === 'night' || f.id === 'aurora';
      A.THEMES.push({
        id: f.id + '-' + (i+1), name: f.name + ' — ' + MOODS[i],
        family: f.id, familyName: f.name, fx: f.fx,
        bg0: f.bgs[i], bg1: f.bgs[(i+2)%6], bg2: dark ? '#FFFFFF' : f.bgs[(i+4)%6],
        a: acc[0], b: acc[1], c: acc[2], dark
      });
    }
  });

  let fxCanvas=null, fxRAF=0, fxKind='birds', P=[];

  function applyTheme(id){
    const t=A.THEMES.find(x=>x.id===id)||A.THEMES[1];
    const r=document.documentElement.style;
    r.setProperty('--th-a',t.a);r.setProperty('--th-b',t.b);r.setProperty('--th-c',t.c);
    r.setProperty('--th-bg0',t.bg0);r.setProperty('--th-bg1',t.bg1);r.setProperty('--th-bg2',t.bg2);
    document.body.classList.toggle('dark-sky',!!t.dark);
    document.documentElement.dataset.cloudTheme=t.id;
    try{localStorage.setItem('cloud_theme',t.id);}catch(_){}
    fxKind=t.fx;startFx();
    return t;
  }

  function ensure(){ if(fxCanvas)return fxCanvas; fxCanvas=document.getElementById('fx');
    addEventListener('resize',()=>{size();seed();}); return fxCanvas; }
  function size(){ const d=Math.min(devicePixelRatio||1,2);
    fxCanvas.width=innerWidth*d;fxCanvas.height=innerHeight*d;
    fxCanvas.getContext('2d').setTransform(d,0,0,d,0,0); }
  function seed(){
    const n = fxKind==='rays'||fxKind==='waves' ? 0 : Math.min(110,Math.floor(innerWidth*innerHeight/16000));
    P=Array.from({length:n},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,
      r:Math.random()*2.2+.6,vy:Math.random()*.5+.12,vx:(Math.random()-.5)*.4,
      a:Math.random(),tw:Math.random()*.03+.008,rot:Math.random()*6.28}));
  }
  const cssv=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim()||'#2D7DD2';

  function startFx(){ ensure();size();seed();
    if(fxRAF)cancelAnimationFrame(fxRAF);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){draw(0);return;}
    let t=0;(function loop(){t++;draw(t);fxRAF=requestAnimationFrame(loop);})();
  }

  function draw(t){
    const ctx=fxCanvas.getContext('2d');
    ctx.clearRect(0,0,innerWidth,innerHeight);
    const a=cssv('--th-a'),b=cssv('--th-b'),c=cssv('--th-c');
    if(fxKind==='rays'){
      ctx.save();ctx.translate(innerWidth*.75,-80);
      for(let i=0;i<7;i++){ctx.rotate(.09+.02*Math.sin(t/140+i));
        const g=ctx.createLinearGradient(0,0,0,innerHeight*1.2);
        g.addColorStop(0,a+'30');g.addColorStop(1,'transparent');
        ctx.fillStyle=g;ctx.fillRect(-14+i*36,0,26,innerHeight*1.3);}
      ctx.restore();return;
    }
    if(fxKind==='waves'){
      ctx.lineWidth=2.2;
      for(let row=0;row<5;row++){ctx.strokeStyle=a+'2E';ctx.beginPath();
        for(let x=0;x<=innerWidth;x+=14){const y=innerHeight*.55+row*46+Math.sin(x/130+t/50+row)*16;
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}
      return;
    }
    for(const p of P){
      p.a+=p.tw;const al=.3+Math.abs(Math.sin(p.a))*.55;
      let col=a;
      if(fxKind==='snow')col='#FFFFFF';
      else if(fxKind==='stars')col=p.r>1.5?c:a;
      else if(fxKind==='bubbles')col=b;
      else if(fxKind==='petals')col=p.r>1.4?c:a;
      else if(fxKind==='dust')col=[a,b,c][Math.floor(p.rot)%3];
      ctx.globalAlpha=fxKind==='snow'?al*.9:al;
      if(fxKind==='birds'){ // طيور بعيدة
        ctx.strokeStyle=cssv(document.body.classList.contains('dark-sky')?'--th-b':'--blu')+'88';
        ctx.lineWidth=1.4;const w=p.r*3,f=Math.sin(t/22+p.rot)*w*.45;
        ctx.beginPath();ctx.moveTo(p.x-w,p.y+f);ctx.quadraticCurveTo(p.x,p.y-w*.4,p.x+w,p.y+f);ctx.stroke();
        p.x+=p.vx*2.2;p.rot+=.01;if(p.x>innerWidth+20){p.x=-20;p.y=Math.random()*innerHeight*.6;}
      }else if(fxKind==='snow'){
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();
        p.y+=p.vy;p.x+=Math.sin(t/70+p.rot)*.7;
        if(p.y>innerHeight+4){p.y=-4;p.x=Math.random()*innerWidth;}
      }else if(fxKind==='petals'){
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot+t*.012);
        ctx.fillStyle=col;ctx.globalAlpha=al*.85;
        ctx.beginPath();ctx.ellipse(0,0,p.r*2.3,p.r,0,0,7);ctx.fill();ctx.restore();
        p.y+=p.vy;p.x+=Math.sin(t/60+p.rot)*.5;p.rot+=.012;
        if(p.y>innerHeight+6){p.y=-6;p.x=Math.random()*innerWidth;}
      }else{
        ctx.fillStyle=col;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();
        if(fxKind==='bubbles'){p.y-=p.vy;if(p.y<-6){p.y=innerHeight+4;p.x=Math.random()*innerWidth;}}
        else{p.y+=p.vy*.35;if(p.y>innerHeight+4){p.y=-4;p.x=Math.random()*innerWidth;}}
      }
      ctx.globalAlpha=1;
    }
  }

  function buildSkyView(){
    const fams=document.getElementById('sky-families'),grid=document.getElementById('sky-grid');
    if(!fams||!grid||grid.dataset.built)return;grid.dataset.built='1';
    const list=['all'].concat(FAMILIES.map(f=>f.id));
    const names={all:'كل الأجواء'};FAMILIES.forEach(f=>names[f.id]=f.name);
    fams.innerHTML=list.map(f=>`<button class="tfam ${f==='all'?'on':''}" data-f="${f}">${names[f]}</button>`).join('');
    function render(f){
      const ls=A.THEMES.filter(t=>f==='all'||t.family===f);
      grid.innerHTML=ls.map(t=>`
        <button class="theme-card ${document.documentElement.dataset.cloudTheme===t.id?'on':''}" data-t="${t.id}">
          <span class="tc-preview" style="background:linear-gradient(140deg,${t.bg0},${t.a}66)">
            <i></i><i></i><i></i>
          </span>
          <span class="tc-name">${t.name}</span>
        </button>`).join('');
    }
    render('all');
    fams.addEventListener('click',e=>{const btn=e.target.closest('[data-f]');if(!btn)return;
      fams.querySelectorAll('.tfam').forEach(x=>x.classList.toggle('on',x===btn));render(btn.dataset.f);});
    grid.addEventListener('click',e=>{const card=e.target.closest('[data-t]');if(!card)return;
      applyTheme(card.dataset.t);
      grid.querySelectorAll('.theme-card').forEach(x=>x.classList.toggle('on',x===card));});
  }

  A.themes={apply:applyTheme,all:A.THEMES,build:buildSkyView,startFx};
})();
