// مواعيد استقبال الطلبات: openNow (توقيت الرياض، يقبل القفل بعد منتصف الليل)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const fn = src.slice(src.indexOf('function openNow('), src.indexOf('\nfunction priceOrder('));
const openNow = new Function(fn + '; return openNow;')();
const at = (h, m = 0) => Date.UTC(2026, 10, 12, (h - 3 + 24) % 24, m); // ساعة الرياض h:m
const S = { openAt: '12:00', closeAt: '01:00' };
assert.equal(openNow(S, at(11, 59)), false, '11:59 الصبح مقفل');
assert.equal(openNow(S, at(12, 0)), true, '12 الظهر يفتح');
assert.equal(openNow(S, at(18)), true);
assert.equal(openNow(S, at(23, 59)), true);
assert.equal(openNow(S, at(0, 30)), true, '12:30 بالليل مفتوح');
assert.equal(openNow(S, at(1, 0)), false, '1 بالليل يقفل');
assert.equal(openNow(S, at(5)), false);
assert.equal(openNow({ openAt: '08:00', closeAt: '22:00' }, at(21, 59)), true);
assert.equal(openNow({ openAt: '08:00', closeAt: '22:00' }, at(22)), false);
assert.equal(openNow({}, at(3)), true, 'بدون مواعيد = مفتوح');
console.log('hours ok');
