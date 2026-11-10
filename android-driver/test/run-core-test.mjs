// اختبار: كود التطبيق الحقيقي (الجافا) ضد server/worker.js الحقيقي.
// التشغيل:  ANDROID_JAR=/path/android-all-34.jar node test/run-core-test.mjs     (يحتاج node 22 و java)
import { spawn, execFileSync } from 'node:child_process'; import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const AJ = process.env.ANDROID_JAR || path.join(process.env.HOME, '.cache/ohod-android/android-all-34.jar');
const O = 'https://1097mbnalll-ui.github.io';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync(path.join(root, 'build/test'), { recursive: true });
execFileSync('javac', ['-encoding', 'UTF-8', '--release', '8', '-Xlint:-options', '-classpath', AJ, '-d', path.join(root, 'build/test'), ...['Api', 'Core'].map(f => path.join(root, 'src/sa/ohod/driver', f + '.java')), path.join(here, 'CoreTestMain.java')], { stdio: 'pipe' });
const java = (base, step, pin, ...args) => { const out = execFileSync('java', ['-Dsun.net.http.allowRestrictedHeaders=true', '-Dfile.encoding=UTF-8', '-Dstdout.encoding=UTF-8', '-cp', path.join(root, 'build/test') + ':' + AJ, 'sa.ohod.driver.CoreTestMain', step, base, pin, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); return JSON.parse(out.split('\n').find(l => l.startsWith('RESULT ')).slice(7)); };
function server(port, env = {}) { return new Promise((res) => { const p = spawn('node', ['--no-warnings', path.join(here, 'mock-worker.mjs')], { env: { ...process.env, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'inherit'] }); p.stdout.on('data', d => { if (String(d).includes('mock worker on')) res(p); }); }); }
const call = (base, p, body) => fetch(base + p, { method: 'POST', headers: { Origin: O, 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const data = JSON.parse(fs.readFileSync(path.join(root, '../server/test/fixtures/catalog.json'), 'utf8'));
const procs = [];
async function scenario(port, label, env) {
  const base = 'http://127.0.0.1:' + port; procs.push(await server(port, env)); console.log('\n== ' + label);
  await call(base, '/save', { pin: '2468', data, newDriverPin: '1357' });
  let p = java(base, 'pending', '1357'); ok(p.ok && p.last === 0 && p.fresh === 0 && p.onway === 0, 'لا طلبات: ' + JSON.stringify(p));
  for (const [ph, nm, loc] of [['0551111111', 'أبو فهد', '24.8400,46.8300'], ['0552222222', 'أم سعد', '24.8350,46.8200']]) await call(base, '/admin/order-new', { pin: '2468', source: 'phone', phone: ph, name: nm, loc, lines: [{ id: 'pantry0', qty: 1 }] });
  p = java(base, 'pending', '1357'); ok(p.ok && p.last === 1002 && p.fresh === 2, 'طلبين جدد: ' + JSON.stringify(p));
  const f = java(base, 'fresh', '1357', '1001'); ok(f.count === 1 && f.text.includes('#1002') && f.text.includes('أم سعد') && /ر\.س$/.test(f.text), 'نص إشعار الطلب الجديد: ' + f.text);
  const f2 = java(base, 'fresh', '1357', '0'); ok(f2.count === 2, 'بعد رقم 0 يطلع ٢');
  await call(base, '/driver/status', { pin: '1357', no: '#1001', status: 'accepted' }); await call(base, '/driver/status', { pin: '1357', no: '#1001', status: 'onway' });
  p = java(base, 'pending', '1357'); ok(p.fresh === 1 && p.onway === 1 && p.last === 1002, 'واحد في الطريق وواحد جديد: ' + JSON.stringify(p));
  let l = java(base, 'loc', '1357', '24.826', '46.812', '12.5', 'false'); ok(l.ok === true && !l.skipped, 'إرسال الموقع بنجاح');
  const t = await call(base, '/track', { no: '#1001', phone: '0551111111' }); ok(t.ok && t.driver && Math.abs(t.driver.lat - 24.826) < 1e-6 && t.driver.m > 1000 && t.driver.eta > 0, 'الزبون يشوف المندوب: ' + JSON.stringify(t.driver));
  l = java(base, 'loc', '2468', '1', '1', '5', 'false'); ok(l.ok === true && l.skipped === 'admin', 'رقم الإدارة ما يشارك موقع بدون موافقة');
  l = java(base, 'loc', '2468', '24.827', '46.813', '5', 'true'); ok(l.ok === true && !l.skipped, 'رقم الإدارة يشارك لو وافق');
  l = java(base, 'loc', '1357', '999', '1', '5', 'false'); ok(l.ok === false && l.code === 'bad_loc', 'إحداثيات خاطئة تنرفض');
  const bad = java(base, 'pending', '0000'); ok(bad.ok === false && bad.status === 401 && bad.code === 'bad_pin', 'رقم خاطئ: ' + JSON.stringify(bad));
  const off = java(base, 'locoff', '1357'); ok(off.ok === true, 'مسح الموقع');
  const ad = await call(base, '/admin/driver-loc', { pin: '2468' }); ok(ad.ok && !(ad.locs || []).some((l) => l.drv === 'd0') && !(ad.locs ? false : ad.loc), 'موقع المندوب انمسح من الخادم (موقع الإدارة اللي شاركته يبقى لحاله)');
  return base;
}
const base1 = await scenario(8799, 'الخادم الجديد');
// KV: ٣٠ نداء ناجح للمندوب ما يجيبون ولا عملية حذف (الحد المجاني ١٠٠٠ باليوم)
const before = Number(await (await fetch(base1 + '/__kvdeletes')).text());
for (let i = 0; i < 30; i++) java(base1, 'pending', '1357');
const after = Number(await (await fetch(base1 + '/__kvdeletes')).text());
ok(after - before === 0, `٣٠ نداء ناجح = ${after - before} عملية حذف في KV`);
await scenario(8798, 'خادم قديم بدون المسار الخفيف (تراجع تلقائي)', { OLD: '1' });
// وضع «المندوب للتوصيل بس»: فيه مجهز مفعّل، والطلب يوصل المندوب بعد ما يجهز
{
  const base = 'http://127.0.0.1:8797'; procs.push(await server(8797)); console.log('\n== المندوب للتوصيل بس (فيه مجهز)');
  await call(base, '/save', { pin: '2468', data, newDriverPin: '1357' });
  const st = await call(base, '/admin/staff-save', { pin: '2468', name: 'المجهز', role: 'preparer', loginPin: '8642' }); ok(st.ok, 'إضافة مجهز: ' + JSON.stringify(st));
  for (const [ph, nm] of [['0551111111', 'أبو فهد'], ['0552222222', 'أم سعد']]) await call(base, '/admin/order-new', { pin: '2468', source: 'phone', phone: ph, name: nm, loc: '24.8400,46.8300', lines: [{ id: 'pantry0', qty: 1 }] });
  let p = java(base, 'pending', '1357'); ok(p.ok && p.ready && p.fresh === 0 && p.readyAt === 0, 'طلبين جدد ما جهزوا = ما فيه شي للمندوب: ' + JSON.stringify(p));
  const early = await call(base, '/driver/status', { pin: '1357', no: '#1002', status: 'accepted' }); ok(early.code === 'not_ready', 'المندوب ما يقدر يمسك طلب قبل ما يجهز: ' + JSON.stringify(early));
  const prep = await call(base, '/admin/prep', { pin: '2468' }); const o1 = prep.orders.find((o) => o.no === '#1001');
  const sv = await call(base, '/admin/prep-save', { pin: '2468', no: '#1001', version: o1.version, orderUpdated: o1.orderUpdated, stage: 'ready', checks: { 0: 'picked' } }); ok(sv.ok, 'المجهز علّم #1001 جاهز: ' + JSON.stringify(sv));
  p = java(base, 'pending', '1357'); ok(p.ready && p.fresh === 1 && p.readyAt > 0 && p.last === 1001, 'صار فيه طلب جاهز واحد: ' + JSON.stringify(p));
  const f = java(base, 'fresh', '1357', '0', 'ready'); ok(f.count === 1 && f.text.includes('#1001') && f.text.includes('أبو فهد'), 'نص إشعار الطلب الجاهز: ' + f.text);
  const list = await call(base, '/driver/orders', { pin: '1357' }); ok(list.mode === 'ready' && list.orders.find((o) => o.no === '#1001').prepStage === 'ready', 'صفحة المندوب تعرف إنه وضع التوصيل بس');
  const a = await call(base, '/driver/status', { pin: '1357', no: '#1001', status: 'accepted' }), b = await call(base, '/driver/status', { pin: '1357', no: '#1001', status: 'onway' }); ok(a.ok && b.ok, 'استلم الجاهز وطلع للتوصيل');
  p = java(base, 'pending', '1357'); ok(p.fresh === 0 && p.onway === 1, 'بعد ما طلع: ما فيه جاهز، وواحد في الطريق: ' + JSON.stringify(p));
}
for (const p of procs) p.kill();
console.log(fails ? `\n${fails} فشل` : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
