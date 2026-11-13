import { createBrowserClient } from '@supabase/ssr';
import { COURIER, DESIGNS, KIND, SHIP } from './data';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseEnabled = !!(url && key);

let client;
// Browser client (publishable key only; no auth – every visitor acts as the `anon` role).
export function getSupabase() {
  if (!supabaseEnabled) return null;
  if (!client) client = createBrowserClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

// Uploads a customer photo to the private `photos` bucket, returns its storage path.
export async function uploadPhoto(file) {
  const sb = getSupabase();
  const ext = ({ 'image/png': 'png', 'image/webp': 'webp' })[file.type] || 'jpg';
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('photos').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error('Снимката не можа да се качи: ' + error.message);
  return path;
}

// Saves the whole order (customer, delivery, every item with its photo link) as ONE row in `orders`.
// The id is generated here, so no SELECT permission is needed.
export async function submitOrder({ customer, delivery, courier, items }) {
  const sb = getSupabase();
  const id = crypto.randomUUID();
  const shipping = delivery.type === 'office' ? SHIP.office : SHIP.address;
  const total = items.reduce((s, i) => s + i.unit, 0) + shipping;
  const photoUrl = (p) => (p ? sb.storage.from('photos').getPublicUrl(p).data.publicUrl : null);
  const rows = items.map((i) => ({
    Дреха: KIND[i.type].one, Модел: DESIGNS[i.design].n, Цвят: i.color, Размер: i.size,
    Текст: i.text || '', История: i.story || '', Бележки: i.notes || '', Ореол: i.halo || '', За_кого: i.halo_who || '',
    Цена_евро: i.unit / 100, Снимка: photoUrl(i.photo),
  }));
  const join = (r, k) => r.map((x) => x[k]).filter(Boolean).join(' | ');
  const address = [delivery.city, delivery.office_text, [delivery.street, delivery.street_no].filter(Boolean).join(' '),
    delivery.block && 'бл. ' + delivery.block, delivery.apt && 'ап. ' + delivery.apt, delivery.zip].filter(Boolean).join(', ');
  const { error } = await sb.from('orders').insert({
    id, Име: customer.first, Фамилия: customer.last, Имейл: customer.email, Телефон: customer.phone,
    Куриер: COURIER[courier], Доставка: delivery.type === 'office' ? 'До офис' : 'До адрес', delivery: { ...delivery, shipping_cents: shipping }, Адрес: address, items: rows,
    Снимка: rows.find((r) => r.Снимка)?.Снимка || null, Сума_евроцента: total,
    Дреха: join(rows, 'Дреха'), Модел: join(rows, 'Модел'), Цвят: join(rows, 'Цвят'), Размер: join(rows, 'Размер'),
    Текст: join(rows, 'Текст'), История: join(rows, 'История'), Бележки: join(rows, 'Бележки'),
    Ореол: rows.map((r) => [r.Ореол, r.За_кого].filter(Boolean).join(' за ')).filter(Boolean).join(' | '),
  });
  if (error) throw new Error('Поръчката не можа да се запише: ' + error.message);
  // Потвърдително писмо от info@dushichki.com – ако не успее, поръчката пак е записана.
  try { await sb.functions.invoke('order-email', { body: { order_id: id } }); } catch (e) { /* ignore */ }
  return id;
}

const toUser = (u) => (u ? { id: u.id, email: u.email, name: (u.user_metadata && u.user_metadata.name) || (u.email || '').split('@')[0] } : null);

export async function currentUser() {
  const { data } = await getSupabase().auth.getSession();
  return toUser(data.session && data.session.user);
}

export function onUserChange(cb) {
  const { data } = getSupabase().auth.onAuthStateChange((_e, s) => cb(toUser(s && s.user)));
  return () => data.subscription.unsubscribe();
}

// Returns { user } when logged in, or { needsConfirm: true } when the project requires e-mail confirmation.
export async function signUp(name, email, password) {
  const { data, error } = await getSupabase().auth.signUp({ email, password, options: { data: { name } } });
  if (error) throw new Error(error.message);
  if (!data.session) return { needsConfirm: true };
  return { user: toUser(data.user) };
}

export async function signIn(email, password) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Грешен имейл или парола.' : error.message);
  return { user: toUser(data.user) };
}

export async function signOut() { await getSupabase().auth.signOut(); }

export async function myOrders() {
  const { data, error } = await getSupabase().from('orders')
    .select('id, Дата, Статус, Сума_евроцента').order('Дата', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

// Списък с офиси на Спиди / Еконт през Edge Function `offices`. При проблем -> ръчно въвеждане.
export async function loadOffices(courier) {
  try {
    const { data, error } = await getSupabase().functions.invoke('offices', { body: { courier } });
    if (error || !data || !Array.isArray(data.offices)) return { manual: true, offices: [] };
    return data;
  } catch (e) { return { manual: true, offices: [] }; }
}
