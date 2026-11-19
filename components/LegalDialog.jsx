'use client';
import { useEffect } from 'react';
import Dialog from './Dialog';
import { LEGAL } from '../lib/legal';

export default function LegalDialog({ id, sec, onClose }) {
  useEffect(() => {
    if (!id || !sec) return;
    const t = setTimeout(() => {
      const el = [...document.querySelectorAll('#lgb h3, #lgb h2')].find((x) => x.textContent.trim().startsWith(sec));
      if (!el) return;
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      // осветяваме целия раздел за малко, за да се вижда какво е отворено
      const els = [el];
      for (let n = el.nextElementSibling; n && !/^H[23]$/.test(n.tagName); n = n.nextElementSibling) els.push(n);
      setTimeout(() => els.forEach((x) => x.classList.add('hlx')), 350);
      hl = setTimeout(() => els.forEach((x) => x.classList.remove('hlx')), 2600);
    }, 120);
    let hl;
    return () => { clearTimeout(t); clearTimeout(hl); };
  }, [id, sec]);
  return (
    <Dialog open={!!id} onClose={onClose} className="md" label="Правила">
      {id && <div className="leg" id="lgb" dangerouslySetInnerHTML={{ __html: LEGAL[id] }} />}
    </Dialog>
  );
}
