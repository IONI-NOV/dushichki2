'use client';
import { useEffect, useRef } from 'react';

// Обвивка около нативния <dialog>: отваря се модално (с лека анимация, виж CSS) и се затваря САМО с бутона × (не с клик върху фона и не с Esc).
export default function Dialog({ open, onClose, className, label, children }) {
  const ref = useRef(null);
  const sc = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); if (sc.current) sc.current.scrollTop = 0; }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => e.preventDefault()}
    >
      <button className="cl" aria-label="Затвори" onClick={onClose}>×</button>
      {/* съдържанието се скролва само вътре в пунктира, а × остава винаги на място */}
      <div className="dsc" ref={sc}>{open ? children : null}</div>
    </dialog>
  );
}
