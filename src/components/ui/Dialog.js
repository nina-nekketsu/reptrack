import React, { useLayoutEffect, useId, useRef } from 'react';
import './ui.css';

export const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container) {
  return [...(container?.querySelectorAll(FOCUSABLE_SELECTOR) || [])].filter(
    (node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true' && node.tabIndex >= 0
  );
}

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className = '',
  panelClassName = '',
  labelledBy,
  describedBy,
  closeOnBackdrop = true,
  initialFocusRef,
  renderHeader = true,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const firstFocusable = initialFocusRef?.current || getFocusable(panelRef.current)[0];
    (firstFocusable || panelRef.current)?.focus?.();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [initialFocusRef, onClose, open]);

  if (!open) return null;

  const resolvedLabelledBy = labelledBy || titleId;
  const resolvedDescribedBy = describedBy || (description ? descriptionId : undefined);

  return (
    <div
      className={`ui-dialog-backdrop ${className}`}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={panelRef}
        className={`ui-dialog-panel ${panelClassName}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedLabelledBy}
        aria-describedby={resolvedDescribedBy}
        tabIndex={-1}
      >
        {renderHeader && (
          <header className="ui-dialog-header">
            <div>
              <h2 id={titleId} className="ui-dialog-title">{title}</h2>
              {description && <p id={descriptionId} className="ui-dialog-description">{description}</p>}
            </div>
            <button type="button" className="ui-icon-button" onClick={onClose} aria-label={`Close ${title}`} tabIndex={-1}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
        )}
        {children}
      </section>
    </div>
  );
}
