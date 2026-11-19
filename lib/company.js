// ДАННИ НА ТЪРГОВЕЦА – попълни ги след регистрацията на фирмата.
// Попълнените полета се показват автоматично в Общите условия, Политиката за поверителност и "Контакти".
export const COMPANY = {
  brand: 'Душички',
  name: '',      // напр. „Име ЕООД“ или „ЕТ Име“
  eik: '',       // ЕИК / БУЛСТАТ
  vatNumber: '', // ДДС номер (напр. BG123456789), ако си регистриран по ЗДДС; иначе остави празно
  address: '',   // седалище и адрес на управление
  phone: '',     // телефон за връзка
  email: 'info@dushichki.com',
};

const lines = () => {
  const c = COMPANY;
  const out = [];
  out.push(`<b>${c.name || '„' + c.brand + '“'}</b>${c.name ? ` (търговска марка „${c.brand}“)` : ''}`);
  if (c.eik) out.push(`<b>ЕИК:</b> ${c.eik}`);
  if (c.vatNumber) out.push(`<b>ДДС номер:</b> ${c.vatNumber}`);
  if (c.address) out.push(`<b>Адрес:</b> ${c.address}`);
  if (c.phone) out.push(`<b>Телефон:</b> ${c.phone}`);
  out.push(`<b>Имейл:</b> <a href="mailto:${c.email}">${c.email}</a>`);
  return out;
};

export const traderBlock = () => lines().join('<br>');
export const traderInline = () =>
  [COMPANY.name || COMPANY.brand, COMPANY.eik && `ЕИК ${COMPANY.eik}`, COMPANY.address].filter(Boolean).join(', ');
export const EMAIL = COMPANY.email;
