import { createBrowserClient } from '@supabase/ssr';

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

// Saves an order + its items. The id is generated here, so no SELECT permission is needed.
export async function submitOrder({ customer, delivery, courier, items }) {
  const sb = getSupabase();
  const id = crypto.randomUUID();
  const total = items.reduce((s, i) => s + i.unit, 0);
  const { error } = await sb.from('orders').insert({
    id, customer_name: customer.name, customer_email: customer.email, customer_phone: customer.phone,
    courier, delivery_type: delivery.type, delivery, total_cents: total,
  });
  if (error) throw new Error('Поръчката не можа да се запише: ' + error.message);
  const { error: e2 } = await sb.from('order_items').insert(items.map((i) => ({
    order_id: id, kind: i.type, design: i.design, color: i.color, size: i.size,
    embroidery_text: i.text || '', story: i.story || '', notes: i.notes || '', halo: i.halo || '', halo_who: i.halo_who || '',
    photo_path: i.photo || null, unit_cents: i.unit,
  })));
  if (e2) throw new Error('Артикулите не можаха да се запишат: ' + e2.message);
  return id;
}
