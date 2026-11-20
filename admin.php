<?php
// Страница за теб: всички поръчки, куриер и адрес, снимки за бродерия. Адрес: /admin.php  (потребител: admin)
require __DIR__ . '/config.php';

function adminAuth() {
    $u = isset($_SERVER['PHP_AUTH_USER']) ? $_SERVER['PHP_AUTH_USER'] : '';
    $p = isset($_SERVER['PHP_AUTH_PW']) ? $_SERVER['PHP_AUTH_PW'] : '';
    $h = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] : '');
    if ($u === '' && stripos($h, 'basic ') === 0) {
        $dec = explode(':', (string)base64_decode(substr($h, 6)), 2);
        $u = $dec[0]; $p = isset($dec[1]) ? $dec[1] : '';
    }
    if (ADMIN_PASSWORD === '' || ADMIN_PASSWORD === 'change-me') { http_response_code(503); exit('Задай ADMIN_PASSWORD в config.php.'); }
    if ($u !== 'admin' || !hash_equals(ADMIN_PASSWORD, $p)) {
        header('WWW-Authenticate: Basic realm="Dushichki admin", charset="UTF-8"');
        http_response_code(401);
        exit('Нужна е парола.');
    }
}
adminAuth();

foreach ([DATA_DIR, DATA_DIR . '/uploads'] as $d) if (!is_dir($d)) mkdir($d, 0750, true);
$db = new PDO('sqlite:' . DATA_DIR . '/dushichki.sqlite');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
function e($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function tok($id) { return hash_hmac('sha256', 'ship' . $id, ADMIN_PASSWORD); }

// Сваляне на снимка
if (isset($_GET['photo'])) {
    $q = $db->prepare("SELECT photo_file FROM order_items WHERE id=?");
    $q->execute([(int)$_GET['photo']]);
    $r = $q->fetch();
    $path = $r && $r['photo_file'] ? DATA_DIR . '/uploads/' . basename($r['photo_file']) : '';
    if (!$path || !is_file($path)) { http_response_code(404); exit('Снимката вече е изтрита или не съществува.'); }
    $mime = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'][pathinfo($path, PATHINFO_EXTENSION)];
    header('Content-Type: ' . $mime);
    header('Content-Disposition: attachment; filename="' . basename($path) . '"');
    readfile($path);
    exit;
}

// Маркиране като изпратена (стартира 3-дневния срок за изтриване на снимките)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ship'])) {
    $id = (int)$_POST['ship'];
    if (hash_equals(tok($id), (string)($_POST['t'] ?? ''))) $db->prepare("UPDATE orders SET status='shipped', shipped_at=? WHERE id=? AND status='paid'")->execute([time(), $id]);
    header('Location: admin.php'); exit;
}

// Изтриване на стари снимки
$old = $db->prepare("SELECT i.id,i.photo_file FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.shipped_at IS NOT NULL AND o.shipped_at<=? AND i.photo_file IS NOT NULL");
$old->execute([time() - 3 * 86400]);
foreach ($old->fetchAll() as $r) { @unlink(DATA_DIR . '/uploads/' . basename($r['photo_file'])); $db->prepare("UPDATE order_items SET photo_file=NULL WHERE id=?")->execute([$r['id']]); }

$orders = $db->query("SELECT * FROM orders WHERE status IN ('paid','shipped') ORDER BY id DESC LIMIT 200")->fetchAll();
$st = ['paid' => 'Платена – за изработка', 'shipped' => 'Изпратена'];
$cn = ['speedy' => 'Спиди', 'econt' => 'Еконт'];
?><!DOCTYPE html>
<html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Поръчки – Душички</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#FFF9E8;color:#2b2323;margin:0;padding:24px}h1{color:#DC0A1E}
.o{background:#fff;border:2px solid #DC0A1E;border-radius:14px;padding:16px;margin:0 0 16px;max-width:900px}.s{font-weight:700;color:#DC0A1E}
.i{border-top:1px solid #eee;padding:8px 0}.d{background:#FFF9E8;border-radius:10px;padding:8px 12px;margin:8px 0}a,button{color:#DC0A1E}button{border:2px solid #DC0A1E;background:#fff;border-radius:99px;padding:6px 16px;font-weight:700;cursor:pointer}</style></head><body>
<h1>Поръчки</h1>
<?php if (!$orders) echo '<p>Още няма платени поръчки.</p>'; ?>
<?php foreach ($orders as $o): ?>
<div class="o">
  <div><b><?= e($o['public_id']) ?></b> · <?= date('d.m.Y H:i', (int)$o['paid_at'] ?: (int)$o['created_at']) ?> · <span class="s"><?= e($st[$o['status']]) ?></span> · <b><?= number_format($o['total_cents'] / 100, 2) ?> €</b><?= !empty($o['guest']) ? ' · гост' : '' ?></div>
  <div><?= e($o['name']) ?> · <a href="mailto:<?= e($o['email']) ?>"><?= e($o['email']) ?></a> · <?= e($o['phone']) ?></div>
  <div class="d"><b><?= e(isset($cn[$o['courier']]) ? $cn[$o['courier']] : '') ?> – <?= $o['delivery_type'] === 'office' ? 'до офис' : 'до адрес' ?></b><br>
  <?php if ($o['delivery_type'] === 'office'): ?>
    Офис: <b><?= e($o['office_name']) ?></b><?= $o['office_addr'] ? ' · ' . e($o['office_addr']) : '' ?><?= $o['office_id'] ? ' · код ' . e($o['office_id']) : '' ?><br>Град: <?= e($o['city']) ?> <?= e($o['zip']) ?>
  <?php else: ?>
    <?= e($o['street']) ?> <?= e($o['street_no']) ?><?= $o['block'] ? ', ' . e($o['block']) : '' ?><?= $o['apt'] ? ', ап. ' . e($o['apt']) : '' ?><br><?= e($o['zip']) ?> <?= e($o['city']) ?><?= $o['office_note'] ? '<br>Офис при нужда: ' . e($o['office_note']) : '' ?>
  <?php endif; ?></div>
  <?php $q = $db->prepare("SELECT * FROM order_items WHERE order_id=?"); $q->execute([$o['id']]); foreach ($q->fetchAll() as $i): ?>
  <div class="i"><b><?= e($i['kind']) ?></b> – <?= e($i['design']) ?><br><?= e($i['color']) ?> · размер <b><?= e($i['size']) ?></b>
    <?php if (!empty($i['halo'])) echo '<br>' . e($i['halo']) . ' – за: <b>' . e($i['halo_who']) . '</b>'; ?>
    <?php if ($i['text_under']) echo '<br>Текст под дизайна: <b>' . e($i['text_under']) . '</b>'; ?>
    <?php if ($i['story']) echo '<br>История: ' . e($i['story']); ?>
    <?php if ($i['notes']) echo '<br>Бележки: ' . e($i['notes']); ?>
    <br><?= $i['photo_file'] ? '<a href="admin.php?photo=' . (int)$i['id'] . '">⬇ Свали снимката</a>' : '<i>снимката е изтрита</i>' ?></div>
  <?php endforeach; ?>
  <?php if ($o['status'] === 'paid'): ?>
  <form method="post" style="margin-top:10px"><input type="hidden" name="ship" value="<?= (int)$o['id'] ?>"><input type="hidden" name="t" value="<?= e(tok($o['id'])) ?>"><button>Маркирай като изпратена</button></form>
  <?php else: ?><div style="margin-top:8px;font-size:14px">Снимките се изтриват 3 дни след изпращането (<?= date('d.m.Y', (int)$o['shipped_at']) ?>).</div><?php endif; ?>
</div>
<?php endforeach; ?>
</body></html>
