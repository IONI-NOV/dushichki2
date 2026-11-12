# Душички – Next.js

Фронтендът е на Next.js (App Router, React), а бекендът (поръчки, регистрация, Stripe, офиси на Спиди/Еконт, база SQLite) е PHP в `public/` и работи на GoDaddy cPanel.

## Нужно за компютъра (само за да „построиш“ сайта)
- Node.js 20 или по-нов (nodejs.org, „LTS“)

## Стъпки
1. `npm install`
2. Копирай `public/config.example.php` като `public/config.php` (той е в .gitignore и не влиза в git) и попълни Stripe ключ, адрес на сайта, имейл, парола за админ, цени на доставка (и данни за Спиди, ако имаш).
3. `npm run build` – създава папка `out/` (това е готовият сайт).
4. Качи **съдържанието на `out/`** в `public_html` на GoDaddy (File Manager или FTP). Включи HTTPS.
5. Тест: `https://твоят-домейн/` – поръчай с карта 4242 4242 4242 4242 (със sk_test ключ).

Поръчките: `https://твоят-домейн/admin.php` (потребител `admin`, паролата от `config.php`).

## Локално
- `npm run dev` – само дизайн (без вход/плащане, бекендът не работи под `next dev`).
- `npm run build && npm run serve` – пълен сайт на http://localhost:8000 (нужен е PHP със sqlite и curl).

## Структура
- `app/` – страница, оформление, стилове
- `components/` – Shop, ProductDialog, CartDialog, Checkout, SizeDialog, LegalDialog
- `lib/` – продукти/цени (`data.js`), връзка с бекенда (`api.js`), Общи условия и Политика (`legal.js`)
- `public/` – снимки, `api.php`, `admin.php`, `config.php`, `.htaccess`
