'use client';

// Бутон „Отвори пощата“ под съобщенията „Изпратихме ти имейл…“.
// Познава пощата по домейна на имейла; за Gmail отваря точния акаунт и търси писмата от нас.
const PROVIDERS = [
  { re: /@(gmail|googlemail)\.com$/i, n: 'Gmail', url: (e) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(e)}#search/from%3Adushichki.com` },
  { re: /@abv\.bg$/i, n: 'ABV', url: () => 'https://www.abv.bg/' },
  { re: /@mail\.bg$/i, n: 'Mail.bg', url: () => 'https://mail.bg/' },
  { re: /@(yahoo|ymail)\./i, n: 'Yahoo Mail', url: () => 'https://mail.yahoo.com/' },
  { re: /@(outlook|hotmail|live|msn)\./i, n: 'Outlook', url: () => 'https://outlook.live.com/mail/' },
  { re: /@(icloud|me|mac)\.com$/i, n: 'iCloud Mail', url: () => 'https://www.icloud.com/mail/' },
];

export default function MailButton({ email }) {
  const e = (email || '').trim();
  const p = PROVIDERS.find((x) => x.re.test(e));
  const href = p ? p.url(e) : 'https://mail.google.com/mail/';
  const label = p ? 'Отвори ' + p.n : 'Отвори Gmail';
  return (
    <p style={{ marginTop: 16 }}>
      <a className="btn add" href={href} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: '1.1rem', width: 'auto', padding: '12px 28px', display: 'inline-block', textDecoration: 'none' }}>
        ✉️ {label}
      </a>
    </p>
  );
}
