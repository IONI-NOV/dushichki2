'use client';
import { useEffect, useRef, useState } from 'react';

// Обвивка около нативния <dialog>: отваря се модално и се затваря САМО с бутона × (не с клик върху фона и не с Esc).
// Отварянето и затварянето са с лека анимация (CSS: dialog[open] / dialog.out).
export default function Dialog({ open, onClose, className, label, children }) {
  const ref = useRef(null);
  const last = useRef(null);
  const [closing, setClosing] = useState(false);
  if (open) last.current = children;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setClosing(false);
      if (!d.open) { d.showModal(); d.scrollTop = 0; }
      return;
    }
    if (d.open) {
      setClosing(true);
      const t = setTimeout(() => { d.close(); setClosing(false); }, 180);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={(className || '') + (closing ? ' out' : '')}
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => e.preventDefault()}
    >
      <button className="cl" aria-label="Затвори" onClick={onClose}>×</button>
      {open ? children : closing ? last.current : null}
    </dialog>
  );
}
