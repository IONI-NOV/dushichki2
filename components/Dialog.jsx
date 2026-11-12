'use client';
import { useEffect, useRef } from 'react';

// Обвивка около нативния <dialog>: отваря се модално, затваря се с Esc, ×, или клик върху фона.
export default function Dialog({ open, onClose, className, label, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); d.scrollTop = 0; }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <button className="cl" aria-label="Затвори" onClick={onClose}>×</button>
      {open ? children : null}
    </dialog>
  );
}
