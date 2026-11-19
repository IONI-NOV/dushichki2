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

function Type({ text, start = 0, onDone, run = true, hand = null }) {
  const [n, setN] = useState(0);
  const done = n >= text.length;
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(text.length); onDone && onDone(); return; }
    if (!run) return;
    setN(0);
    // „човешко“ писане: скоростта леко се мени, понякога има колебание, след запетая/точка – пауза
    let i = 0, t;
    const next = () => {
      i += 1; setN(i);
      if (i >= text.length) { onDone && onDone(); return; }
      const ch = text[i - 1], r = Math.random();
      let d = 13 + Math.random() * 20;
      if (r < 0.15) d = 8 + Math.random() * 6;            // кратко „изстрелване“ на 2-3 букви
      else if (r > 0.9) d += 35 + Math.random() * 55;      // малко колебание
      if (ch === ' ') d += 10 + Math.random() * 20;
      if (ch === ',' || ch === '.') d += 100 + Math.random() * 90;
      t = setTimeout(next, d);
    };
    t = setTimeout(next, start);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, start, run]);
  // бялата черта (курсор) върви с текста, а накрая остава и мига
  // part: [начало, край) – тази част от текста е с ръкописния шрифт (класа .hw)
  const seg = (a, b) => {
    if (!hand || b <= hand[0] || a >= hand[1]) return text.slice(a, b);
    const x = Math.max(a, hand[0]), y = Math.min(b, hand[1]);
    return <>{text.slice(a, x)}<span className="hw">{text.slice(x, y)}</span>{text.slice(y, b)}</>;
  };
  return (<><span>{seg(0, n)}</span><span className={'caret' + (done ? ' blink' : '')} aria-hidden="true" /><span style={{ visibility: 'hidden' }}>{seg(n, text.length)}</span></>);
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
  const [scrollOpen, setScrollOpen] = useState(false); // свитъкът „Зад Душички“ (телефон)
  const [typed, setTyped] = useState(false);
  // Заставка: кремав екран с логото и кръгче за зареждане -> вдига се и става листът на хедъра, логото отива на мястото си
  const [pre, setPre] = useState(false);
  const [intro, setIntro] = useState('splash'); // splash | lift | fade | done
  const splRef = useRef(null);
  const splLogoRef = useRef(null);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setIntro('done'); return; }
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    window.scrollTo(0, 0);
    const t0 = performance.now();
    const timers = [];
    let started = false;
    const lift = () => {
      const spl = splRef.current, lg = splLogoRef.current, hd = document.querySelector('.hd'), hl = document.querySelector('.hd .logo');
      if (!spl || !lg || !hd || !hl) { setIntro('done'); return; }
      // листът на хедъра е прав правоъгълник (на телефон – с отстъп отляво и отдясно)
      const r = hd.getBoundingClientRect();
      const d = (r.width / 2) * Math.tan(1.2 * Math.PI / 180); // листът е завъртян на -1.2° (като .hp)
      const pts = [[r.left, r.top], [r.right, r.top], [r.right, r.bottom - d], [r.left, r.bottom + d]];
      spl.style.clipPath = 'polygon(' + pts.map(([x, y]) => x.toFixed(1) + 'px ' + y.toFixed(1) + 'px').join(',') + ')';
      const a = lg.getBoundingClientRect(), b = hl.getBoundingClientRect();
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      lg.style.transform = `translate(${dx}px,${dy}px) scale(${b.width / a.width})`;
      setIntro('lift');
      timers.push(setTimeout(() => setIntro('fade'), 1050));
      timers.push(setTimeout(() => setIntro('done'), 1450));
    };
    const start = () => {
      if (started) return; started = true;
      const wait = Math.max(0, 1200 - (performance.now() - t0)); // поне за миг да се види заставката
      timers.push(setTimeout(() => setPre(true), Math.max(0, wait - 350)));
      timers.push(setTimeout(() => requestAnimationFrame(lift), wait));
    };
    if (document.readyState === 'complete') start();
    else { window.addEventListener('load', start, { once: true }); timers.push(setTimeout(start, 3500)); }
    return () => { timers.forEach(clearTimeout); window.removeEventListener('load', start); };
  }, []);
  const introGo = pre || intro === 'fade' || intro === 'done';
// заглавието е изписано -> показваме подзаглавието и бутона

  // При издърпване на страницата (overscroll) отгоре да се вижда кремавият лист, а отдолу – тъмният цвят на футъра.
  // iOS оцветява тази зона с фона на <html>, затова го сменяме според това в коя половина на страницата сме.
  useEffect(() => {
    const root = document.documentElement;
    let last = '';
    const upd = () => {
      const max = root.scrollHeight - window.innerHeight;
      // при издърпване (scrollY < 0 на iOS) редовете на листа отзад се движат заедно с хедъра
      root.style.setProperty('--pull', Math.max(0, -window.scrollY) + 'px');
      const c = window.scrollY > max / 2 ? '#2a1212' : '#FEF9E9';
      if (c !== last) { root.style.backgroundColor = c; last = c; }
    };
    upd();
    window.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    return () => { window.removeEventListener('scroll', upd); window.removeEventListener('resize', upd); };
  }, []);
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

  // линиите и листът вдясно се появяват при скрол
  useEffect(() => {
    const els = document.querySelectorAll('.sv');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('vis')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    els.forEach((e) => { if (!e.classList.contains('scrap') && !e.classList.contains('d2')) io.observe(e); });
    const d2 = document.querySelector('.d2.sv'), ab = document.querySelector('.d2s');
    let io3 = null;
    if (d2 && ab) { io3 = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { d2.classList.add('vis'); io3.disconnect(); } }), { threshold: 0, rootMargin: '0px 0px -18% 0px' }); io3.observe(ab); }
    const tb = document.querySelector('.tabs'), sc = document.querySelector('.scrap');
    let io2 = null;
    if (tb && sc) { io2 = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { sc.classList.add('vis'); io2.disconnect(); } }), { threshold: 0 }); io2.observe(tb); }
    return () => { io.disconnect(); io2 && io2.disconnect(); io3 && io3.disconnect(); };
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

  const V = '/img/v2/';

  return (
    <>
      <HeartSymbol />
      {intro !== 'done' && (
        <div className={'spl ' + intro} ref={splRef} aria-hidden="true">
          <div className="spl-lg" ref={splLogoRef}>
            <svg className="spl-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" /></svg>
            <img src={V + 'logo.png'} alt="" />
          </div>
        </div>
      )}
      <div className={'pg' + (introGo ? ' go' : '')}>
        <header className="hd">
          <div className="hp" aria-hidden="true" />
          <img className="logo" src={V + 'logo.png'} alt="Душички" />
          <div className="hr">
            <button className="login" id="acc" onClick={openAccount} aria-label={user ? 'Профил' : 'Вход'} title={user ? 'Профил' : 'Вход'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4.1" /><path d="M4.6 19.9c.4-3.7 3.4-6.1 7.4-6.1s7 2.4 7.4 6.1c.1.6-.4 1.1-1 1.1H5.6c-.6 0-1.1-.5-1-1.1z" /></svg>
              <span className="lb">{user ? <><span className="gr">Здравей, </span>{String(user.name || user.email || '').trim().split(/\s+/)[0]}</> : 'Влез'}</span>
            </button>
            <button className={'cartb' + (pulse ? ' pulse' : '')} id="cartb" aria-label="Количка" onClick={openCart}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.6 3.6h1.9c.7 0 1.2.4 1.4 1.1l2.2 9.5c.2.7.8 1.2 1.5 1.2h8.3c.7 0 1.3-.5 1.5-1.1l1.8-6.4c.2-.8-.4-1.5-1.2-1.5H5.6" /><path d="M10.2 10.4h7.2" /><circle cx="9.6" cy="19.7" r="1.6" /><circle cx="17.5" cy="19.7" r="1.6" /></svg>
              <span className="lb">Количка</span>
              {cart.length > 0 && <span className="bd" id="cnt">{cart.length}</span>}
            </button>
          </div>
        </header>

        <div className={"cv" + (scrollOpen ? " op" : "") + (typed ? " tp" : "")}>
          <div className="glow" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          <img className="fx heart1" src={V + 'heart1-r.webp'} alt="" />
          <img className="fx heart2" src={V + 'heart2-r.webp'} alt="" />
          <svg className="fx d1 d1w" viewBox="0 0 760 340" aria-hidden="true">
            <defs><mask id="d1m" maskUnits="userSpaceOnUse" x="0" y="0" width="760" height="340">
              <path className="ln" pathLength="1" fill="none" stroke="#fff" strokeWidth="34" strokeLinecap="butt" strokeLinejoin="round" d="M-5 299C60 308 130 316 200 316C290 316 350 300 381 262C395 230 380 190 345 155C320 132 292 140 288 170C292 215 330 255 385 263C470 270 570 220 640 150C670 120 683 95 688 70C692 62 692 52 691 40C676 40 678 20 692 18C708 20 708 48 692 60"/>
            </mask></defs>
            <g mask="url(#d1m)"><path d={D1} fill="#FEF9E9" opacity=".52" /></g>
          </svg>
          <span className="d2s" aria-hidden="true" />
          <img className="fx d2 wp sv" src={V + 'd2.svg'} alt="" />
          <div className="fx scrap sv" aria-hidden="true" />

          <main>
            <section className={'hero' + (typed ? ' typed' : '')}>
              <h1><Type text="Подарък за твоята душичка, който топли сърцето с години." start={250} onDone={() => setTyped(true)} run={introGo} /></h1>
              <p>Дай живот на спомените си.</p>
              <button className="btn" id="go" onClick={goShop}>И аз искам!</button>
              <div className="hi" role="img" aria-label="Черна блуза с бродерия на танцуваща двойка, а до нея снимката, по която е направена">
                <img className="hl hl-b" src={V + 'hero-bouq.webp'} alt="" />
                <img className="hl hl-s" src={V + 'hero-shirt.webp'} alt="" />
                <img className="hl hl-t" src={V + 'hero-tab.webp'} alt="" />
                <img className="hl hl-r" src={V + 'hero-rose.webp'} alt="" />
              </div>
            </section>

            <section className="tabsec" id="shop">
              <div className="tabs" role="tablist" ref={tabsRef}>
                <svg className="th" viewBox="0 0 30 27" aria-hidden="true" style={heartX == null ? { left: '50%' } : { left: heartX }}><path fill="#FEF9E9" d="M15 26.3C5.6 19.4.6 14.4.6 8.3.6 4.1 3.8.8 7.9.8c3 0 5.5 1.7 7.1 4.3C16.6 2.5 19.1.8 22.1.8c4.1 0 7.3 3.3 7.3 7.5 0 6.1-5 11.1-14.4 18z" /></svg>
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
              <img className="nd" onClick={() => setScrollOpen((o) => !o)} src={V + 'note.svg'} alt="Зад Душички? Казвам се Йоан и винаги съм искал да създам продукт, който да изпълва сърцата на хората. Нещо, което можеш да пазиш с години. Вярвам, че хората не помнят предмети, а моменти. Танца с любим човек. Развълнувания поглед на кученцето ти. Усмивката на близък, който вече не е до нас. Независимо по каква причина. Затова в Душички превръщаме тези мигове в изкуство, което можеш да носиш всеки ден. Защото споменът е най-хубав, когато е близо до сърцето." />
              <button type="button" className="nhint" aria-expanded={scrollOpen} onClick={() => setScrollOpen((o) => !o)}>{scrollOpen ? 'затвори ▲' : 'докосни, за да прочетеш ♡'}</button>
              <div className={'nm2' + (scrollOpen ? ' open' : '')} onClick={() => setScrollOpen((o) => !o)}>
                <span className="rl rt" aria-hidden="true" />
                <div className="pap">
                  <button type="button" className="sch" aria-expanded={scrollOpen} aria-controls="scb">
                    <img className="ttl" src={V + 'ttl.webp'} alt="Зад Душички?" />
                    <img className="nl" src={V + 'nlogo-cut.webp'} alt="" />
                    <span className="hint" aria-hidden="true">докосни, за да разгънеш ♡</span>
                  </button>
                  <div className="scb" id="scb">
                    <div className="sci">
                      <div className="tx">
                        <p>Казвам се Йоан и винаги съм искал да създам продукт, който да изпълва сърцата на хората. Нещо, което можеш да <u>пазиш с години.</u></p>
                        <p>Вярвам, че хората не помнят предмети, а <span className="ov">моменти.</span> Танца с любим човек. Развълнувания поглед на кученцето ти. Усмивката на близък, който вече не е до нас. Независимо по каква причина. ♡</p>
                        <p>Затова в Душички превръщаме тези мигове в изкуство, което можеш да носиш всеки ден. Защото споменът е най-хубав, когато е близо до сърцето. :)</p>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="rl rb" aria-hidden="true" />
              </div>
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
