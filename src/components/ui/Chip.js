import React from 'react';
import './ui.css';

export default function Chip({ className = '', as: Component = 'span', ...props }) {
  return <Component className={`ui-chip ${className}`} {...props} />;
}
