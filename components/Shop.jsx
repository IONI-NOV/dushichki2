'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Deco, HeartSymbol, CartIcon } from './Icons';
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

  // връзка с PHP бекенда + връщане от Stripe
  useEffect(() => {
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
        setView({ name: 'msg', text: 'Плащането още не е потвърдено. Ако е минало, ще получиш имейл. При въпрос пиши на dushichki@gmail.com.' });
      } catch (e) {
        setView({ name: 'msg', text: 'Не успяхме да потвърдим плащането автоматично. Ако е минало, поръчката ти е записана. Пиши ни на dushichki@gmail.com.' });
      }
    }
  }

  const goShop = () => { setCartOpen(false); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const openCart = () => { setView({ name: 'cart' }); setCartOpen(true); };
  const openAccount = () => { setView(user ? { name: 'account' } : { name: 'login', mode: 'login', toCheckout: false }); setCartOpen(true); };

  return (
    <>
      <HeartSymbol />
      <div className="wrap">
        <Deco style={{ left: -150, top: 1450, width: 290, transform: 'rotate(-12deg)' }} />
        <Deco style={{ right: -160, top: 1330, width: 290, transform: 'rotate(14deg)' }} />

        <header>
          <img className="logo" src="/img/logo.png" alt="Душички" />
          <div className="hr">
            <button className="login" id="acc" onClick={openAccount}>{user ? 'Здравей, ' + user.name.split(' ')[0] : 'Вход'}</button>
            <button className="cartb" id="cartb" aria-label="Количка" onClick={openCart}>
              <CartIcon />
              {cart.length > 0 && <span className="bd" id="cnt">{cart.length}</span>}
            </button>
          </div>
        </header>

        <main>
          <section className="hero">
            <div>
              <h1>Подарък за <b>твоята душичка</b>, който ще го топли <b>с години.</b></h1>
              <p>Дай живот на снимка, разтапяща сърцето ти.</p>
              <button className="btn" id="go" onClick={goShop}>И аз искам!</button>
            </div>
            <img src="/img/hero.jpg" alt="Черна блуза с бродерия на танцуваща двойка, а до нея снимката, по която е направена" />
          </section>

          <section className="tabsec" id="shop">
            <div className="tabs" role="tablist">
              <button role="tab" id="t-hoodie" aria-selected={kind === 'hoodie'} onClick={() => setKind('hoodie')}>Худита</button>
              <button role="tab" id="t-tee" aria-selected={kind === 'tee'} onClick={() => setKind('tee')}>Тениски</button>
            </div>
          </section>

          <section className="grid" id="grid" aria-live="polite">
            {DESIGNS.map((d, i) => (
              <button className="card" key={kind + d.k} onClick={() => setProduct(i)}>
                <div className="im">
                  <img className="a" src={img(kind, 'b', i)} alt={d.n} loading="lazy" />
                  <img className="b" src={img(kind, 'w', i)} alt="" loading="lazy" />
                </div>
                <h3>{d.n}</h3>
                <p className="pr">{eur(KIND[kind].price)}</p>
              </button>
            ))}
          </section>
        </main>

        <footer>
          <button className="lk" onClick={() => setLegal('terms')}>Общи условия</button>
          <button className="lk" onClick={() => setLegal('priv')}>Политика за поверителност</button>
          <a className="lk" href="mailto:dushichki@gmail.com">dushichki@gmail.com</a>
        </footer>
      </div>

      <ProductDialog
        kind={kind} design={product} apiOk={apiOk}
        onClose={() => setProduct(null)}
        onSizes={setSizesFor}
        onAdd={(item) => { setCart((c) => [...c, item]); setProduct(null); toast('Добавено в количката ✓'); }}
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
