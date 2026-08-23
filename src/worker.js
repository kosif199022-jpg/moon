/* السحاب الأبيض — Cloudflare Worker عبر ASSETS binding */
const HTML_404 = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>السحاب الأبيض — 404</title>
<style>body{background:#EAF4FF;color:#17263B;font-family:system-ui,'Segoe UI',sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}
a{color:#2D7DD2}h1{background:linear-gradient(100deg,#17263B,#2D7DD2);-webkit-background-clip:text;background-clip:text;color:transparent;font-size:34px}
p{color:#5A6C85}</style></head>
<body><div style="text-align:center"><h1>404 — سحابة غائبة</h1><p>هذه الصفحة انجرفت مع الريح</p><p><a href="/">← العودة إلى السحاب الأبيض</a></p></div></body></html>`;

export default {
  async fetch(request, env) {
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      const res = new Response(assetResponse.body, assetResponse);
      res.headers.set('x-cloud-version', '1.0.0');
      res.headers.set('x-content-type-options', 'nosniff');
      res.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
      return res;
    }
    return new Response(HTML_404, { status: 404, headers: { 'content-type': 'text/html;charset=utf-8' } });
  }
};
