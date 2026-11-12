// Връзка с PHP бекенда (api.php). На качения сайт е на същия адрес.
const BASE = process.env.NEXT_PUBLIC_API_URL || '/api.php';

export async function api(a, body, extra) {
  const o = { method: body ? 'POST' : 'GET', headers: { 'X-Requested-With': 'fetch' }, credentials: 'include' };
  if (typeof FormData !== 'undefined' && body instanceof FormData) o.body = body;
  else if (body) { o.body = JSON.stringify(body); o.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(BASE + '?a=' + a + (extra || ''), o);
  let j;
  try { j = await r.json(); } catch (e) { throw new Error('Сървърът не отговори правилно.'); }
  if (!r.ok || j.error) throw new Error(j.error || 'Грешка');
  return j;
}

// Умалена квадратна снимка за количката
export function thumb(f) {
  return new Promise((res) => {
    const u = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      const s = Math.min(im.width, im.height);
      x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 128, 128);
      URL.revokeObjectURL(u);
      res(c.toDataURL('image/jpeg', 0.7));
    };
    im.onerror = () => { URL.revokeObjectURL(u); res(''); };
    im.src = u;
  });
}
