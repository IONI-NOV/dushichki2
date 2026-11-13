import './globals.css';

const SITE = 'https://dushichki.com';
const TITLE = 'Душички - Спомени, които обличаш.';
const DESC = 'Душички – персонализирани худита и тениски с бродерия по твоя снимка. Спомени, които обличаш.';

export const metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  applicationName: 'Душички',
  alternates: { canonical: '/' },
  icons: { icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/img/icon-48.png', sizes: '48x48', type: 'image/png' }, { url: '/img/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/img/apple-touch-icon.png' },
  openGraph: { type: 'website', url: SITE, siteName: 'Душички', title: TITLE, description: DESC, locale: 'bg_BG', images: [{ url: '/img/hero.jpg' }] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: ['/img/hero.jpg'] },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: 'Душички', alternateName: ['dushichki', 'Dushichki', 'Dushichki.com'], inLanguage: 'bg' },
    { '@type': 'Organization', '@id': SITE + '/#org', name: 'Душички', alternateName: 'dushichki', url: SITE + '/', logo: SITE + '/img/icon-512.png', email: 'info@dushichki.com', slogan: 'Спомени, които обличаш.' },
  ],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFF9E8',
};

export default function RootLayout({ children }) {
  return (
    <html lang="bg">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;600;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
      </body>
    </html>
  );
}
