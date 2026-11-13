// Проверка на имейл адрес: формат + най-честите правописни грешки в популярни домейни.
const KNOWN = ['gmail.com', 'abv.bg', 'yahoo.com', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'mail.bg', 'dir.bg', 'gbg.bg', 'proton.me', 'protonmail.com', 'mail.com', 'gmx.com', 'yandex.com', 'mail.ru', 'abv.com.bg', 'vivacom.bg', 'a1.bg', 'yahoo.co.uk', 'googlemail.com', 'outlook.bg', 'msn.com', 'aol.com', 'zoho.com'];
const BAD_TLD = { con: 'com', cmo: 'com', ocm: 'com', vom: 'com', xom: 'com', cim: 'com', comm: 'com', coom: 'com', cm: 'com', gb: 'bg', bgg: 'bg', bgd: 'bg', bh: 'bg', nbg: 'bg', vg: 'bg' };

function dist(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Връща '' ако е наред, иначе текст на български.
export function checkEmail(raw) {
  const e = String(raw || '').trim();
  if (!e) return 'Въведи имейл.';
  const m = e.match(/^([^\s@]+)@([^\s@]+)$/);
  if (!m) return 'Невалиден имейл. Провери дали има @ и домейн.';
  const local = m[1];
  const domain = m[2].toLowerCase();
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..') || /[(),:;<>[\]\\"]/.test(local))
    return 'Невалиден имейл – проверете частта преди @.';
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || domain.startsWith('-') || domain.includes('..'))
    return 'Невалиден имейл – проверете домейна след @.';
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  if (tld.length < 2) return 'Невалиден имейл – домейнът е непълен.';
  if (KNOWN.includes(domain)) return '';
  // Грешка в края (.con, .cmo, .gb ...)
  if (BAD_TLD[tld]) return `Невалиден имейл. Може би имаш предвид ${local}@${parts.slice(0, -1).concat(BAD_TLD[tld]).join('.')}?`;
  // Грешка в името на популярен домейн (gmial.com, gmai.com, abv.com, yahooo.com ...)
  if (domain === 'abv.com') return `Невалиден имейл. Може би имаш предвид ${local}@abv.bg?`;
  const best = KNOWN.map((k) => [k, dist(domain, k)]).sort((a, b) => a[1] - b[1])[0];
  const limit = domain.length >= 9 ? 2 : 1;
  if (best && best[1] <= limit) return `Невалиден имейл. Може би имаш предвид ${local}@${best[0]}?`;
  return '';
}
