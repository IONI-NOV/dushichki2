'use client';
import { useEffect, useState } from 'react';
import { getSupabase, supabaseEnabled, signIn, signOut, currentUser } from '../../lib/supabase';

const STATUS = { new: 'Нова', paid: 'Платена', shipped: 'Изпратена', canceled: 'Отказана' };
const box = { background: '#fff', border: '2px solid #DC0A1E', borderRadius: 14, padding: 16, marginBottom: 18 };
const btn = { background: '#DC0A1E', color: '#FFF9E8', border: 0, borderRadius: 999, padding: '10px 22px', fontWeight: 800, cursor: 'pointer' };

export default function Orders() {
  const [user, setUser] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  useEffect(() => { if (supabaseEnabled) currentUser().then(setUser); else setUser(null); }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const sb = getSupabase();
      const a = await sb.from('admins').select('user_id').maybeSingle();
      if (!a.data) { setIsAdmin(false); return; }
      setIsAdmin(true);
      load();
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data, error } = await getSupabase().from('orders').select('*').order('created_at', { ascending: false });
    if (error) setErr(error.message); else setOrders(data);
  }
  async function login(e) {
    e.preventDefault(); setErr('');
    try { setUser((await signIn(email.trim(), pw)).user); } catch (x) { setErr(x.message); }
  }
  async function setStatus(id, status) {
    const { error } = await getSupabase().from('orders').update({ status }).eq('id', id);
    if (error) setErr(error.message); else setOrders((o) => o.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  const wrap = { maxWidth: 960, margin: '0 auto', padding: '32px 16px', color: '#2b2323' };
  if (user === undefined) return <div style={wrap}>Зареждане...</div>;
  if (!user) return (
    <form style={{ ...wrap, maxWidth: 380 }} onSubmit={login}>
      <h1 style={{ color: '#DC0A1E' }}>Поръчки</h1>
      <p style={{ margin: '8px 0' }}><input type="email" placeholder="Имейл" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: 10 }} /></p>
      <p style={{ margin: '8px 0' }}><input type="password" placeholder="Парола" value={pw} onChange={(e) => setPw(e.target.value)} style={{ width: '100%', padding: 10 }} /></p>
      <p style={{ color: '#DC0A1E' }}>{err}</p>
      <button style={btn} type="submit">Вход</button>
    </form>
  );
  if (!isAdmin) return (
    <div style={wrap}>
      <h1 style={{ color: '#DC0A1E' }}>Нямаш достъп</h1>
      <p style={{ margin: '12px 0' }}>Профилът {user.email} не е админ.</p>
      <button style={btn} onClick={async () => { await signOut(); setUser(null); }}>Изход</button>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ color: '#DC0A1E' }}>Поръчки {orders ? `(${orders.length})` : ''}</h1>
        <button style={btn} onClick={async () => { await signOut(); setUser(null); setIsAdmin(false); }}>Изход</button>
      </div>
      {err && <p style={{ color: '#DC0A1E' }}>{err}</p>}
      {orders === null ? 'Зареждане...' : orders.length === 0 ? 'Още няма поръчки.' : orders.map((o) => (
        <div key={o.id} style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <b>{String(o.id).slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleString('bg-BG')}</b>
            <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <p style={{ margin: '8px 0' }}><b>{o.customer_name}</b> · {o.customer_phone} · {o.customer_email}</p>
          <p style={{ margin: '8px 0' }}><b>{o.courier === 'speedy' ? 'Спиди' : 'Еконт'}</b> ({o.delivery_type === 'office' ? 'до офис' : 'до адрес'}): {o.delivery_address}</p>
          {(o.items || []).map((it, n) => (
            <div key={n} style={{ display: 'flex', gap: 14, borderTop: '1px solid #eadfc8', paddingTop: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {it.photo_url
                ? <a href={it.photo_url} target="_blank" rel="noreferrer" download><img src={it.photo_url} alt="Снимка" style={{ width: 180, maxHeight: 220, objectFit: 'contain', borderRadius: 8, background: '#f3ead6' }} /></a>
                : <div style={{ width: 180 }}>Без снимка</div>}
              <div style={{ flex: 1, minWidth: 220, lineHeight: 1.5 }}>
                <div><b>{it.product}</b> – {it.design}</div>
                <div>Цвят: {it.color} · Размер: {it.size} · €{it.price_eur}</div>
                {it.text && <div>Текст под дизайна: <b>{it.text}</b></div>}
                {it.halo && <div>Ореол/криле: {it.halo} за {it.halo_who}</div>}
                {it.story && <div>История: {it.story}</div>}
                {it.notes && <div>Бележки: {it.notes}</div>}
                {it.photo_url && <div><a href={it.photo_url} target="_blank" rel="noreferrer" style={{ color: '#DC0A1E' }}>Отвори / свали снимката</a></div>}
              </div>
            </div>
          ))}
          <p style={{ marginTop: 12, textAlign: 'right' }}><b>Общо: €{(o.total_cents / 100).toFixed(2)}</b></p>
        </div>
      ))}
    </div>
  );
}
