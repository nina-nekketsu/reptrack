import React, { useEffect, useRef } from 'react';
import './Sheet.css';

const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function Sheet({ open, onClose, title, children, className = '', swipeToDismiss = true }) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  const touchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector(FOCUSABLE);
      (first || panelRef.current)?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...(panelRef.current?.querySelectorAll(FOCUSABLE) || [])];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const titleId = `sheet-title-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={panelRef}
        className={`sheet-panel edge-fade-scroll ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onTouchStart={(event) => {
          if (!swipeToDismiss || panelRef.current?.scrollTop > 0) return;
          const touch = event.touches[0];
          touchRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchRef.current;
          touchRef.current = null;
          if (!start || !swipeToDismiss) return;
          const touch = event.changedTouches[0];
          if (touch.clientY - start.y > 80 && Math.abs(touch.clientX - start.x) < 70) onClose();
        }}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label={`Close ${title}`}>×</button>
        </header>
        {children}
      </section>
    </div>
  );
}
