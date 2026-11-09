// Local-only GitHub Contents API adapter. No network or production credentials.
import { createHash } from 'node:crypto';
export function githubMock(getData, fallback = async () => new Response('{"ok":true}'), persist = false) {
  const sha = data => createHash('sha1').update(JSON.stringify(data)).digest('hex');
  return async (url, options = {}) => {
    if (!String(url).includes('api.github.com')) return fallback(url, options);
    const data = getData();
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      if (body.sha !== sha(data)) return new Response('{"message":"conflict"}', { status:409 });
      const next = JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));
      if (persist) { for (const key of Object.keys(data)) delete data[key]; Object.assign(data, next); }
      return Response.json({ content:{ sha:sha(next) } });
    }
    const accept = new Headers(options.headers).get('accept') || '';
    if (accept.includes('github.raw')) return Response.json(data);
    return Response.json({sha:sha(data),content:Buffer.from(JSON.stringify(data)).toString('base64'),encoding:'base64'});
  };
}
