// يطلّع ملفات SRT من مشاهد index.html: ملف لكل مشهد، وملف كامل لكل نسخة بتوقيت مطلق.
// التوقيت من بداية كل مشهد + إزاحة كل سطر. السطر ينتهي عند بداية السطر اللي بعده (أو نهاية المشهد).
// التشغيل: node film/tools/export-srt.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const grab = (name, next) => { const a = html.indexOf('var ' + name + ' = ['), b = html.indexOf('var ' + next + ' = ['); return new Function('S', 'return ' + html.slice(a + ('var ' + name + ' = ').length, b).trim().replace(/;$/, ''))((p, t) => ({ src: p, cap: t })); };
const FILM = grab('FILM', 'SALES'), SALES = grab('SALES', 'SHOTS');
const out = path.join(root, 'srt'); fs.rmSync(out, { recursive: true, force: true });
const ts = (sec) => { const ms = Math.round(sec * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, f = ms % 1000; const p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(h)}:${p(m)}:${p(s)},${p(f, 3)}`; };
const cues = (sc, base) => {
  const res = [];
  sc.vo.forEach((l, i) => {
    if (l[1] == null) return; // أسطر الصمت ما لها نص، وتظهر كفراغ بين الكيوز
    const start = base + l[0];
    const nextStart = i + 1 < sc.vo.length ? base + sc.vo[i + 1][0] : base + sc.dur;
    const end = Math.max(start + 1, nextStart - 0.15);
    res.push({ start, end, text: l[1] });
  });
  return res;
};
const fmt = (list) => list.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n');
function write(dir, scenes) {
  let t = 0, all = []; fs.mkdirSync(path.join(out, dir), { recursive: true });
  scenes.forEach((sc, i) => {
    const list = cues(sc, t); all.push(...list);
    const name = String(i + 1).padStart(2, '0') + '-' + sc.id + '.srt';
    fs.mkdirSync(path.join(out, dir, 'لكل-مشهد'), { recursive: true });
    fs.writeFileSync(path.join(out, dir, 'لكل-مشهد', name), fmt(list.map((c) => ({ ...c, start: c.start - t, end: c.end - t }))));
    t += sc.dur;
  });
  fs.writeFileSync(path.join(out, dir, 'كامل-' + dir + '.srt'), fmt(all));
}
write('الفيلم-السينمائي', FILM); write('النسخة-البيعية', SALES);
console.log('done');
