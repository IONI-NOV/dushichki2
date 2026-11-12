# Душички – Next.js

Фронтендът е на Next.js (App Router, React), а бекендът (поръчки, регистрация, Stripe, офиси на Спиди/Еконт, база SQLite) е PHP в `public/` и работи на GoDaddy cPanel.

## Готов сайт (без Node)
В папка `out/` има вече построена версия с `index.html`. За да я ползваш: качи съдържанието ѝ в `public_html`, преименувай `config.example.php` на `config.php` и го попълни. Тя е изградена с esbuild от същите компоненти; `npm run build` създава еквивалентна папка `out/` с Next.js.

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

## Supabase (динамичен режим, без автентикация)

1. `npm install` (инсталира `@supabase/supabase-js` и `@supabase/ssr`).
2. Копирай `.env.example` в `.env` и попълни `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (само publishable ключ – никога secret/service_role).
3. `npm run dev`.

Когато променливите са зададени, снимките се качват в частния bucket `photos`, а поръчките се записват в таблиците `orders` / `order_items`
(`lib/supabase.js`). Всеки посетител (роля `anon`) може само да ИЗПРАЩА данни (RLS политики за INSERT); четене няма през публичния API –
поръчките се гледат от Supabase Dashboard. Схемата е в `supabase/migrations/`. Плащането със Stripe в този режим още не е свързано
(изисква сървърна функция със secret ключ).

### Регистрация и поръчки
Регистрацията/входът ползват Supabase Auth (имейл + парола). При регистрация се създава ред в `profiles` (автоматично, чрез trigger).
Поръчките на влезли потребители се свързват с `orders.user_id` и се виждат в „Моите поръчки“; гостите поръчват без акаунт.
Ако в Supabase → Authentication → Providers → Email е включено „Confirm email“, новият потребител трябва първо да потвърди имейла си.
