ДУШИЧКИ – качване в GoDaddy (cPanel)
====================================
Изисквания: PHP 7.4+ с pdo_sqlite, curl, mbstring (в cPanel -> Select PHP Version).

1. Копирай config.example.php като config.php (той не е в GitHub, за да не се качи ключът ти) и го попълни:
   - STRIPE_SECRET_KEY  : sk_test_... (за тест) или sk_live_... (за истински плащания) от Stripe -> Developers -> API keys
   - SITE_URL           : https://твоят-домейн.bg  (без / накрая)
   - MAIL_FROM          : имейл от СВОЯ домейн (напр. info@твоят-домейн.bg), иначе писмата може да отиват в спам
   - ADMIN_PASSWORD     : дълга парола за страницата с поръчки
   - SHIPPING_OFFICE_CENTS / SHIPPING_ADDRESS_CENTS : цена на доставка в евро центове (500 = 5.00 €). 0 = безплатна.
   - SPEEDY_USER / SPEEDY_PASS : по желание. Нужни са, за да се зарежда списък с офисите на Спиди (изисква договор със Спиди и API достъп). Без тях клиентът въвежда офиса на Спиди ръчно. Еконт не иска данни – офисите се зареждат автоматично.
2. Качи ВСИЧКО (index.html, api.php, admin.php, config.php, .htaccess, папка img) в public_html.
3. Включи HTTPS (cPanel -> SSL/TLS Status / AutoSSL).
4. Тест: поръчай нещо с карта 4242 4242 4242 4242 (произволна бъдеща дата и CVC) със sk_test ключ.
5. Поръчките виждаш на https://твоят-домейн.bg/admin.php (потребител: admin, парола: ADMIN_PASSWORD).
   Там има адрес, куриер/офис, размери, бележки и бутон за сваляне на снимката. Получаваш и имейл за всяка платена поръчка.
6. По желание (препоръчително): Stripe -> Developers -> Webhooks -> добави https://твоят-домейн.bg/api.php?a=webhook
   със събитие checkout.session.completed и сложи подписа (whsec_...) в STRIPE_WEBHOOK_SECRET.

Данните се пазят в папка data/ (SQLite) – тя се създава сама и е защитена. Прави си архив от нея периодично.
Снимките се трият 3 дни след "Маркирай като изпратена".
