// يطلّع نص التعليق الصوتي من film/index.html: ملف لكل مشهد، بنسختين (نظيف / مع وقفات).
// التشغيل: node film/tools/export-voiceover.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const grab = (name, next) => { const a = html.indexOf('var ' + name + ' = ['), b = html.indexOf('var ' + next + ' = ['); return new Function('S', 'return ' + html.slice(a + ('var ' + name + ' = ').length, b).trim().replace(/;$/, ''))(() => ({})); };
const FILM = grab('FILM', 'SALES'), SALES = grab('SALES', 'SHOTS');
const out = path.join(root, 'voiceover'); fs.rmSync(out, { recursive: true, force: true });
const pad = (n) => String(n).padStart(2, '0');
function write(dir, label, scenes) {
  let all = { clean: [], pause: [] }, idx = [];
  scenes.forEach((sc, i) => {
    const lines = sc.vo.filter((l) => l[1] != null).map((l) => l[1]);
    const clean = lines.join('\n') + '\n';
    const parts = []; let prev = -9;
    sc.vo.forEach((l) => { if (l[1] == null) { parts.push('<break time="' + 1.5 + 's" />'); } else { parts.push(l[1]); } prev = l[0]; });
    const withP = parts.join('\n') + '\n';
    const name = label + '-' + pad(i + 1) + '-' + sc.id;
    for (const [k, v] of [['نص-نظيف', clean], ['نص-مع-وقفات', withP]]) { fs.mkdirSync(path.join(out, dir, k), { recursive: true }); fs.writeFileSync(path.join(out, dir, k, name + '.txt'), v); }
    all.clean.push('### ' + sc.title + '\n' + clean); all.pause.push('### ' + sc.title + '\n' + withP);
    idx.push(name + '  ·  ' + sc.title + '  ·  ' + lines.join(' ').split(/\s+/).length + ' كلمة  ·  مدة المشهد ' + sc.dur + ' ث');
  });
  fs.writeFileSync(path.join(out, dir, 'كل-المشاهد-نظيف.txt'), all.clean.join('\n')); fs.writeFileSync(path.join(out, dir, 'كل-المشاهد-مع-وقفات.txt'), all.pause.join('\n'));
  fs.writeFileSync(path.join(out, dir, 'الفهرس.txt'), idx.join('\n') + '\n');
}
write('الفيلم-السينمائي', 'film', FILM); write('النسخة-البيعية', 'sales', SALES);
console.log('done');
