'use client';
import { useEffect } from 'react';
import Dialog from './Dialog';
import { LEGAL } from '../lib/legal';

export default function LegalDialog({ id, sec, onClose }) {
  useEffect(() => {
    if (!id || !sec) return;
    const t = setTimeout(() => {
      const el = [...document.querySelectorAll('#lgb h3, #lgb h2')].find((x) => x.textContent.trim().startsWith(sec));
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 120);
    return () => clearTimeout(t);
  }, [id, sec]);
  return (
    <Dialog open={!!id} onClose={onClose} className="md" label="Правила">
      {id && <div className="leg" id="lgb" dangerouslySetInnerHTML={{ __html: LEGAL[id] }} />}
    </Dialog>
  );
}
