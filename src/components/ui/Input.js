import React from 'react';
import './ui.css';

export default function Input({ className = '', ...props }) {
  return <input className={`ui-input ${className}`} {...props} />;
}
