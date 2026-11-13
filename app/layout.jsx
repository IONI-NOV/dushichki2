import './globals.css';

export const metadata = {
  title: 'Душички',
  description: 'Персонализирани унисекс тениски и худита с бродерия по твоя снимка.',
  icons: { icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/img/icon-48.png', sizes: '48x48', type: 'image/png' }, { url: '/img/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/img/apple-touch-icon.png' },
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
      <body>{children}</body>
    </html>
  );
}
