# Moon — AI Audit Operating System

نظام تشغيل عربي لملف المراجعة: يستوعب ميزان المراجعة، يحسب الأهمية النسبية، يفكك عوامل المخاطر، ينفذ مؤشرات قيود اليومية وفق ISA 240، يختار عينات قابلة لإعادة الإنتاج، يربط الأدلة، يجمع التحريفات، ويشتق مسار الرأي وفق ISA 705 مع بقاء الاعتماد المهني النهائي للمراجع البشري.

## التشغيل السريع

```bash
corepack enable
pnpm install
pnpm dev
```

ثم افتح `http://127.0.0.1:4173`.

التطبيق الموجود في `public/` يعمل كنسخة متصفح كاملة دون قاعدة بيانات، ويحفظ بيانات التجربة محلياً في المتصفح. استخدم بيانات تجريبية فقط.

## بوابة الجودة

```bash
pnpm check
```

تتحقق البوابة من سلامة HTML وJavaScript، غياب الملفات السرية، اختبارات وحدة النقود، TypeScript، وبناء حزمتي `domain` و`api`.

## النشر على GitHub Pages

يتطلب GitHub تفعيل Pages مرة واحدة بصلاحية مدير المستودع:

1. افتح `Settings → Pages`.
2. اختر `GitHub Actions` ضمن `Build and deployment → Source`.
3. افتح `Actions → Deploy static Moon demo to GitHub Pages` ثم شغّل `Run workflow`.

بعد نجاح النشر يكون العنوان المتوقع: `https://kosif199022-jpg.github.io/moon/`.

## تشغيل واجهة API الاختبارية

```bash
cp .env.example .env
# عدّل كلمة مرور PostgreSQL في .env و docker-compose.yml لتتطابقا.
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm dev:api
```

- فحص الخدمة: `GET http://localhost:3001/health`
- سياق التطوير المزروع:
  - `X-Organization-ID: 11111111-1111-4111-8111-111111111111`
  - `X-User-ID: 22222222-2222-4222-8222-222222222222`

## هيكل المستودع

```text
public/                    التطبيق العربي RTL والمحركات الحتمية
apps/api                   API أولي للمهمات والحسابات
packages/domain            Money, Provenance, Engagement, Evidence, Risk
database                   PostgreSQL migrations + development seed
scripts                    خادم محلي وفحص ثابت
.github/workflows          CI ونشر GitHub Pages
```

## حدود النسخة الحالية

الواجهة المتكاملة في المتصفح هي المرجع التشغيلي الحالي. واجهة API تمثل أساس المرحلة الأولى وليست بعد خدمة إنتاج متعددة المستأجرين. لا ترفع ملفات عميل حقيقية أو نسخاً مرخصة من المعايير إلى المستودع العام. راجع `SECURITY.md` و`docs/REFERENCE_MATERIALS.md`.
