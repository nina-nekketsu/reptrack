import React from 'react';

export default function Toast({ message, actionLabel, onAction }) {
  return (
    <div className="toast" onClick={(event) => event.stopPropagation()}>
      <span className="toast__message" role="status" aria-live="polite">{message}</span>
      {actionLabel && onAction && (
        <button type="button" className="toast__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
