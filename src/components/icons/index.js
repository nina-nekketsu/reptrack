import React from 'react';

function IconBase({ children, title, className = '', ...props }) {
  const labelled = Boolean(title);
  return (
    <svg
      className={`rt-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : 'true'}
      role={labelled ? 'img' : undefined}
      {...props}
    >
      {labelled && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function DumbbellIcon(props) {
  return <IconBase {...props}><path d="M6 7v10" /><path d="M18 7v10" /><path d="M3 9v6" /><path d="M21 9v6" /><path d="M6 12h12" /></IconBase>;
}

export function RepeatIcon(props) {
  return <IconBase {...props}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 013-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 01-3 3H3" /></IconBase>;
}

export function TrendIcon(props) {
  return <IconBase {...props}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></IconBase>;
}

export function TrophyIcon(props) {
  return <IconBase {...props}><path d="M8 4h8v4a4 4 0 01-8 0V4z" /><path d="M8 6H5a2 2 0 002 4h1" /><path d="M16 6h3a2 2 0 01-2 4h-1" /><path d="M12 12v5" /><path d="M8 20h8" /><path d="M10 17h4" /></IconBase>;
}

export function TimerIcon(props) {
  return <IconBase {...props}><circle cx="12" cy="13" r="7" /><path d="M9 2h6" /><path d="M12 6V2" /><path d="M12 13l3-2" /></IconBase>;
}

export function BoltIcon(props) {
  return <IconBase {...props}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></IconBase>;
}

export function WarningIcon(props) {
  return <IconBase {...props}><path d="M12 3l9 16H3l9-16z" /><path d="M12 9v4" /><path d="M12 17h.01" /></IconBase>;
}

export function CheckIcon(props) {
  return <IconBase {...props}><path d="M20 6L9 17l-5-5" /></IconBase>;
}

export function TrashIcon(props) {
  return <IconBase {...props}><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></IconBase>;
}

export function ClipboardIcon(props) {
  return <IconBase {...props}><path d="M9 4h6" /><path d="M10 2h4l1 2h3v18H6V4h3l1-2z" /><path d="M9 11h6" /><path d="M9 15h4" /></IconBase>;
}

export function LockIcon(props) {
  return <IconBase {...props}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></IconBase>;
}

export function EyeIcon(props) {
  return <IconBase {...props}><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></IconBase>;
}

export function LinkIcon(props) {
  return <IconBase {...props}><path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1" /><path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" /></IconBase>;
}

export function RotateIcon(props) {
  return <IconBase {...props}><path d="M21 12a9 9 0 11-3-6.7" /><path d="M21 4v6h-6" /></IconBase>;
}

export function PackageIcon(props) {
  return <IconBase {...props}><path d="M12 3l8 4-8 4-8-4 8-4z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></IconBase>;
}

export function EmptyIcon(props) {
  return <IconBase {...props}><path d="M4 7h16l-2 12H6L4 7z" /><path d="M8 7a4 4 0 018 0" /><path d="M9 14h6" /></IconBase>;
}
