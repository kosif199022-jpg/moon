'use strict';
window.addEventListener('DOMContentLoaded',()=>{
  const M=window.Moon;
  if(!window.crypto?.subtle){document.querySelector('#view').innerHTML='<div class="callout stop"><b>متصفح غير مدعوم</b>يتطلب سجل الأثر واجهة Web Crypto.</div>';return;}
  M.render();
});
