import React from 'react';
import './ui.css';

export default function Badge({ className = '', tone = 'neutral', ...props }) {
  return <span className={`ui-badge ui-badge--${tone} ${className}`} {...props} />;
}
