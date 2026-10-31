'use client';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
export default function Dialog({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current; dialog?.showModal();
    const old = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; dialog?.close(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`dialog ${wide ? 'dialog-wide' : ''}`} onCancel={() => closeRef.current()} onClick={event => { if (event.target === event.currentTarget) closeRef.current(); }}>
    <div className="dialog-inner"><div className="dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}</div>
  </dialog>;
}
