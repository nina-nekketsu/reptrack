import React from 'react';
import './ui.css';

export default function Row({ className = '', as: Component = 'div', interactive = false, ...props }) {
  const interactiveProps = interactive && Component === 'div' ? { role: 'button', tabIndex: 0 } : {};
  return <Component className={`ui-row ${interactive ? 'ui-row--interactive' : ''} ${className}`} {...interactiveProps} {...props} />;
}
