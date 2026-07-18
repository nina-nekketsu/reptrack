import React, { useRef } from 'react';
import Dialog from './ui/Dialog';
import './Sheet.css';

export default function Sheet({ open, onClose, title, children, className = '', swipeToDismiss = true }) {
  const panelRef = useRef(null);
  const touchRef = useRef(null);

  if (!open) return null;
  const titleId = `sheet-title-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className="sheet-backdrop"
      panelClassName={`sheet-panel edge-fade-scroll ${className}`}
      labelledBy={titleId}
      renderHeader={false}
    >
      <section
        ref={panelRef}
        className="sheet-panel__content"
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
    </Dialog>
  );
}
