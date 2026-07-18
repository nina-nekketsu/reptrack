import React from 'react';
import './ui.css';

export default function Button({ className = '', variant = 'secondary', size = 'md', ...props }) {
  return <button className={`ui-button ui-button--${variant} ui-button--${size} ${className}`} {...props} />;
}
