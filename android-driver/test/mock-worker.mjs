import { githubMock } from '../../server/test/support/github.mjs';
// خادم تجريبي: يشغّل server/worker.js الحقيقي على قاعدة SQLite في الذاكرة، ويفتحه على منفذ HTTP.
// OLD=1 يخلّي مسار /driver/pending يرجع «غير موجود» (يحاكي خادم قديم ما اتحدّث).
import http from 'node:http'; import { DatabaseSync } from 'node:sqlite'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (await import(process.env.WORKER || path.join(here, '../../server/worker.js'))).default;
const data = JSON.parse(fs.readFileSync(process.env.CATALOG_FILE || path.join(here, '../../server/test/fixtures/catalog.json'), 'utf8'));
const sq = new DatabaseSync(':memory:');
const mk1 = (sql) => { let a = []; const st = { bind(...x) { a = x; return st; }, async first() { return sq.prepare(sql).get(...a) ?? null; }, async all() { return { results: sq.prepare(sql).all(...a) }; }, async run() { const r = sq.prepare(sql).run(...a); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
const DB = { prepare: mk1, async batch(l) { sq.exec('BEGIN'); try { const o = []; for (const s of l) o.push(await s.run()); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
const kv = new Map(); const LOCKS = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v), delete: async (k) => { kvDeletes++; kv.delete(k); } };
let kvDeletes = 0;
const O = 'https://1097mbnalll-ui.github.io';
const env = { GITHUB_TOKEN: 'x', ADMIN_PIN: '2468', SECRET: 's', REPO: 'o/r', BRANCH: 'gh-pages', ALLOWED_ORIGIN: O, LOCKS, DB };
const realFetch = globalThis.fetch;
globalThis.fetch = githubMock(() => data, async (u, o = {}) => { u = String(u); if (u.includes('api.github.com') && !o.method) return new Response(JSON.stringify(data)); if (u.startsWith('http://127.0.0.1')) return realFetch(u, o); return new Response('{"ok":true}'); }, true);
const port = Number(process.env.PORT || 8799);
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c); let body = Buffer.concat(chunks);
  if (req.url === '/__kvdeletes') { res.end(String(kvDeletes)); return; }
  if (process.env.OLD && req.url === '/driver/pending') { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"ok":false,"code":"not_found"}'); return; }
  if(req.url==='/save'&&body.length){const parsed=JSON.parse(body);if(!parsed.baseVersion){const baseline=await w.fetch(new Request('https://x.dev/admin/catalog',{method:'POST',headers:{Origin:O,'Content-Type':'application/json'},body:JSON.stringify({pin:parsed.pin})}),env,{waitUntil(){}});parsed.baseVersion=(await baseline.json()).version;body=Buffer.from(JSON.stringify(parsed));}}
  const r = new Request('https://x.dev' + req.url, { method: req.method, headers: { Origin: req.headers.origin || '', 'CF-Connecting-IP': '7.7.7.7', 'content-type': 'application/json' }, body: req.method === 'POST' ? body : undefined });
  const x = await w.fetch(r, env, { waitUntil() {} }); res.writeHead(x.status, { 'content-type': 'application/json' }); res.end(await x.text());
}).listen(port, '127.0.0.1', () => console.log('mock worker on', port));
