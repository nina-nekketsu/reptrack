import React, { useLayoutEffect, useRef, useState } from 'react';

export const TOAST_EXIT_MS = 140;

function reducedMotionPreferred() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export default function Toast({ open = true, message, actionLabel, onAction }) {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState(open ? 'enter' : 'exit');
  const [suppressExitContent, setSuppressExitContent] = useState(false);
  const exitContentRef = useRef({ message, actionLabel });

  if (open) exitContentRef.current = { message, actionLabel };

  useLayoutEffect(() => {
    if (open) {
      setMounted(true);
      setPhase('enter');
      setSuppressExitContent(false);
      return undefined;
    }
    if (!mounted) return undefined;

    setPhase('exit');
    const timeoutId = window.setTimeout(
      () => setMounted(false),
      reducedMotionPreferred() ? 0 : TOAST_EXIT_MS
    );
    return () => window.clearTimeout(timeoutId);
  }, [mounted, open]);

  if (!mounted) return null;

  const exitContent = exitContentRef.current;
  const showExitContent = !open && !suppressExitContent;

  return (
    <div
      className={`toast toast--${phase}`}
      aria-hidden={open ? undefined : 'true'}
      onClick={(event) => event.stopPropagation()}
    >
      {open && (
        <>
          <span className="toast__message" role="status" aria-live="polite">{message}</span>
          {actionLabel && onAction && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                setSuppressExitContent(true);
                onAction();
              }}
            >
              {actionLabel}
            </button>
          )}
        </>
      )}
      {showExitContent && (
        <>
          <span className="toast__message">{exitContent.message}</span>
          {exitContent.actionLabel && (
            <span className="toast__action toast__action--exit">{exitContent.actionLabel}</span>
          )}
        </>
      )}
    </div>
  );
}
