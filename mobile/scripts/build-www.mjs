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
for (const f of ['privacy.html', 'favicon-64.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.cpSync(path.join(root, 'cat'), path.join(out, 'cat'), { recursive: true });
const kb = (n) => Math.round(n / 1024);
console.log('www جاهز:', kb(fs.statSync(path.join(out, 'index.html')).size) + ' ك.ب للصفحة،', fs.readdirSync(path.join(out, 'cat')).length, 'صورة قسم،', 'الموقع:', SITE);
