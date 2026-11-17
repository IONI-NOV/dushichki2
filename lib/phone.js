// Проверка на телефон за куриера. Връща '' ако е наред, иначе текст на български.
// Приема български номера (0888 123 456, +359 888 123 456, 00359…, 02 123 4567) и чуждестранни с + отпред.
const EXAMPLE = 'Пример: 0888 123 456 или +359 888 123 456.';

// Български номер без водещата 0 / 359: мобилен (87/88/89/98/99 + 7 цифри) или стационарен (8–9 цифри, започва с 2–9).
function okBG(n) {
  if (/^(8[789]|9[89])\d{7}$/.test(n)) return true;
  if (/^[2-9]\d{7,8}$/.test(n) && !/^[89]/.test(n)) return true;
  return false;
}

export function checkPhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Въведи телефон за куриера.';
  if (!/^\+?[\d\s\-().\/]+$/.test(s)) return 'Невалиден телефон – само цифри, интервали и + в началото. ' + EXAMPLE;
  const d = s.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(d.replace(/^(00)?359|^0/, '')) || /0123456789|1234567890|9876543210/.test(d)) return 'Невалиден телефон. ' + EXAMPLE;

  let intl = s.startsWith('+') ? d : d.startsWith('00') ? d.slice(2) : null;
  if (intl !== null) {
    if (intl.startsWith('359')) return okBG(intl.slice(3)) ? '' : 'Невалиден български номер. ' + EXAMPLE;
    return intl.length >= 8 && intl.length <= 15 && !intl.startsWith('0') ? '' : 'Невалиден телефон. ' + EXAMPLE;
  }
  if (d.startsWith('0')) return okBG(d.slice(1)) ? '' : 'Невалиден телефон. ' + EXAMPLE;
  return 'Въведи номера с 0 отпред или с +359. ' + EXAMPLE;
}
