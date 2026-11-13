// يبني مجلد www للتطبيق من صفحة المتجر نفسها (index.html): نفس الكود، بدون نسخة ثانية نصونها.
// التشغيل:  cd mobile && npm run www      (و npm run sync يزامن مع مشروعي آيفون وأندرويد)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..', '..'), out = path.join(here, '..', 'www');
const SITE = process.env.SITE_URL || 'https://1097mbnalll-ui.github.io/Super/';
if (!/^https:\/\/[^\s"'<>]+\/$/.test(SITE)) throw new Error('SITE_URL لازم يكون https وينتهي بـ /');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!html.includes('<head>')) throw new Error('index.html ما فيه <head>');
// علامة التطبيق: الصفحة تقرأها وتخفي الإدارة والمندوب والمجهز، وتنزّل الصور والبيانات من الموقع
// __FCM__: إشعارات أندرويد تشتغل بس لو ملف Firebase موجود وقت البناء (بدونه الإضافة تطيّح التطبيق)
const FCM = fs.existsSync(path.join(here, '..', 'android', 'app', 'google-services.json'));
html = html.replace('<head>', '<head><script>window.__NATIVE_STORE__=true;window.__SITE__=' + JSON.stringify(SITE) + ';window.__FCM__=' + FCM + ';</script>');
html = html.replace(/<link rel="manifest"[^>]*>/g, '');
// بدون تكبير بالأصابع ولا تكبير تلقائي عند الكتابة (يحس كأنه موقع)
html = html.replace(/<meta name=viewport content="[^"]*">/g, '<meta name=viewport content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">');
fs.writeFileSync(path.join(out, 'index.html'), html);
for (const f of ['privacy.html', 'delete-data.html', 'favicon-64.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) fs.copyFileSync(path.join(root, f), path.join(out, f));
// صفحة بدون نت (أندرويد يفتح الموقع الحي؛ لو النت مقطوع تطلع هذي)
fs.writeFileSync(path.join(out, 'offline.html'), '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>متاجر أحد</title><style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#F3F6F5;color:#0D1420;font:16px/1.7 system-ui,"Noto Sans Arabic",sans-serif;text-align:center;padding:24px}img{width:96px;height:96px;border-radius:24px}h1{font-size:21px;margin:6px 0 0}p{margin:0;color:#596171}button{min-height:52px;min-width:200px;border:0;border-radius:16px;background:linear-gradient(135deg,#12A07C,#0B7A5E,#07604A);color:#fff;font:700 16px system-ui,sans-serif}</style></head><body><img src="icon-192.png" alt=""><h1>ما فيه اتصال بالإنترنت</h1><p>تأكد من الواي فاي أو البيانات وحاول مرة ثانية</p><button onclick="location.href=' + JSON.stringify(SITE + '?app=android' + (FCM ? '&fcm=1' : '')) + '">حاول مرة ثانية</button></body></html>');
fs.cpSync(path.join(root, 'cat'), path.join(out, 'cat'), { recursive: true });
const kb = (n) => Math.round(n / 1024);
console.log('www جاهز:', kb(fs.statSync(path.join(out, 'index.html')).size) + ' ك.ب للصفحة،', fs.readdirSync(path.join(out, 'cat')).length, 'صورة قسم،', 'الموقع:', SITE);
