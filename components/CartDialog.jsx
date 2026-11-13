'use client';
import { supabaseEnabled, signUp, signIn, signOut, myOrders } from '../lib/supabase';
import { useEffect, useState } from 'react';
import Dialog from './Dialog';
import Checkout from './Checkout';
import { HALO, Heart } from './Icons';
import { DESIGNS, KIND, eur } from '../lib/data';
import { api } from '../lib/api';

// Всички стъпки на количката в един прозорец: количка → (гост/вход) → поръчка → плащане
export default function CartDialog({ open, onClose, view, setView, cart, removeItem, user, setUser, guestOK, setGuestOK, apiOk, cfg, openLegal, toast, goShop, clearCart }) {
  const subtotal = cart.reduce((a, i) => a + i.unit, 0);
  const startCheckout = () => (user || guestOK ? setView({ name: 'checkout' }) : setView({ name: 'gate' }));

  return (
    <Dialog open={open} onClose={onClose} className="md" label="Количка">
      <div className="in" id="cdb">
        {view.name === 'cart' && <CartView cart={cart} subtotal={subtotal} removeItem={removeItem} startCheckout={startCheckout} goShop={goShop} />}
        {view.name === 'gate' && <Gate setView={setView} setGuestOK={setGuestOK} />}
        {view.name === 'checkout' && (
          <Checkout cart={cart} subtotal={subtotal} user={user} apiOk={apiOk} cfg={cfg} openLegal={openLegal} onBack={() => setView({ name: 'cart' })}
            onSaved={(order) => { clearCart(); setView({ name: 'thanks', order, saved: true }); }} />
        )}
        {view.name === 'login' && (
          <Auth mode={view.mode} toCheckout={view.toCheckout} apiOk={apiOk} setView={setView}
            onDone={(u) => { setUser(u); toast('Здравей, ' + u.name.split(' ')[0] + ' ❤️'); setView(view.toCheckout ? { name: 'checkout' } : { name: 'account' }); }} />
        )}
        {view.name === 'account' && user && (
          <Account user={user} onLogout={async () => { try { if (supabaseEnabled) await signOut(); else await api('logout', {}); } catch (e) {} setUser(null); setGuestOK(false); onClose(); toast('Излезе от акаунта.'); }} />
        )}
        {view.name === 'confirming' && <div className="ok"><p>Потвърждаваме плащането...</p></div>}
        {view.name === 'thanks' && (
          <div className="ok">
            <Heart />
            <h2>Благодарим ти!</h2>
            {view.saved
              ? <p>Поръчка <b>{String(view.order).slice(0, 8).toUpperCase()}</b> е приета. Ще се свържем с теб за плащането и потвърждение.</p>
              : <p>Поръчка <b>{view.order}</b> е приета и платена. Ще получиш имейл с потвърждение.</p>}
            <p style={{ marginTop: 8 }}>Изработката отнема до 7 календарни дни, след което пратката тръгва с куриер.</p>
            <p style={{ marginTop: 18 }}>
              <button className="btn add" style={{ fontSize: '1.1rem', width: 'auto', padding: '12px 28px' }} onClick={onClose}>Обратно към сайта</button>
            </p>
          </div>
        )}
        {view.name === 'msg' && <div className="ok"><p>{view.text}</p></div>}
      </div>
    </Dialog>
  );
}

function CartView({ cart, subtotal, removeItem, startCheckout, goShop }) {
  if (!cart.length) {
    return (
      <>
        <h2>Количка</h2>
        <p>Количката е празна. Избери худи или тениска.</p>
        <p style={{ marginTop: 16 }}>
          <button className="btn add" style={{ fontSize: '1.1rem' }} onClick={goShop}>Към продуктите</button>
        </p>
      </>
    );
  }
  return (
    <>
      <h2>Количка</h2>
      {cart.map((i, x) => (
        <div className="ci" key={i.id}>
          <img src={i.thumb || ''} alt="" />
          <div className="t">
            <b>{KIND[i.type].one} – {DESIGNS[i.design].n}</b>
            {i.color} · размер {i.size}
            {i.halo ? <><br />{HALO.find((h) => h.k === i.halo).n} – за: {i.halo_who}</> : null}
            {i.text ? <><br />Текст: {i.text}</> : null}
            {i.notes ? <><br />Бележки: {i.notes}</> : null}
          </div>
          <div><b>{eur(i.unit)}</b><br /><button onClick={() => removeItem(x)}>Махни</button></div>
        </div>
      ))}
      <div className="sum" style={{ marginTop: 16 }}><span>Артикули</span><span>{eur(subtotal)}</span></div>
      <div className="sum" style={{ color: '#666', fontSize: '.9rem' }}><span>Доставка: €2.69 до офис · €5.28 до адрес (избира се на следващата стъпка)</span></div>
      <button className="btn add" style={{ fontSize: '1.1rem' }} onClick={startCheckout}>Към плащане</button>
    </>
  );
}

function Gate({ setView, setGuestOK }) {
  return (
    <>
      <h2>Как искаш да продължиш?</h2>
      <div className="gate">
        <button className="btn add" style={{ fontSize: '1.1rem', margin: 0 }} id="g1" onClick={() => { setGuestOK(true); setView({ name: 'checkout' }); }}>Поръчай като гост</button>
        <p style={{ margin: '-4px 0 6px', textAlign: 'center' }}>Без регистрация – нужни са ни само данни за доставка.</p>
        <button className="btn o add" style={{ fontSize: '1.1rem', margin: 0 }} id="g2" onClick={() => setView({ name: 'login', mode: 'login', toCheckout: true })}>Вход</button>
        <button className="btn o add" style={{ fontSize: '1.1rem', margin: 0 }} id="g3" onClick={() => setView({ name: 'login', mode: 'register', toCheckout: true })}>Създай акаунт</button>
      </div>
      <p style={{ marginTop: 16 }}><button type="button" className="link" onClick={() => setView({ name: 'cart' })}>← Обратно към количката</button></p>
    </>
  );
}

function Auth({ mode, toCheckout, apiOk, setView, onDone }) {
  const reg = mode === 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const sw = (m) => setView({ name: 'login', mode: m, toCheckout });

  async function submit(e) {
    e.preventDefault();
    if (!apiOk && !supabaseEnabled) return setErr('Акаунтите работят на качения сайт със сървъра (api.php). В този преглед не са свързани.');
    const em = email.trim();
    if (reg && name.trim().length < 2) return setErr('Въведи име.');
    if (!/^\S+@\S+\.\S+$/.test(em)) return setErr('Невалиден имейл.');
    if (pw.length < (reg ? 8 : 1)) return setErr(reg ? 'Паролата трябва да е поне 8 символа.' : 'Въведи парола.');
    setBusy(true);
    try {
      if (supabaseEnabled) {
        const r = reg ? await signUp(name.trim(), em, pw) : await signIn(em, pw);
        if (r.needsConfirm) { setErr(''); setView({ name: 'msg', text: 'Изпратихме ти имейл за потвърждение на регистрацията. Отвори линка в него и после влез.' }); return; }
        onDone(r.user);
      } else {
        const r = await api(reg ? 'register' : 'login', { name: reg ? name.trim() : undefined, email: em, password: pw });
        onDone(r.user);
      }
    } catch (er) { setErr(er.message); setBusy(false); }
  }

  return (
    <>
      <h2>{reg ? 'Регистрация' : 'Вход'}</h2>
      <div className="tab2" role="tablist">
        <button type="button" role="tab" aria-selected={!reg} data-m="login" onClick={() => sw('login')}>Вход</button>
        <button type="button" role="tab" aria-selected={reg} data-m="register" onClick={() => sw('register')}>Регистрация</button>
      </div>
      <form id="af" noValidate onSubmit={submit}>
        {reg && <div className="fld"><label htmlFor="a1">Име</label><input id="a1" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>}
        <div className="fld"><label htmlFor="a2">Имейл</label><input id="a2" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="fld"><label htmlFor="a3">Парола{reg ? ' (поне 8 символа)' : ''}</label><input id="a3" type="password" autoComplete={reg ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div className="er" id="aer" role="alert">{err}</div>
        <button className="btn add" id="ab" style={{ fontSize: '1.1rem' }} type="submit" disabled={busy}>{reg ? 'Създай акаунт' : 'Вход'}</button>
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: '.95rem' }}>
          {reg ? 'Вече имаш акаунт?' : 'Нямаш акаунт?'}{' '}
          <button type="button" className="link" data-m={reg ? 'login' : 'register'} onClick={() => sw(reg ? 'login' : 'register')}>{reg ? 'Влез' : 'Регистрирай се'}</button>
        </p>
        {toCheckout && <p style={{ textAlign: 'center', marginTop: 6 }}><button type="button" className="link" id="bk" onClick={() => setView({ name: 'gate' })}>← Продължи като гост</button></p>}
      </form>
    </>
  );
}

function Account({ user, onLogout }) {
  const [orders, setOrders] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (supabaseEnabled) {
      myOrders().then((o) => setOrders(o.map((x) => ({ public_id: x.id.slice(0, 8).toUpperCase(), created_at: Date.parse(x.Дата) / 1000, status: x.Статус, total_cents: x.Сума_евроцента })))).catch(() => setFailed(true));
    } else api('orders').then((r) => setOrders(r.orders)).catch(() => setFailed(true));
  }, []);
  const S = { 'Нова': 'приета', 'Платена': 'платена', 'Изпратена': 'изпратена', 'Отказана': 'отказана' };
  return (
    <>
      <h2>Здравей, {user.name}</h2>
      <p>{user.email}</p>
      <h3 style={{ margin: '22px 0 8px', color: 'var(--red)' }}>Моите поръчки</h3>
      <div id="ol">
        {failed ? 'Не успяхме да заредим поръчките.' : orders === null ? 'Зареждане...' : orders.length
          ? orders.map((o) => (
            <div className="sum" key={o.public_id}>
              <span><b>{o.public_id}</b> · {new Date(o.created_at * 1000).toLocaleDateString('bg-BG')} · {S[o.status] || o.status}</span>
              <span>{eur(o.total_cents)}</span>
            </div>))
          : 'Още нямаш поръчки.'}
      </div>
      <p style={{ marginTop: 20 }}><button className="btn add" id="lo" style={{ fontSize: '1.1rem' }} onClick={onLogout}>Изход</button></p>
    </>
  );
}
