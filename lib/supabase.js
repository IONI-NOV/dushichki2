import { createBrowserClient } from '@supabase/ssr';
import { DESIGNS, KIND } from './data';

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
  const total = items.reduce((s, i) => s + i.unit, 0);
  const photoUrl = (p) => (p ? sb.storage.from('photos').getPublicUrl(p).data.publicUrl : null);
  const rows = items.map((i) => ({
    product: KIND[i.type].one, design: DESIGNS[i.design].n, color: i.color, size: i.size,
    text: i.text || '', story: i.story || '', notes: i.notes || '', halo: i.halo || '', halo_who: i.halo_who || '',
    price_eur: i.unit / 100, photo_url: photoUrl(i.photo),
  }));
  const join = (r, k) => r.map((x) => x[k]).filter(Boolean).join(' | ');
  const address = [delivery.city, delivery.office_text, [delivery.street, delivery.street_no].filter(Boolean).join(' '),
    delivery.block && 'бл. ' + delivery.block, delivery.apt && 'ап. ' + delivery.apt, delivery.zip].filter(Boolean).join(', ');
  const { error } = await sb.from('orders').insert({
    id, customer_name: customer.name, customer_email: customer.email, customer_phone: customer.phone,
    courier, delivery_type: delivery.type, delivery, delivery_address: address, items: rows,
    photo_url: rows.find((r) => r.photo_url)?.photo_url || null, total_cents: total,
    product: join(rows, 'product'), design: join(rows, 'design'), color: join(rows, 'color'), size: join(rows, 'size'),
    text_under_design: join(rows, 'text'), story: join(rows, 'story'), notes: join(rows, 'notes'),
    halo: rows.map((r) => [r.halo, r.halo_who].filter(Boolean).join(' за ')).filter(Boolean).join(' | '),
  });
  if (error) throw new Error('Поръчката не можа да се запише: ' + error.message);
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
    .select('id, created_at, status, total_cents').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
