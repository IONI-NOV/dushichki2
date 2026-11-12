'use client';
import { supabaseEnabled, uploadPhoto } from '../lib/supabase';
import { useState } from 'react';
import Dialog from './Dialog';
import { HALO } from './Icons';
import { DESIGNS, KIND, TEXT_ADD, eur, img } from '../lib/data';
import { api, thumb } from '../lib/api';

export default function ProductDialog({ kind, design, apiOk, onClose, onAdd, onSizes }) {
  const open = design !== null;
  return (
    <Dialog open={open} onClose={onClose} label="Продукт">
      {open && <ProductForm kind={kind} i={design} apiOk={apiOk} onClose={onClose} onAdd={onAdd} onSizes={onSizes} />}
    </Dialog>
  );
}

function ProductForm({ kind: k, i, apiOk, onClose, onAdd, onSizes }) {
  const K = KIND[k];
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(K.sizes[0]);
  const [file, setFile] = useState(null);
  const [prev, setPrev] = useState('');
  const [drag, setDrag] = useState(false);
  const [halo, setHalo] = useState('halo');
  const [who, setWho] = useState('');
  const [textOn, setTextOn] = useState(false);
  const [text, setText] = useState('');
  const [story, setStory] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const withText = textOn && text.trim();
  const price = K.price + (withText ? TEXT_ADD : 0);

  async function pick(f) {
    setFile(f || null);
    setPrev('');
    if (f) { setErr(''); const t = await thumb(f); if (t) setPrev(t); }
  }

  async function add() {
    if (!file) return setErr('Качи снимка, за да добавиш продукта.');
    if (!/^image\//.test(file.type)) return setErr('Качи снимка във формат JPG, PNG или WEBP.');
    if (file.size > 12 * 1024 * 1024) return setErr('Снимката е твърде голяма (до 12 MB).');
    if (i === 2 && !who.trim()) { document.getElementById('hw')?.focus(); return setErr('Напиши кой да получи ореола/крилата.'); }
    if (textOn && !text.trim()) return setErr('Напиши текста, който да бродираме, или махни отметката.');
    setBusy(true);
    let token = null;
    if (supabaseEnabled) {
      try { token = await uploadPhoto(file); } catch (e) { setErr(e.message); setBusy(false); return; }
    } else if (apiOk) {
      try {
        const fd = new FormData();
        fd.append('photo', file);
        token = (await api('upload', fd)).token;
      } catch (e) { setErr(e.message); setBusy(false); return; }
    }
    onAdd({
      id: Date.now().toString(36), type: k, design: i, color: K.colors[color][0], size,
      text: withText ? text.trim() : '', story: story.trim(), notes: notes.trim(), unit: price,
      thumb: await thumb(file), photo: token,
      halo: i === 2 ? halo : '', halo_who: i === 2 ? who.trim() : '',
    });
  }

  return (
    <div className="pm" id="pmb">
      <div>
        <div className="im"><img id="pi" src={img(k, K.colors[color][1], i)} alt={DESIGNS[i].n} /></div>
        <div className="st">Сподели историята си ❤️</div>
        <input type="text" id="sy" maxLength={300} value={story} onChange={(e) => setStory(e.target.value)}
          placeholder="Ще се радваме да знаем защо тази поръчка е специална за теб" aria-label="Историята ти" />
      </div>
      <div>
        <h2>{DESIGNS[i].n} – {K.one}</h2>
        <div className="pr2"><span id="pp">{eur(price)}</span></div>
        <div className="fld">
          <label htmlFor="co">Цвят</label>
          <select id="co" value={color} onChange={(e) => setColor(+e.target.value)}>
            {K.colors.map((c, x) => <option key={x} value={x}>{c[0]}</option>)}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="sz">Размер</label>
          <select id="sz" value={size} onChange={(e) => setSize(e.target.value)}>
            {K.sizes.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button className="sz" id="szb" type="button" onClick={() => onSizes(k)}>Размери</button>

        <div className="st">Качи своята снимка <span style={{ color: 'var(--red)' }}>*</span></div>
        <div
          className={'drop' + (drag ? ' on' : '')} id="dz"
          onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) pick(e.dataTransfer.files[0]); }}
        >
          <div id="pv">{prev && <img alt="Преглед на снимката" src={prev} />}</div>
          <label htmlFor="fi">Избери файл</label>
          <input type="file" id="fi" accept="image/*" onChange={(e) => pick(e.target.files[0])} />
          <div id="fn">{file ? <span className="fn">{file.name}</span> : 'или пусни файла тук'}</div>
        </div>

        {i === 2 && (
          <>
            <div className="st hc">Добави към дизайна <span style={{ color: 'var(--red)' }}>*</span></div>
            <div className="ht" role="radiogroup" aria-label="Ореол или крила">
              {HALO.map((h) => (
                <button key={h.k} type="button" className="hb" role="radio" aria-checked={halo === h.k}
                  data-h={h.k} title={h.n} aria-label={h.n} onClick={() => setHalo(h.k)}>{h.svg}</button>
              ))}
            </div>
            <div className="st hc">Кой да получи ореола/крилата? <span style={{ color: 'var(--red)' }}>*</span></div>
            <input type="text" id="hw" maxLength={20} value={who} onChange={(e) => setWho(e.target.value)}
              placeholder="Напиши кой да получи ореола/крилата" aria-label="Кой да получи ореола/крилата" />
            <div className="cnt" id="hwc">{who.length}/20 символа</div>
          </>
        )}

        <label className="ck">
          <input type="checkbox" id="tc" checked={textOn} onChange={(e) => setTextOn(e.target.checked)} /> Добави текст под дизайна (+ €1)
        </label>
        <div id="txt" style={{ display: textOn ? 'block' : 'none' }}>
          <input type="text" id="tv" maxLength={40} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Какъв текст да бродираме?" aria-label="Текст под дизайна" />
        </div>

        <div className="st">Бележки</div>
        <textarea id="nt" maxLength={600} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Ако искаш да видиш дизайна преди бродерията или имаш уточнения, напиши ги тук" aria-label="Бележки" />
        <div className="er" id="er" role="alert">{err}</div>
        <button className="btn add" id="ad" type="button" disabled={busy} onClick={add}>
          {busy ? 'Добавяне...' : 'Добави в количката'}
        </button>
      </div>
    </div>
  );
}
