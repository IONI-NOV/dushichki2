<?php
// НАСТРОЙКИ НА САЙТА. Попълни ги преди да качиш сайта.

// Stripe → Developers → API keys → Secret key (sk_test_... за тест, sk_live_... за истински плащания)
const STRIPE_SECRET_KEY = '';

// По желание: Stripe → Developers → Webhooks → signing secret (whsec_...). Адрес на webhook: https://ТВОЯТ-САЙТ/api.php?a=webhook
const STRIPE_WEBHOOK_SECRET = '';

// Адрес на сайта без / накрая, напр. https://dushichki.bg  (празно = определя се автоматично)
const SITE_URL = '';

// Къде да пристигат известията за нови поръчки
const OWNER_EMAIL = 'dushichki@gmail.com';

// От кой адрес да излизат имейлите (трябва да е от твоя домейн, иначе отиват в спам)
const MAIL_FROM = 'no-reply@dushichki.bg';

// Цена на доставката в евроцентове (0 = безплатна). Пример: 500 = 5 €
const SHIPPING_OFFICE_CENTS = 0;   // до офис на Спиди / Еконт
const SHIPPING_ADDRESS_CENTS = 0;  // до адрес

// Спиди: данни за API достъп (дава ги Спиди на фирмени клиенти; писмо до api.registration@speedy.bg).
// Ако са празни, клиентът въвежда офиса на Спиди ръчно. Списъкът с офиси на Еконт е публичен и не иска данни.
const SPEEDY_USER = '';
const SPEEDY_PASS = '';

// Само ако Еконт ти поиска вход за списъка с офиси (по подразбиране не е нужно).
const ECONT_USER = '';
const ECONT_PASS = '';

// Парола за страницата с поръчките: https://ТВОЯТ-САЙТ/admin.php  (потребител: admin). Задължително я смени!
const ADMIN_PASSWORD = '';

// Къде се пази базата данни и качените снимки. Най-добре е ИЗВЪН public_html, напр. '/home/ПОТРЕБИТЕЛ/dushichki-data'
const DATA_DIR = __DIR__ . '/data';
