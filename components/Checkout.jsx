'use client';
import { supabaseEnabled, submitOrder, loadOffices } from '../lib/supabase';
import { useEffect, useMemo, useState } from 'react';
import { COURIER, SHIP, eur } from '../lib/data';
import { api } from '../lib/api';

// Поле с рамка и червено съобщение за грешка (извън Checkout, за да не губи фокус при писане)
function Field({ id, ph, value, onChange, err, type = 'text', ...rest }) {
  return (
    <>
      <div className={'f2' + (err ? ' bad' : '')} id={'f-' + id}>
        <input id={id} type={type} placeholder={ph} aria-label={ph.replace(' *', '')} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      </div>
      <div className="fe" id={'e-' + id}>{err || ''}</div>
    </>
  );
}

const EMPTY = { c1: '', c1b: '', c2: '', c3: '', 'd-city': '', office: '', oq: '', 'd-street': '', 'd-no': '', 'd-apt': '', 'd-block': '', 'd-zip': '', 'd-note': '', 'd-office': '' };

export default function Checkout({ cart, subtotal, user, apiOk, cfg, openLegal, onBack, onSaved }) {
  const [f, setF] = useState({ ...EMPTY, c1: (user?.name || '').split(' ')[0], c1b: (user?.name || '').split(' ').slice(1).join(' '), c2: user?.email || '' });
  const [courier, setCourier] = useState('econt');
  const [type, setType] = useState('office');
  const [offs, setOffs] = useState({});
  const [errs, setErrs] = useState({});
  const [cer, setCer] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false); // списъкът с офиси е прибран, след като офис е избран

  const cr = COURIER[courier];
  const R = offs[courier];
  const list = R ? R.offices : [];

  // зареждане на офисите на избрания куриер (веднъж за куриер)
  useEffect(() => {
    if (offs[courier]) return;
    let dead = false;
    (async () => {
      let r;
      if (supabaseEnabled) r = await loadOffices(courier);
      else if (!apiOk) r = { manual: true, offices: [] };
      else { try { r = await api('offices', null, '&courier=' + courier); } catch (e) { r = { manual: true, offices: [] }; } }
      if (!dead) setOffs((o) => ({ ...o, [courier]: r }));
    })();
    return () => { dead = true; };
  }, [courier, apiOk]); // eslint-disable-line react-hooks/exhaustive-deps

  const cities = useMemo(() => [...new Set(list.map((o) => o.c).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'bg')), [list]);
  const city = f['d-city'].trim().toLowerCase();
  const matches = useMemo(
    () => (type === 'office' && R && !R.manual ? list.filter((o) => o.c.toLowerCase() === city).sort((a, b) => (a.p - b.p) || a.n.localeCompare(b.n, 'bg')) : []),
    [type, R, list, city]
  );
  const sel = f.office || (matches.length === 1 ? matches[0].id : '');
  const q = f.oq.toLowerCase();
  const selOffice = sel ? list.find((o) => String(o.id) === String(sel)) : null;
  const showList = !selOffice || listOpen;
  const shown = matches.filter((o) => !q || (o.n + ' ' + o.a).toLowerCase().includes(q));

  const set = (k) => (v) => { setF((s) => ({ ...s, [k]: v })); setErrs((e) => (e[k] ? { ...e, [k]: '' } : e)); setCer(''); };
  const setCity = (v) => {
    setF((s) => {
      const n = { ...s, 'd-city': v };
      if (type === 'office' && !(R && R.manual)) { n.office = ''; n.oq = ''; }
      if (type === 'address') { const m = list.find((o) => o.c.toLowerCase() === v.trim().toLowerCase()); if (m && m.z && !s['d-zip']) n['d-zip'] = m.z; }
      return n;
    });
    setErrs((e) => ({ ...e, 'd-city': '', 'd-office': '' }));
    setCer('');
  };
  const pickCourier = (c) => { setCourier(c); setF((s) => ({ ...s, office: '', oq: '', ...(type === 'office' ? { 'd-city': '' } : {}) })); };

  const shipCents = supabaseEnabled ? (type === 'office' ? SHIP.office : SHIP.address) : (apiOk ? (type === 'office' ? cfg.ship_office : cfg.ship_address) : 0);
  const total = subtotal + shipCents;

  async function pay(e) {
    e.preventDefault();
    const er = {};
    const v = (id) => (f[id] || '').trim();
    if (v('c1').length < 2) er.c1 = 'Въведи име.';
    if (v('c1b').length < 2) er.c1b = 'Въведи фамилия.';
    if (!/^\S+@\S+\.\S+$/.test(v('c2'))) er.c2 = 'Невалиден имейл.';
    if (v('c3').length < 5) er.c3 = 'Въведи телефон за куриера.';
    const delivery = { courier, type };
    if (type === 'office') {
      if (R && R.manual) {
        if (v('d-city').length < 2) er['d-city'] = 'Въведи град.';
        if (v('d-office').length < 3) er['d-office'] = 'Напиши офиса.';
        delivery.city = v('d-city'); delivery.office_text = v('d-office');
      } else {
        if (!list.some((o) => o.c.toLowerCase() === v('d-city').toLowerCase())) er['d-city'] = 'Избери град от списъка.';
        else if (!sel) er['d-office'] = 'Избери офис.';
        delivery.office = sel;
        const so = list.find((o) => String(o.id) === String(sel));
        if (so) { delivery.office_text = [so.n, so.a].filter(Boolean).join(', '); delivery.city = so.c; }
      }
    } else {
      if (v('d-city').length < 2) er['d-city'] = 'Въведи град.';
      if (v('d-street').length < 2) er['d-street'] = 'Въведи улица или квартал.';
      if (!v('d-no')) er['d-no'] = 'Въведи номер.';
      if (v('d-zip').length < 3) er['d-zip'] = 'Въведи пощенски код.';
      Object.assign(delivery, { city: v('d-city'), street: v('d-street'), street_no: v('d-no'), apt: v('d-apt'), block: v('d-block'), zip: v('d-zip'), office_text: v('d-note') });
    }
    setErrs(er); setCer('');
    if (Object.keys(er).length) return setCer('Провери маркираните полета.');
    if (!accepted) return setCer('Трябва да приемеш Общите условия и Политиката за поверителност.');
    if (!apiOk && !supabaseEnabled) return setCer('Плащането работи на качения сайт със сървъра (api.php). В този преглед то не е свързано.');
    if (cart.some((i) => !i.photo)) return setCer('Някоя снимка не е качена. Махни артикула и го добави отново.');
    setBusy(true);
    if (supabaseEnabled) {
      try {
        const id = await submitOrder({
          customer: { first: v('c1'), last: v('c1b'), email: v('c2'), phone: v('c3') }, delivery, courier,
          items: cart.map((i) => ({ type: i.type, design: i.design, color: i.color, size: i.size, text: i.text, story: i.story, notes: i.notes, photo: i.photo, halo: i.halo, halo_who: i.halo_who, unit: i.unit })),
        });
        onSaved(id);
      } catch (err) { setCer(err.message); setBusy(false); }
      return;
    }
    try {
      const r = await api('checkout', {
        customer: { name: v('c1') + ' ' + v('c1b'), email: v('c2'), phone: v('c3') }, delivery,
        items: cart.map((i) => ({ type: i.type, design: i.design, color: i.color, size: i.size, text: i.text, story: i.story, notes: i.notes, photo: i.photo, halo: i.halo, halo_who: i.halo_who })),
      });
      location.href = r.url;
    } catch (err) { setCer(err.message); setBusy(false); }
  }

  const manual = R && R.manual;
  return (
    <>
      <h2>Поръчка</h2>
      <form id="ck" noValidate onSubmit={pay}>
        <h3 style={{ marginTop: 4 }}>Кой получава</h3>
        <div className="row">
          <div><Field id="c1" ph="Първо име *" value={f.c1} onChange={set('c1')} err={errs.c1} autoComplete="given-name" /></div>
          <div><Field id="c1b" ph="Фамилия *" value={f.c1b} onChange={set('c1b')} err={errs.c1b} autoComplete="family-name" /></div>
        </div>
        <div className="row">
          <div><Field id="c2" type="email" ph="Имейл *" value={f.c2} onChange={set('c2')} err={errs.c2} autoComplete="email" /></div>
          <div><Field id="c3" type="tel" ph="Телефон *" value={f.c3} onChange={set('c3')} err={errs.c3} autoComplete="tel" /></div>
        </div>

        <h3>Доставка</h3>
        <div className="seg big" role="group" aria-label="Куриер">
          {Object.keys(COURIER).map((c) => (
            <button key={c} type="button" data-cr={c} aria-pressed={courier === c} onClick={() => pickCourier(c)}>{COURIER[c]}</button>
          ))}
        </div>
        <div className="rad" role="radiogroup" aria-label="Начин на доставка">
          <label><input type="radio" name="ty" value="office" checked={type === 'office'} onChange={() => setType('office')} />До офис</label>
          <label><input type="radio" name="ty" value="address" checked={type === 'address'} onChange={() => setType('address')} />До адрес</label>
        </div>

        <div id="dl">
          {!R && <p className="hint">Зареждаме офисите на {cr}...</p>}
          {R && type === 'office' && manual && (
            <>
              <Field id="d-city" ph="Град *" value={f['d-city']} onChange={set('d-city')} err={errs['d-city']} autoComplete="address-level2" />
              {f['d-city'].trim().length >= 2 && (
                <>
                  <Field id="d-office" ph="Кой е офисът? *" value={f['d-office']} onChange={set('d-office')} err={errs['d-office']} />
                  <p className="hint">Напиши офиса на {cr}, в който искаш да получиш пратката (име или адрес).</p>
                </>
              )}
            </>
          )}
          {R && type === 'office' && !manual && (
            <>
              <datalist id="cl">{cities.map((c) => <option key={c} value={c} />)}</datalist>
              <div className={'f2' + (errs['d-city'] ? ' bad' : '')} id="f-d-city">
                <input id="d-city" type="text" list="cl" placeholder="Град *" aria-label="Град" autoComplete="off"
                  value={f['d-city']} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="fe" id="e-d-city">{errs['d-city'] || ''}</div>
              <input type="hidden" id="d-office" value={sel} readOnly />
              {selOffice && !showList && (
                <div className="f2" id="f-d-office">
                  <input type="text" id="of-sel" readOnly aria-label="Избран офис (натисни за промяна)" style={{ cursor: 'pointer', textOverflow: 'ellipsis' }}
                    value={selOffice.n + ' – ' + selOffice.a} onClick={() => setListOpen(true)} onFocus={() => setListOpen(true)} />
                </div>
              )}
              {showList && matches.length > 6 && (
                <div className="f2"><input type="text" id="of-q" placeholder="Търси по име или адрес на офис" aria-label="Търси офис" value={f.oq} onChange={(e) => set('oq')(e.target.value)} /></div>
              )}
              {showList && matches.length > 0 && (
                <div className="ol" role="radiogroup" aria-label={'Офиси на ' + cr}>
                  {shown.map((o) => (
                    <label className="of" key={o.id}>
                      <input type="radio" name="of" value={o.id} checked={sel === o.id} onChange={() => { set('office')(o.id); setListOpen(false); }} onClick={() => setListOpen(false)} />
                      <span><b>{o.n}</b>{o.p ? <i>Автомат</i> : null}<small>{o.a}</small></span>
                    </label>
                  ))}
                  {!shown.length && <p className="hint" style={{ padding: 12 }}>Няма офис с такова име или адрес.</p>}
                </div>
              )}
              <div className="fe" id="e-d-office">{errs['d-office'] || ''}</div>
              <div className="hint" id="oinfo">
                {selOffice && !showList ? 'Натисни избрания офис, ако искаш да го смениш.' : matches.length
                  ? matches.length + (matches.length === 1 ? ' офис' : ' офиса') + ' в ' + matches[0].c + '. Избери най-удобния за теб.'
                  : city ? 'Няма намерен град. Избери от списъка с предложения.' : ''}
              </div>
            </>
          )}
          {R && type === 'address' && (
            <>
              <datalist id="cl">{cities.map((c) => <option key={c} value={c} />)}</datalist>
              <div className={'f2' + (errs['d-city'] ? ' bad' : '')} id="f-d-city">
                <input id="d-city" type="text" list={manual ? undefined : 'cl'} placeholder="Град *" aria-label="Град" autoComplete="address-level2"
                  value={f['d-city']} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="fe" id="e-d-city">{errs['d-city'] || ''}</div>
              <Field id="d-street" ph="Улица / квартал *" value={f['d-street']} onChange={set('d-street')} err={errs['d-street']} autoComplete="address-line1" />
              <div className="row">
                <div><Field id="d-no" ph="Номер на улица *" value={f['d-no']} onChange={set('d-no')} err={errs['d-no']} /></div>
                <div><Field id="d-apt" ph="Апартамент" value={f['d-apt']} onChange={set('d-apt')} /></div>
              </div>
              <Field id="d-block" ph="Блок, вход, етаж" value={f['d-block']} onChange={set('d-block')} />
              <Field id="d-zip" ph="Пощенски код *" value={f['d-zip']} onChange={set('d-zip')} err={errs['d-zip']} inputMode="numeric" autoComplete="postal-code" />
              <Field id="d-note" ph={'Добавете офис на ' + cr + ' при нужда'} value={f['d-note']} onChange={set('d-note')} />
              <p className="hint">Ако куриерът не стига до адреса, пратката ще бъде оставена в посочения офис.</p>
            </>
          )}
        </div>

        <div className="sum" style={{ marginTop: 14 }}><span>Артикули</span><span>{eur(subtotal)}</span></div>
        <div className="sum"><span>Доставка</span><span id="shp">{shipCents ? eur(shipCents) : 'Безплатна'}</span></div>
        <div className="sum tot"><span>Общо за плащане</span><span id="grand">{eur(total)}</span></div>
        <label className="ck">
          <input type="checkbox" id="c7" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>Прочетох и приемам{' '}
            <button type="button" className="link" onClick={() => openLegal('terms')}>Общите условия</button> и{' '}
            <button type="button" className="link" onClick={() => openLegal('priv')}>Политиката за поверителност</button>.</span>
        </label>
        <p className="hint">Картата се въвежда на защитената страница на Stripe. Ние не виждаме и не пазим данните ѝ.</p>
        <div className="er" id="cer" role="alert">{cer}</div>
        <button className="btn add" id="pay" style={{ fontSize: '1.1rem' }} type="submit" disabled={busy}>
          {busy ? (supabaseEnabled ? 'Изпращаме поръчката...' : 'Пренасочваме към Stripe...') : (supabaseEnabled ? 'Поръчай · ' : 'Плати ') + eur(total)}
        </button>
        <p style={{ textAlign: 'center', marginTop: 10 }}><button type="button" className="link" onClick={onBack}>← Обратно към количката</button></p>
      </form>
    </>
  );
}
