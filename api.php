<?php
// Бекенд на "Душички": акаунти, гост поръчки, качване на снимки, офиси на Спиди/Еконт, поръчки, плащане през Stripe Checkout.
// Изисква PHP 7.4+ с PDO SQLite и cURL (има ги на GoDaddy cPanel хостинг).
require __DIR__ . '/config.php';

const PRICES = ['hoodie' => 4500, 'tee' => 3500];
const TEXT_ADD = 100;
const DESIGNS = ['Персонализирана бродерия по снимка', 'Персонализирана бродерия на домашен любимец', 'Персонализирана бродерия на починал близък'];
const KINDS = [
    'hoodie' => ['name' => 'Худи', 'colors' => ['Черно худи + бял конец', 'Бяло худи + черен конец'], 'sizes' => ['S', 'M', 'L', 'XL', '3XL']],
    'tee' => ['name' => 'Тениска', 'colors' => ['Черна тениска + бял конец', 'Бяла тениска + черен конец'], 'sizes' => ['S', 'M', 'L', 'XL', '3XL']],
];
const COURIERS = ['speedy' => 'Спиди', 'econt' => 'Еконт'];

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function out($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function fail($m, $c = 400) { out(['error' => $m], $c); }
function clean($v, $max) { return mb_substr(trim((string)$v), 0, $max); }

function db() {
    static $p = null;
    if ($p) return $p;
    foreach ([DATA_DIR, DATA_DIR . '/uploads', DATA_DIR . '/cache'] as $d) if (!is_dir($d)) mkdir($d, 0750, true);
    $ht = DATA_DIR . '/.htaccess';
    if (!file_exists($ht)) @file_put_contents($ht, "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    $p = new PDO('sqlite:' . DATA_DIR . '/dushichki.sqlite');
    $p->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $p->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $p->exec("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pass_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, public_id TEXT UNIQUE NOT NULL, user_id INTEGER, name TEXT, email TEXT, phone TEXT, address TEXT, city TEXT, zip TEXT,
      total_cents INTEGER, shipping_cents INTEGER, status TEXT NOT NULL DEFAULT 'pending', stripe_session_id TEXT, stripe_payment_intent TEXT, created_at INTEGER, paid_at INTEGER, shipped_at INTEGER);
    CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, kind TEXT, design TEXT, color TEXT, size TEXT, text_under TEXT, story TEXT, notes TEXT, unit_cents INTEGER, photo_file TEXT);
    CREATE TABLE IF NOT EXISTS uploads(token TEXT PRIMARY KEY, file TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);");
    // Допълнителни колони (добавят се автоматично и към стара база)
    $have = [];
    foreach ($p->query("PRAGMA table_info(orders)")->fetchAll() as $c) $have[$c['name']] = true;
    foreach (['guest' => 'INTEGER DEFAULT 0', 'courier' => 'TEXT', 'delivery_type' => 'TEXT', 'office_id' => 'TEXT', 'office_name' => 'TEXT', 'office_addr' => 'TEXT',
              'street' => 'TEXT', 'street_no' => 'TEXT', 'block' => 'TEXT', 'apt' => 'TEXT', 'office_note' => 'TEXT'] as $col => $def)
        if (!isset($have[$col])) $p->exec("ALTER TABLE orders ADD COLUMN $col $def");
    $haveI = [];
    foreach ($p->query("PRAGMA table_info(order_items)")->fetchAll() as $c) $haveI[$c['name']] = true;
    foreach (['halo' => 'TEXT', 'halo_who' => 'TEXT'] as $col => $def)
        if (!isset($haveI[$col])) $p->exec("ALTER TABLE order_items ADD COLUMN $col $def");
    return $p;
}

// Снимките се трият до 3 дни след изпращане на поръчката (както е в Политиката за поверителност).
// Неизползвани качвания (без поръчка) се трият след 2 дни.
function cleanup() {
    $db = db();
    $rows = $db->prepare("SELECT i.id, i.photo_file FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.shipped_at IS NOT NULL AND o.shipped_at<=? AND i.photo_file IS NOT NULL");
    $rows->execute([time() - 3 * 86400]);
    foreach ($rows->fetchAll() as $r) {
        @unlink(DATA_DIR . '/uploads/' . basename($r['photo_file']));
        $db->prepare("UPDATE order_items SET photo_file=NULL WHERE id=?")->execute([$r['id']]);
    }
    $old = $db->prepare("SELECT token,file FROM uploads WHERE used=0 AND created_at<=?");
    $old->execute([time() - 2 * 86400]);
    foreach ($old->fetchAll() as $r) {
        @unlink(DATA_DIR . '/uploads/' . basename($r['file']));
        $db->prepare("DELETE FROM uploads WHERE token=?")->execute([$r['token']]);
    }
}

function stripe($path, $post = null) {
    if (STRIPE_SECRET_KEY === '') throw new RuntimeException('Stripe не е настроен.');
    $base = getenv('DSH_STRIPE_BASE') ?: 'https://api.stripe.com/v1/';
    $ch = curl_init($base . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => STRIPE_SECRET_KEY . ':', CURLOPT_TIMEOUT => 25]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $r = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = json_decode((string)$r, true);
    if ($code >= 400 || !is_array($j)) throw new RuntimeException(isset($j['error']['message']) ? $j['error']['message'] : 'Грешка при връзка със Stripe.');
    return $j;
}

/* ---------- Офиси на Спиди / Еконт ---------- */
function httpJson($url, $body, $timeout = 90, $userpwd = null) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body), CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => $timeout, CURLOPT_ENCODING => '']);
    if ($userpwd) curl_setopt($ch, CURLOPT_USERPWD, $userpwd);
    $r = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = json_decode((string)$r, true);
    if ($code >= 400 || !is_array($j)) throw new RuntimeException('Куриерът не отговори (HTTP ' . $code . ').');
    return $j;
}

function fetchEcont() {
    $auth = ECONT_USER !== '' ? ECONT_USER . ':' . ECONT_PASS : null;
    $j = httpJson('https://ee.econt.com/services/Nomenclatures/NomenclaturesService.getOffices.json', ['countryCode' => 'BGR'], 120, $auth);
    $out = [];
    foreach (isset($j['offices']) ? $j['offices'] : [] as $o) {
        if (empty($o['id'])) continue;
        $st = isset($o['shipmentTypes']) && is_array($o['shipmentTypes']) ? $o['shipmentTypes'] : ['post'];
        if (!in_array('post', $st, true) && !in_array('courier', $st, true)) continue;
        $c = isset($o['address']['city']) ? $o['address']['city'] : [];
        $out[] = ['id' => (string)$o['id'], 'n' => trim((string)$o['name']), 'c' => trim((string)($c['name'] ?? '')), 'z' => (string)($c['postCode'] ?? ''),
                  'a' => trim((string)($o['address']['fullAddress'] ?? '')), 'p' => !empty($o['isAPS']) ? 1 : 0];
    }
    return $out;
}

function fetchSpeedy() {
    if (SPEEDY_USER === '') return null;
    $j = httpJson('https://api.speedy.bg/v1/location/office', ['userName' => SPEEDY_USER, 'password' => SPEEDY_PASS, 'language' => 'BG', 'countryId' => 100], 120);
    $out = [];
    foreach (isset($j['offices']) ? $j['offices'] : [] as $o) {
        if (!isset($o['id'])) continue;
        $ad = isset($o['address']) ? $o['address'] : [];
        $out[] = ['id' => (string)$o['id'], 'n' => trim((string)($o['name'] ?? '')), 'c' => trim((string)($ad['siteName'] ?? ($o['siteName'] ?? ''))), 'z' => (string)($ad['postCode'] ?? ''),
                  'a' => trim((string)($ad['fullAddressString'] ?? ($ad['localAddressString'] ?? ''))), 'p' => (($o['type'] ?? '') === 'APT') ? 1 : 0];
    }
    if (!$out) throw new RuntimeException('Спиди не върна офиси.');
    return $out;
}

// Връща списък офиси или null (= ръчно въвеждане на офис)
function loadOffices($courier) {
    db();
    $f = DATA_DIR . '/cache/offices_' . $courier . '.json';
    $read = function () use ($f) { $j = json_decode((string)@file_get_contents($f), true); return is_array($j) && $j ? $j : null; };
    if (is_file($f) && filemtime($f) > time() - 86400 && ($j = $read())) return $j;
    try {
        $list = $courier === 'econt' ? fetchEcont() : fetchSpeedy();
        if ($list === null) return $read();
        if (!$list) throw new RuntimeException('Празен списък.');
        usort($list, function ($a, $b) { return strcmp($a['c'] . $a['n'], $b['c'] . $b['n']); });
        file_put_contents($f, json_encode($list, JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $list;
    } catch (Exception $e) {
        error_log('Офиси ' . $courier . ': ' . $e->getMessage());
        return $read();
    }
}

function siteUrl() {
    if (SITE_URL !== '') return rtrim(SITE_URL, '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    return ($https ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
}

function sendMail($to, $subject, $body) {
    $h = "From: Душички <" . MAIL_FROM . ">\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $h);
}

function deliveryText($o) {
    $c = isset(COURIERS[$o['courier']]) ? COURIERS[$o['courier']] : '';
    if ($o['delivery_type'] === 'office') {
        return "Куриер: $c, до офис\nОфис: " . $o['office_name'] . ($o['office_addr'] ? ' (' . $o['office_addr'] . ')' : '') . "\nГрад: " . $o['city'] . ($o['zip'] ? ', ' . $o['zip'] : '');
    }
    $a = $o['street'] . ' ' . $o['street_no'] . ($o['block'] ? ', ' . $o['block'] : '') . ($o['apt'] ? ', ап. ' . $o['apt'] : '');
    return "Куриер: $c, до адрес\nАдрес: $a\n" . $o['zip'] . ' ' . $o['city'] . ($o['office_note'] ? "\nОфис при нужда: " . $o['office_note'] : '');
}

function orderText($o) {
    $s = db()->prepare("SELECT * FROM order_items WHERE order_id=?");
    $s->execute([$o['id']]);
    $t = "Поръчка " . $o['public_id'] . ($o['guest'] ? ' (гост)' : '') . "\nСума: " . number_format($o['total_cents'] / 100, 2) . " €\n\n";
    foreach ($s->fetchAll() as $i) {
        $t .= "- " . $i['kind'] . " | " . $i['design'] . " | " . $i['color'] . " | размер " . $i['size'] . "\n";
        if (!empty($i['halo'])) $t .= "  " . $i['halo'] . " – за: " . $i['halo_who'] . "\n";
        if ($i['text_under']) $t .= "  Текст под дизайна: " . $i['text_under'] . "\n";
        if ($i['story']) $t .= "  История: " . $i['story'] . "\n";
        if ($i['notes']) $t .= "  Бележки: " . $i['notes'] . "\n";
    }
    return $t . "\nПолучател: " . $o['name'] . "\nТел.: " . $o['phone'] . "\nИмейл: " . $o['email'] . "\n" . deliveryText($o) . "\n";
}

function markPaid($pid, $pi) {
    $u = db()->prepare("UPDATE orders SET status='paid', paid_at=?, stripe_payment_intent=? WHERE public_id=? AND status='pending'");
    $u->execute([time(), $pi, $pid]);
    if ($u->rowCount() !== 1) return;
    $q = db()->prepare("SELECT * FROM orders WHERE public_id=?");
    $q->execute([$pid]);
    $o = $q->fetch();
    $txt = orderText($o);
    sendMail(OWNER_EMAIL, 'Нова платена поръчка ' . $pid, $txt . "\nСнимките и всички поръчки: " . siteUrl() . "/admin.php\n");
    sendMail($o['email'], 'Получихме поръчка ' . $pid . ' – Душички', "Благодарим ти за поръчката!\n\n" . $txt . "\nИзработката отнема до 7 календарни дни, след което пратката се предава на куриер.\nВъпроси: " . OWNER_EMAIL . "\n");
}

function userRow() {
    if (empty($_SESSION['uid'])) return null;
    $q = db()->prepare("SELECT id,name,email FROM users WHERE id=?");
    $q->execute([$_SESSION['uid']]);
    return $q->fetch() ?: null;
}

function bodyJson() { $j = json_decode((string)file_get_contents('php://input'), true); return is_array($j) ? $j : []; }

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
session_start();

$a = isset($_GET['a']) ? $_GET['a'] : '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $a !== 'webhook' && (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || $_SERVER['HTTP_X_REQUESTED_WITH'] !== 'fetch')) fail('Невалидна заявка.', 403);

try {
    switch ($a) {
        case 'ping':
            if (mt_rand(1, 20) === 1) cleanup();
            db();
            out(['ok' => true, 'ship_office' => (int)SHIPPING_OFFICE_CENTS, 'ship_address' => (int)SHIPPING_ADDRESS_CENTS, 'user' => userRow()]);

        case 'offices': {
            $c = isset($_GET['courier']) ? $_GET['courier'] : '';
            if (!isset(COURIERS[$c])) fail('Непознат куриер.');
            $l = loadOffices($c);
            out($l === null ? ['manual' => true, 'offices' => []] : ['manual' => false, 'offices' => $l]);
        }

        case 'register': {
            $d = bodyJson();
            $name = clean($d['name'] ?? '', 80); $email = strtolower(clean($d['email'] ?? '', 120)); $pw = (string)($d['password'] ?? '');
            if (mb_strlen($name) < 2) fail('Въведи име.');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Невалиден имейл.');
            if (strlen($pw) < 8) fail('Паролата трябва да е поне 8 символа.');
            $q = db()->prepare("SELECT 1 FROM users WHERE email=?"); $q->execute([$email]);
            if ($q->fetch()) fail('Вече има акаунт с този имейл. Влез в него.', 409);
            db()->prepare("INSERT INTO users(email,name,pass_hash,created_at) VALUES(?,?,?,?)")->execute([$email, $name, password_hash($pw, PASSWORD_DEFAULT), time()]);
            session_regenerate_id(true);
            $_SESSION['uid'] = (int)db()->lastInsertId();
            out(['user' => userRow()]);
        }

        case 'login': {
            $d = bodyJson();
            $email = strtolower(clean($d['email'] ?? '', 120)); $pw = (string)($d['password'] ?? '');
            $q = db()->prepare("SELECT * FROM users WHERE email=?"); $q->execute([$email]);
            $u = $q->fetch();
            if (!$u || !password_verify($pw, $u['pass_hash'])) { usleep(500000); fail('Грешен имейл или парола.', 401); }
            session_regenerate_id(true);
            $_SESSION['uid'] = (int)$u['id'];
            out(['user' => userRow()]);
        }

        case 'logout':
            $_SESSION = []; session_destroy();
            out(['ok' => true]);

        case 'orders': {
            $u = userRow();
            if (!$u) fail('Не си влязъл.', 401);
            $q = db()->prepare("SELECT public_id,status,total_cents,created_at FROM orders WHERE user_id=? AND status NOT IN ('pending','error') ORDER BY id DESC LIMIT 30");
            $q->execute([$u['id']]);
            out(['orders' => $q->fetchAll()]);
        }

        case 'upload': {
            if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) fail('Снимката не се качи. Опитай с друга.');
            $f = $_FILES['photo'];
            if ($f['size'] > 12 * 1024 * 1024) fail('Снимката е твърде голяма (до 12 MB).');
            $info = @getimagesize($f['tmp_name']);
            $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'];
            if (!$info || !isset($ext[$info[2]])) fail('Качи снимка във формат JPG, PNG или WEBP.');
            $token = bin2hex(random_bytes(16));
            $file = $token . '.' . $ext[$info[2]];
            db();
            $ok = is_uploaded_file($f['tmp_name']) ? move_uploaded_file($f['tmp_name'], DATA_DIR . '/uploads/' . $file) : false;
            if (!$ok) fail('Снимката не можа да се запази.', 500);
            db()->prepare("INSERT INTO uploads(token,file,created_at) VALUES(?,?,?)")->execute([$token, $file, time()]);
            out(['token' => $token]);
        }

        case 'checkout': {
            $d = bodyJson();
            $c = isset($d['customer']) && is_array($d['customer']) ? $d['customer'] : [];
            $cu = ['name' => clean($c['name'] ?? '', 100), 'email' => strtolower(clean($c['email'] ?? '', 120)), 'phone' => clean($c['phone'] ?? '', 30)];
            if (mb_strlen($cu['name']) < 2) fail('Въведи име и фамилия.');
            if (!filter_var($cu['email'], FILTER_VALIDATE_EMAIL)) fail('Невалиден имейл.');
            if (mb_strlen($cu['phone']) < 5) fail('Въведи телефон за куриера.');

            // Доставка
            $dl = isset($d['delivery']) && is_array($d['delivery']) ? $d['delivery'] : [];
            $courier = isset($dl['courier']) ? (string)$dl['courier'] : '';
            $type = isset($dl['type']) ? (string)$dl['type'] : '';
            if (!isset(COURIERS[$courier]) || !in_array($type, ['office', 'address'], true)) fail('Избери куриер и начин на доставка.');
            $D = ['courier' => $courier, 'type' => $type, 'office_id' => '', 'office_name' => '', 'office_addr' => '', 'city' => '', 'zip' => '', 'street' => '', 'street_no' => '', 'block' => '', 'apt' => '', 'note' => ''];
            if ($type === 'office') {
                $list = loadOffices($courier);
                if ($list !== null) {
                    $oid = (string)($dl['office'] ?? '');
                    $found = null;
                    foreach ($list as $o) if ($o['id'] === $oid) { $found = $o; break; }
                    if (!$found) fail('Избери офис от списъка.');
                    $D['office_id'] = $found['id']; $D['office_name'] = $found['n']; $D['office_addr'] = $found['a']; $D['city'] = $found['c']; $D['zip'] = $found['z'];
                } else {
                    $D['office_name'] = clean($dl['office_text'] ?? '', 160);
                    $D['city'] = clean($dl['city'] ?? '', 80);
                    $D['zip'] = clean($dl['zip'] ?? '', 12);
                    if (mb_strlen($D['city']) < 2) fail('Въведи град.');
                    if (mb_strlen($D['office_name']) < 3) fail('Напиши в кой офис да изпратим (име или адрес).');
                }
            } else {
                $D['city'] = clean($dl['city'] ?? '', 80); $D['street'] = clean($dl['street'] ?? '', 120); $D['street_no'] = clean($dl['street_no'] ?? '', 20);
                $D['block'] = clean($dl['block'] ?? '', 60); $D['apt'] = clean($dl['apt'] ?? '', 20); $D['zip'] = clean($dl['zip'] ?? '', 12); $D['note'] = clean($dl['office_text'] ?? '', 160);
                if (mb_strlen($D['city']) < 2) fail('Въведи град.');
                if (mb_strlen($D['street']) < 2) fail('Въведи улица или квартал.');
                if ($D['street_no'] === '') fail('Въведи номер на улицата.');
                if (mb_strlen($D['zip']) < 3) fail('Въведи пощенски код.');
            }

            $items = isset($d['items']) && is_array($d['items']) ? $d['items'] : [];
            if (count($items) < 1 || count($items) > 10) fail('Количката е празна или има твърде много артикули.');
            $rows = []; $total = 0;
            foreach ($items as $it) {
                $k = isset($it['type']) ? $it['type'] : '';
                if (!is_string($k) || !isset(KINDS[$k])) fail('Невалиден продукт.');
                $di = isset($it['design']) ? (int)$it['design'] : -1;
                $color = (string)($it['color'] ?? ''); $size = (string)($it['size'] ?? '');
                if (!isset(DESIGNS[$di]) || !in_array($color, KINDS[$k]['colors'], true) || !in_array($size, KINDS[$k]['sizes'], true)) fail('Невалидни опции на продукт.');
                $text = clean($it['text'] ?? '', 40);
                $halo = ''; $haloWho = '';
                if ($di === 2) { // „починал близък“: ореол / крила / и двете + за кого
                    $hv = ['halo' => 'Ореол', 'wings' => 'Крила', 'both' => 'Ореол и крила'];
                    $hk = (string)($it['halo'] ?? '');
                    if (!isset($hv[$hk])) fail('Избери ореол, крила или и двете.');
                    $halo = $hv[$hk];
                    $haloWho = clean($it['halo_who'] ?? '', 20);
                    if (mb_strlen($haloWho) < 1) fail('Напиши кой да получи ореола/крилата.');
                }
                $tok = (string)($it['photo'] ?? '');
                if (!preg_match('/^[a-f0-9]{32}$/', $tok)) fail('Липсва снимка за бродерията.');
                $q = db()->prepare("SELECT file FROM uploads WHERE token=? AND used=0"); $q->execute([$tok]);
                $up = $q->fetch();
                if (!$up) fail('Снимката е изтекла. Махни артикула и го добави отново.');
                $unit = PRICES[$k] + ($text !== '' ? TEXT_ADD : 0);
                $total += $unit;
                $rows[] = ['kind' => KINDS[$k]['name'], 'design' => DESIGNS[$di], 'color' => $color, 'size' => $size, 'text' => $text, 'story' => clean($it['story'] ?? '', 300), 'notes' => clean($it['notes'] ?? '', 600), 'halo' => $halo, 'halo_who' => $haloWho, 'unit' => $unit, 'token' => $tok, 'file' => $up['file']];
            }
            $ship = $type === 'office' ? (int)SHIPPING_OFFICE_CENTS : (int)SHIPPING_ADDRESS_CENTS; $total += $ship;
            $u = userRow();
            $pid = 'D' . strtoupper(bin2hex(random_bytes(3)));
            $addr = $type === 'office' ? $D['office_addr'] : trim($D['street'] . ' ' . $D['street_no'] . ($D['block'] ? ', ' . $D['block'] : '') . ($D['apt'] ? ', ап. ' . $D['apt'] : ''));
            $db = db();
            $db->beginTransaction();
            $db->prepare("INSERT INTO orders(public_id,user_id,guest,name,email,phone,address,city,zip,courier,delivery_type,office_id,office_name,office_addr,street,street_no,block,apt,office_note,total_cents,shipping_cents,status,created_at)
                          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)")
               ->execute([$pid, $u ? $u['id'] : null, $u ? 0 : 1, $cu['name'], $cu['email'], $cu['phone'], $addr, $D['city'], $D['zip'], $courier, $type, $D['office_id'], $D['office_name'], $D['office_addr'],
                          $D['street'], $D['street_no'], $D['block'], $D['apt'], $D['note'], $total, $ship, time()]);
            $oid = (int)$db->lastInsertId();
            foreach ($rows as $r) {
                $db->prepare("INSERT INTO order_items(order_id,kind,design,color,size,text_under,story,notes,unit_cents,photo_file,halo,halo_who) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
                   ->execute([$oid, $r['kind'], $r['design'], $r['color'], $r['size'], $r['text'], $r['story'], $r['notes'], $r['unit'], $r['file'], $r['halo'], $r['halo_who']]);
                $db->prepare("UPDATE uploads SET used=1 WHERE token=?")->execute([$r['token']]);
            }
            $db->commit();

            $lines = [];
            foreach ($rows as $r) {
                $lines[] = ['quantity' => 1, 'price_data' => ['currency' => 'eur', 'unit_amount' => $r['unit'],
                    'product_data' => ['name' => $r['kind'] . ' – ' . $r['design'], 'description' => $r['color'] . ', размер ' . $r['size'] . ($r['text'] !== '' ? ', текст: ' . $r['text'] : '')]]];
            }
            if ($ship > 0) $lines[] = ['quantity' => 1, 'price_data' => ['currency' => 'eur', 'unit_amount' => $ship, 'product_data' => ['name' => 'Доставка – ' . COURIERS[$courier] . ($type === 'office' ? ' до офис' : ' до адрес')]]];
            try {
                $s = stripe('checkout/sessions', ['mode' => 'payment', 'payment_method_types' => ['card'], 'locale' => 'bg', 'customer_email' => $cu['email'],
                    'client_reference_id' => $pid, 'metadata' => ['order' => $pid], 'line_items' => $lines,
                    'success_url' => siteUrl() . '/?paid=' . $pid . '&session_id={CHECKOUT_SESSION_ID}', 'cancel_url' => siteUrl() . '/?canceled=1']);
            } catch (Exception $e) {
                error_log('Stripe: ' . $e->getMessage());
                $db->prepare("UPDATE orders SET status='error' WHERE id=?")->execute([$oid]);
                fail('Плащането не може да започне в момента. Опитай отново след малко.', 502);
            }
            $db->prepare("UPDATE orders SET stripe_session_id=? WHERE id=?")->execute([$s['id'], $oid]);
            out(['url' => $s['url']]);
        }

        case 'confirm': {
            $pid = (string)($_GET['order'] ?? ''); $sid = (string)($_GET['session_id'] ?? '');
            $q = db()->prepare("SELECT * FROM orders WHERE public_id=?"); $q->execute([$pid]);
            $o = $q->fetch();
            if (!$o || $o['stripe_session_id'] !== $sid) fail('Поръчката не е намерена.', 404);
            $s = stripe('checkout/sessions/' . rawurlencode($sid));
            if (isset($s['payment_status']) && $s['payment_status'] === 'paid' && ($s['client_reference_id'] ?? '') === $pid) {
                markPaid($pid, (string)($s['payment_intent'] ?? ''));
                out(['paid' => true, 'order' => $pid]);
            }
            out(['paid' => false]);
        }

        case 'webhook': {
            if (STRIPE_WEBHOOK_SECRET === '') fail('Не е настроен.', 404);
            $raw = (string)file_get_contents('php://input');
            $sig = isset($_SERVER['HTTP_STRIPE_SIGNATURE']) ? $_SERVER['HTTP_STRIPE_SIGNATURE'] : '';
            $t = ''; $v1 = [];
            foreach (explode(',', $sig) as $part) { $kv = explode('=', $part, 2); if (count($kv) === 2) { if ($kv[0] === 't') $t = $kv[1]; if ($kv[0] === 'v1') $v1[] = $kv[1]; } }
            $calc = hash_hmac('sha256', $t . '.' . $raw, STRIPE_WEBHOOK_SECRET);
            $ok = false; foreach ($v1 as $x) if (hash_equals($calc, $x)) $ok = true;
            if (!$ok || abs(time() - (int)$t) > 600) fail('Невалиден подпис.', 400);
            $ev = json_decode($raw, true);
            if (isset($ev['type']) && in_array($ev['type'], ['checkout.session.completed', 'checkout.session.async_payment_succeeded'], true)) {
                $s = $ev['data']['object'];
                if (($s['payment_status'] ?? '') === 'paid' && !empty($s['client_reference_id'])) markPaid($s['client_reference_id'], (string)($s['payment_intent'] ?? ''));
            }
            out(['received' => true]);
        }

        default:
            fail('Непозната заявка.', 404);
    }
} catch (Exception $e) {
    error_log('Dushichki API: ' . $e->getMessage());
    fail('Възникна грешка на сървъра. Опитай отново.', 500);
}
