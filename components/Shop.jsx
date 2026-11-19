'use client';
import { supabaseEnabled, currentUser, onUserChange, onAuthEvent } from '../lib/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HeartSymbol } from './Icons';
import ProductDialog from './ProductDialog';
import CartDialog from './CartDialog';
import SizeDialog from './SizeDialog';
import LegalDialog from './LegalDialog';
import { DESIGNS, KIND, eur, img } from '../lib/data';
import { api } from '../lib/api';

export default function Shop() {
  const [kind, setKind] = useState('hoodie');
  const [cart, setCart] = useState([]);
  const [cartReady, setCartReady] = useState(false);
  const [apiOk, setApiOk] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [cfg, setCfg] = useState({ ship_office: 0, ship_address: 0 });
  const [user, setUser] = useState(null);
  const [guestOK, setGuestOK] = useState(false);

  const [product, setProduct] = useState(null);
  const [sizesFor, setSizesFor] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [view, setView] = useState({ name: 'cart' });
  const [legal, setLegal] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  const toast = useCallback((m) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2800);
  }, []);

  // количката се пази в браузъра на клиента
  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem('dsh_cart') || '[]')); } catch (e) {}
    setCartReady(true);
  }, []);
  useEffect(() => {
    if (!cartReady) return;
    try { localStorage.setItem('dsh_cart', JSON.stringify(cart)); } catch (e) {}
  }, [cart, cartReady]);

  // fade-up на артикулите, когато влязат в екрана
  useEffect(() => {
    const els = document.querySelectorAll('#grid .card');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('vis')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [kind]);

  // Supabase сесия (регистриран потребител)
  useEffect(() => {
    if (!supabaseEnabled) return;
    // Линк от имейл „Нова парола“ (#…type=recovery) или изтекъл линк (#error=…)
    const h = new URLSearchParams(location.hash.slice(1));
    const openNewPw = () => { setView({ name: 'newpw' }); setCartOpen(true); };
    const offEvt = onAuthEvent((e) => { if (e === 'PASSWORD_RECOVERY') openNewPw(); });
    if (h.get('type') === 'recovery') openNewPw();
    else if (h.get('error_code')) {
      setView({ name: 'msg', text: h.get('error_code') === 'otp_expired'
        ? 'Линкът от имейла е изтекъл или вече е използван. Поискай нов.'
        : 'Линкът от имейла не е валиден. Поискай нов.' });
      setCartOpen(true);
    }
    currentUser().then(setUser).catch(() => {});
    const offUser = onUserChange(setUser);
    if (h.get('type') || h.get('error_code')) setTimeout(() => history.replaceState(null, '', location.pathname + location.search), 1500);
    return () => { offEvt(); offUser(); };
  }, []);

  // връзка с PHP бекенда + връщане от Stripe
  useEffect(() => {
    if (supabaseEnabled) { afterPay(); return; }
    api('ping').then((j) => {
      setApiOk(true); setCfg(j); setUser(j.user || null);
      afterPay();
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function afterPay() {
    const p = new URLSearchParams(location.search);
    if (p.get('canceled')) {
      history.replaceState(null, '', location.pathname);
      toast('Плащането е отказано. Количката ти е запазена.');
      return;
    }
    if (p.get('paid') && p.get('session_id')) {
      const id = p.get('paid'), sid = p.get('session_id');
      history.replaceState(null, '', location.pathname);
      setView({ name: 'confirming' }); setCartOpen(true);
      try {
        const r = await api('confirm', null, '&order=' + encodeURIComponent(id) + '&session_id=' + encodeURIComponent(sid));
        if (r.paid) { setCart([]); setView({ name: 'thanks', order: r.order }); return; }
        setView({ name: 'msg', text: 'Плащането още не е потвърдено. Ако е минало, ще получиш имейл. При въпрос пиши на info@dushichki.com.' });
      } catch (e) {
        setView({ name: 'msg', text: 'Не успяхме да потвърдим плащането автоматично. Ако е минало, поръчката ти е записана. Пиши ни на info@dushichki.com.' });
      }
    }
  }

  const goShop = () => { setCartOpen(false); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const openCart = () => { setView({ name: 'cart' }); setCartOpen(true); };
  const openAccount = () => { setView(user ? { name: 'account' } : { name: 'login', mode: 'login', toCheckout: false }); setCartOpen(true); };

  const toAbout = () => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const V = '/img/v2/';

  return (
    <>
      <HeartSymbol />
      <div className="pg">
        <header className="hd">
          <div className="hp" aria-hidden="true" />
          <button className="about" onClick={toAbout}>За нас</button>
          <img className="logo" src="/img/logo.png" alt="Душички" />
          <div className="hr">
            <button className="login" id="acc" onClick={openAccount} aria-label={user ? 'Профил' : 'Вход'} title={user ? 'Профил' : 'Вход'}>
              <img src={V + 'ico-user.webp'} alt="" />
              {user && <span className="nm">{user.name.split(' ')[0]}</span>}
            </button>
            <button className={'cartb' + (pulse ? ' pulse' : '')} id="cartb" aria-label="Количка" onClick={openCart}>
              <img src={V + 'ico-cart.webp'} alt="" />
              {cart.length > 0 && <span className="bd" id="cnt">{cart.length}</span>}
            </button>
          </div>
        </header>

        <div className="cv">
          <img className="fx heart1" src={V + 'heart1.webp'} alt="" />
          <img className="fx d1" src={V + 'd1.webp'} alt="" />
          <img className="fx d2" src={V + 'd2.webp'} alt="" />
          <img className="fx d3" src={V + 'd3.webp'} alt="" />
          <img className="fx heart2" src={V + 'heart2.webp'} alt="" />
          <img className="fx scrap" src={V + 'scrap.webp'} alt="" />

          <main>
            <section className="hero">
              <h1>Подарък за твоята душичка, който топли сърцето с години.</h1>
              <p>Дай живот на спомените си.</p>
              <button className="btn" id="go" onClick={goShop}>И аз искам!</button>
              <img className="hi" src={V + 'hero.webp'} alt="Черна блуза с бродерия на танцуваща двойка, а до нея снимката, по която е направена" />
            </section>

            <section className="tabsec" id="shop">
              <div className="tabs" role="tablist">
                <button role="tab" id="t-tee" aria-selected={kind === 'tee'} onClick={() => setKind('tee')}>
                  {kind === 'tee' && <img className="th" src={V + 'hrt.webp'} alt="" />}Тениски
                </button>
                <button role="tab" id="t-hoodie" aria-selected={kind === 'hoodie'} onClick={() => setKind('hoodie')}>
                  {kind === 'hoodie' && <img className="th" src={V + 'hrt.webp'} alt="" />}Худита
                </button>
              </div>
            </section>

            <section className="grid" id="grid" aria-live="polite">
              {DESIGNS.map((d, i) => (
                <button className="card fu" style={{ '--i': i }} key={kind + d.k} onClick={() => setProduct(i)}>
                  <div className="im">
                    <img className="a" src={img(kind, 'b', i)} alt={d.n} loading="lazy" />
                    <img className="b" src={img(kind, 'w', i)} alt="" loading="lazy" />
                  </div>
                  <h3>{d.n}</h3>
                  <p className="pr">{eur(KIND[kind].price)}</p>
                </button>
              ))}
            </section>

            <section className="note" id="about" aria-label="Зад Душичките">
              <img className="nd" src={V + 'note.webp'} alt="Зад Душички? Казвам се Йоан и винаги съм искал да създам продукт, който да изпълва сърцата на хората. Нещо, което можеш да пазиш с години. Вярвам, че хората не помнят предмети, а моменти. Танца с любим човек. Развълнувания поглед на кученцето ти. Усмивката на близък, който вече не е до нас. Независимо по каква причина. Затова в Душички превръщаме тези мигове в изкуство, което можеш да носиш всеки ден. Защото споменът е най-хубав, когато е близо до сърцето." />
              <div className="nm2" aria-hidden="false">
                <img className="ttl" src={V + 'ttl.webp'} alt="Зад Душички?" />
                <img className="nl" src={V + 'nlogo.webp'} alt="" />
                <div className="tx">
                  <p>Казвам се Йоан и винаги съм искал да създам продукт, който да изпълва сърцата на хората. Нещо, което можеш да <u>пазиш с години.</u></p>
                  <p>Вярвам, че хората не помнят предмети, а <span className="ov">моменти.</span> Танца с любим човек. Развълнувания поглед на кученцето ти. Усмивката на близък, който вече не е до нас. Независимо по каква причина. ♡</p>
                  <p>Затова в Душички превръщаме тези мигове в изкуство, което можеш да носиш всеки ден. Защото споменът е най-хубав, когато е близо до сърцето. :)</p>
                </div>
                <img className="ph1" src={V + 'ph1.webp'} alt="" />
                <img className="ph2" src={V + 'ph2.webp'} alt="" />
              </div>
              <p className="cap">Бродирано с нашата любов за вашата любов…</p>
            </section>
          </main>
        </div>

        <footer>
          <button className="lk" onClick={() => setLegal('terms')}>Общи условия</button>
          <button className="lk" onClick={() => setLegal('priv')}>Политика за поверителност</button>
          <a className="lk" href="mailto:info@dushichki.com">info@dushichki.com</a>
        </footer>
      </div>

      <ProductDialog
        kind={kind} design={product} apiOk={apiOk}
        onClose={() => setProduct(null)}
        onSizes={setSizesFor}
        onAdd={(item) => {
          setCart((c) => [...c, item]); setProduct(null); toast('Добавено в количката ✓');
          // връщаме човека най-горе, където е количката, и я подчертаваме
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setPulse(true); setTimeout(() => setPulse(false), 1800);
        }}
      />
      <CartDialog
        open={cartOpen} onClose={() => setCartOpen(false)} view={view} setView={setView}
        cart={cart} removeItem={(x) => setCart((c) => c.filter((_, j) => j !== x))}
        user={user} setUser={setUser} guestOK={guestOK} setGuestOK={setGuestOK}
        apiOk={apiOk} cfg={cfg} openLegal={setLegal} toast={toast} goShop={goShop} clearCart={() => setCart([])}
      />
      <SizeDialog kind={sizesFor} onClose={() => setSizesFor(null)} />
      <LegalDialog id={legal} onClose={() => setLegal(null)} />
      <div id="toast" role="status" className={toastMsg ? 'on' : ''}>{toastMsg}</div>
    </>
  );
}
