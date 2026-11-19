'use client';
import { D1 } from '../lib/d1path';
import { supabaseEnabled, currentUser, onUserChange, onAuthEvent } from '../lib/supabase';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HeartSymbol } from './Icons';
import ProductDialog from './ProductDialog';
import CartDialog from './CartDialog';
import SizeDialog from './SizeDialog';
import LegalDialog from './LegalDialog';
import { DESIGNS, KIND, eur, img } from '../lib/data';
import { api } from '../lib/api';

function Type({ text, start = 0 }) {
  const [n, setN] = useState(text.length);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setN(0);
    let i = 0, iv;
    const t = setTimeout(() => { iv = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(iv); }, 22); }, start);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [text, start]);
  return (<><span>{text.slice(0, n)}</span><span style={{ visibility: 'hidden' }}>{text.slice(n)}</span></>);
}

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

  const [heartX, setHeartX] = useState(null);
  const noteRef = useRef(null);
  const tabsRef = useRef(null);
  useLayoutEffect(() => {
    const place = () => {
      const b = document.getElementById(kind === 'tee' ? 't-tee' : 't-hoodie');
      if (b) setHeartX(b.offsetLeft + b.offsetWidth / 2);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [kind]);

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

  // появяване на „Зад Душичките“ при скрол
  useEffect(() => {
    const el = noteRef.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('vis'); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { el.classList.add('vis'); io.disconnect(); } }), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

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

  const scrollToEl = (el, where) => {
    if (!el) return;
    const hd = document.querySelector('.hd');
    const hh = hd ? hd.getBoundingClientRect().height * 0.7 : 80;
    const r = el.getBoundingClientRect();
    const y = where === 'center' ? r.top + window.scrollY - Math.max(hh, (window.innerHeight - r.height) / 2) : r.top + window.scrollY - hh - 10;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  };
  const goShop = () => { setCartOpen(false); scrollToEl(document.querySelector('.tabs'), 'top'); };
  const openCart = () => { setView({ name: 'cart' }); setCartOpen(true); };
  const openAccount = () => { setView(user ? { name: 'account' } : { name: 'login', mode: 'login', toCheckout: false }); setCartOpen(true); };

  const toAbout = () => { const el = [...document.querySelectorAll('#about .nd, #about .nm2')].find((e) => e.offsetParent); scrollToEl(el || document.getElementById('about'), 'center'); };
  const V = '/img/v2/';

  return (
    <>
      <HeartSymbol />
      <div className="pg">
        <header className="hd">
          <div className="hp" aria-hidden="true" />
          <button className="about" onClick={toAbout}>За нас</button>
          <img className="logo" src={V + 'logo.png'} alt="Душички" />
          <div className="hr">
            <button className="login" id="acc" onClick={openAccount} aria-label={user ? 'Профил' : 'Вход'} title={user ? 'Профил' : 'Вход'}>
              <svg viewBox="4 4 16 16" aria-hidden="true"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
            </button>
            <button className={'cartb' + (pulse ? ' pulse' : '')} id="cartb" aria-label="Количка" onClick={openCart}>
              <svg viewBox="1 2 21.4 20.4" aria-hidden="true"><path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.4 5H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" /></svg>
              {cart.length > 0 && <span className="bd" id="cnt">{cart.length}</span>}
            </button>
          </div>
        </header>

        <div className="cv">
          <img className="fx heart1" src={V + 'heart1.webp'} alt="" />
          <img className="fx heart2" src={V + 'heart2.webp'} alt="" />
          <svg className="fx d1 d1w" viewBox="0 0 760 340" aria-hidden="true">
            <defs><mask id="d1m" maskUnits="userSpaceOnUse" x="0" y="0" width="760" height="340">
              <path className="ln" pathLength="1" fill="none" stroke="#fff" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" d="M-5 299C60 308 130 316 200 316C290 316 350 300 381 262C395 230 380 190 345 155C320 132 292 140 288 170C292 215 330 255 385 263C470 270 570 220 640 150C670 120 683 95 688 70C692 62 692 52 691 40C676 40 678 20 692 18C708 20 708 48 692 60"/>
            </mask></defs>
            <g mask="url(#d1m)"><path d={D1} fill="#FEF9E9" opacity=".52" /></g>
          </svg>
          <img className="fx d2" src={V + 'd2.svg'} alt="" />
          <img className="fx d3" src={V + 'd3.svg'} alt="" />
          <img className="fx scrap" src={V + 'scrap.svg'} alt="" />

          <main>
            <section className="hero">
              <h1><Type text="Подарък за твоята душичка, който топли сърцето с години." start={450} /></h1>
              <p><Type text="Дай живот на спомените си." start={1500} /></p>
              <button className="btn" id="go" onClick={goShop}>И аз искам!</button>
              <img className="hi" src={V + 'hero.webp'} alt="Черна блуза с бродерия на танцуваща двойка, а до нея снимката, по която е направена" />
            </section>

            <section className="tabsec" id="shop">
              <div className="tabs" role="tablist" ref={tabsRef}>
                <img className="th" src={V + 'hrt.svg'} alt="" style={heartX == null ? { left: '50%' } : { left: heartX }} />
                <button role="tab" id="t-tee" aria-selected={kind === 'tee'} onClick={() => setKind('tee')}>
                  <span className="tw"><span className="t1">Тениски</span><span className="t2" aria-hidden="true">Тениски</span></span>
                </button>
                <button role="tab" id="t-hoodie" aria-selected={kind === 'hoodie'} onClick={() => setKind('hoodie')}>
                  <span className="tw"><span className="t1">Худита</span><span className="t2" aria-hidden="true">Худита</span></span>
                </button>
                <button role="tab" id="t-top" disabled aria-disabled="true" title="Скоро">
                  <span className="tw"><span className="t1">Блузи</span></span>
                </button>
              </div>
            </section>

            <section className="grid" id="grid" aria-live="polite">
              {DESIGNS.map((d, i) => (
                <button className="card fu" style={{ '--i': i }} key={kind + d.k} onClick={() => setProduct(i)}>
                  <div className="cf">
                    <div className="im">
                      <img className="a" src={img(kind, 'b', i)} alt={d.n} loading="lazy" />
                      <img className="b" src={img(kind, 'w', i)} alt="" loading="lazy" />
                    </div>
                    <h3>{d.n}</h3>
                    <p className="pr">{eur(KIND[kind].price)}</p>
                  </div>
                </button>
              ))}
            </section>

            <section className="note rv" id="about" ref={noteRef} aria-label="Зад Душичките">
              <img className="nd" src={V + 'note.svg'} alt="Зад Душички? Казвам се Йоан и винаги съм искал да създам продукт, който да изпълва сърцата на хората. Нещо, което можеш да пазиш с години. Вярвам, че хората не помнят предмети, а моменти. Танца с любим човек. Развълнувания поглед на кученцето ти. Усмивката на близък, който вече не е до нас. Независимо по каква причина. Затова в Душички превръщаме тези мигове в изкуство, което можеш да носиш всеки ден. Защото споменът е най-хубав, когато е близо до сърцето." />
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
              <img className="dp dp1" src={V + 'ph1.webp'} alt="" />
              <img className="dp dp2" src={V + 'ph2.webp'} alt="" />
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
