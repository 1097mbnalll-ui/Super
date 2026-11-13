// بعد cap sync: نسخة أندرويد تفتح الموقع الحي مباشرة (server.url)، فأي تحديث للموقع
// (صور، أسعار، أقسام، تصميم) يوصل للتطبيق فوراً بدون رفع نسخة جديدة على قوقل بلاي.
// - ANDROID_LOCAL=1 : يخلي التطبيق يشتغل من الملفات المحلية (للاختبار على نسخة الفرع).
// - لو ملف Firebase موجود نضيف &fcm=1 عشان الصفحة تعرض زر الإشعارات.
// آيفون ما يتأثر: نعدّل نسخة أندرويد من الإعدادات بس.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), app = path.join(here, '..', 'android', 'app');
const cfgPath = path.join(app, 'src', 'main', 'assets', 'capacitor.config.json');
if (!fs.existsSync(cfgPath)) { console.log('android-remote: ما فيه مشروع أندرويد، تخطّي'); process.exit(0); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const SITE = process.env.SITE_URL || 'https://1097mbnalll-ui.github.io/Super/';
cfg.server = cfg.server || {};
if (process.env.ANDROID_LOCAL === '1') {
  delete cfg.server.url; delete cfg.server.errorPath;
  console.log('android-remote: وضع محلي (ملفات الفرع)');
} else {
  const fcm = fs.existsSync(path.join(app, 'google-services.json'));
  cfg.server.url = SITE + '?app=android' + (fcm ? '&fcm=1' : '');
  cfg.server.errorPath = 'offline.html';
  console.log('android-remote: يفتح', cfg.server.url);
}
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
