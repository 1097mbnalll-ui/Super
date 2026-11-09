// اختبار الدخول الموحد: رقم سري واحد، والرقم يحدد القسم (إدارة، مندوب، كاشير المحل، مجهز، مدير)
// التشغيل:  node server/test/unified-login.mjs   (node 22)
import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(path.join(here, '../worker.js'))).default;
const data = JSON.parse(fs.readFileSync(path.join(here, '../../data.json'), 'utf8')); data.store.closed = false;
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
globalThis.fetch = async (u, o = {}) => { u = String(u); if (u.includes('api.github.com') && !o.method) return new Response(JSON.stringify(data)); return new Response('{"ok":true}'); };
let ipn = 0;
const call = (p, body, ip) => w.fetch(new Request('https://x.dev' + p, { method: 'POST', headers: { Origin: O, 'CF-Connecting-IP': ip || '9.8.' + (ipn++ % 250) + '.1' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then((r) => r.json());
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const A = { pin: '2468' };

let r = await call('/enter', { pin: '2468' }); ok(r.ok && r.go === 'admin', 'رقم الإدارة يودي للإدارة');
await call('/admin/team-save', { ...A, name: 'سعيد', role: 'driver', newPin: '1111' });
await call('/admin/team-save', { ...A, name: 'فهد', role: 'cashier', newPin: '3333' });
r = await call('/enter', { pin: '1111' }); ok(r.ok && r.go === 'driver' && r.name === 'سعيد', 'رقم المندوب يودي لصفحة المندوب');
r = await call('/enter', { pin: '3333' }); ok(r.ok && r.go === 'pos' && r.name === 'فهد', 'رقم كاشير المحل يودي لنقاط البيع');

// مجهز بدون اسم مستخدم ولا كلمة مرور، رقم سري بس
r = await call('/admin/staff-save', { ...A, name: 'علي المجهز', role: 'preparer', loginPin: '5555' }); ok(r.ok, 'إضافة مجهز برقم سري بس: ' + JSON.stringify(r));
r = await call('/admin/staff-save', { ...A, name: 'خالد', role: 'manager', loginPin: '777777' }); ok(r.ok, 'إضافة مدير برقم سري');
ok((await call('/admin/staff-save', { ...A, name: 'بدون', role: 'orders' })).code === 'bad_staff', 'حساب جديد بدون رقم ولا كلمة مرور ينرفض');
let users = (await call('/admin/staff', A)).users;
const ali = users.find((u) => u.name === 'علي المجهز');
ok(ali && ali.hasPin && /^staff-/.test(ali.username), 'القائمة توضح إنه يدخل برقمه');
r = await call('/enter', { pin: '5555' }); ok(r.ok && r.go === 'staff' && r.user.role === 'preparer' && /^[a-f0-9]{64}$/.test(r.token), 'رقم المجهز يفتح جلسة تجهيز');
ok((await call('/admin/prep', { session: r.token })).ok, 'جلسة المجهز تفتح قائمة التجهيز');
ok((await call('/admin/staff', { session: r.token })).code === 'forbidden', 'والمجهز ما يقدر يشوف الحسابات');
r = await call('/enter', { pin: '777777' }); ok(r.ok && r.go === 'staff' && r.user.role === 'manager', 'رقم المدير يفتح الإدارة بصلاحية مدير');

// كل رقم لشخص واحد بس
ok((await call('/admin/staff-save', { ...A, name: 'x', role: 'orders', loginPin: '1111' })).code === 'pin_taken', 'رقم المندوب ما ينعطى لموظف');
ok((await call('/admin/staff-save', { ...A, name: 'x', role: 'orders', loginPin: '2468' })).code === 'pin_taken', 'رقم الإدارة ما ينعطى لموظف');
ok((await call('/admin/staff-save', { ...A, name: 'x', role: 'orders', loginPin: '5555' })).code === 'pin_taken', 'رقم المجهز ما ينعطى لموظف ثاني');
ok((await call('/admin/team-save', { ...A, name: 'x', role: 'driver', newPin: '5555' })).code === 'pin_taken', 'رقم المجهز ما ينعطى لمندوب');
ok((await call('/save', { ...A, data, newPin: '5555' })).code === 'pin_taken', 'والإدارة ما تغيّر رقمها لرقم موظف');
ok((await call('/save', { ...A, data, newDriverPin: '777777' })).code === 'driver_pin_same', 'ولا رقم المندوب القديم');

// تعديل بدون رقم يبقي الرقم القديم، وتغيير الرقم يبطل القديم
ok((await call('/admin/staff-save', { ...A, id: ali.id, name: 'علي', role: 'preparer', active: true })).ok, 'تعديل الاسم بدون رقم');
ok((await call('/enter', { pin: '5555' })).ok, 'الرقم القديم باقي');
ok((await call('/admin/staff-save', { ...A, id: ali.id, name: 'علي', role: 'preparer', active: true, loginPin: '5656' })).ok, 'تغيير رقم المجهز');
ok((await call('/enter', { pin: '5555' })).code === 'bad_pin' && (await call('/enter', { pin: '5656' })).ok, 'الرقم القديم بطل والجديد يشتغل');
ok((await call('/admin/staff-save', { ...A, id: ali.id, name: 'علي', role: 'preparer', active: false })).ok, 'إيقاف المجهز');
ok((await call('/enter', { pin: '5656' })).code === 'bad_pin', 'الموقوف ما يدخل');

// رقم غلط، والقفل بعد محاولات كثيرة من نفس الجهاز
ok((await call('/enter', { pin: '0000' })).code === 'bad_pin', 'رقم غلط');
ok((await call('/enter', { pin: 'abc' })).code === 'bad_pin', 'رقم مو أرقام');
let last; for (let i = 0; i < 12; i++) last = await call('/enter', { pin: String(9000 + i) }, '7.7.7.7');
ok(last.code === 'locked', 'محاولات غلط كثيرة تقفل الدخول: ' + last.code);
ok((await call('/enter', { pin: '2468' }, '7.7.7.7')).code === 'locked', 'حتى الرقم الصح ينتظر لين ينفك القفل');

// الطرق القديمة لسا تشتغل
ok((await call('/driver/login', { pin: '1111' })).ok && (await call('/pos/login', { pin: '3333' })).ok && (await call('/login', A)).ok, 'الدخول القديم للمندوب والكاشير والإدارة يشتغل');
console.log(fails ? '\n' + fails + ' فحص فشل' : '\nكل الفحوص نجحت'); process.exit(fails ? 1 : 0);
