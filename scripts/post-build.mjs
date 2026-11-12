// След `next build`: уверяваме се, че .htaccess и PHP файловете са в out/ (папката, която се качва в GoDaddy).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

mkdirSync('out', { recursive: true });
for (const f of ['.htaccess', 'api.php', 'admin.php', 'config.php']) {
  if (existsSync('public/' + f) && !existsSync('out/' + f)) copyFileSync('public/' + f, 'out/' + f);
}
console.log('Готово: качи съдържанието на папка out/ в public_html на GoDaddy.');
