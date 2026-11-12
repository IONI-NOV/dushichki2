/** @type {import('next').NextConfig} */
const nextConfig = {
  // Статичен износ: `npm run build` създава папка out/, която се качва в GoDaddy (public_html).
  // Бекендът (api.php, admin.php, config.php) се копира от public/ в out/ автоматично.
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: false,
};
export default nextConfig;
