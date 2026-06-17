'use client';

import { ReactNode } from 'react';

interface ActionButtonProps {
  text: string;
  url: string;
  id?: string;
  className?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export default function ActionButton({
  text,
  url,
  id,
  className = 'bg-blue-600 text-white hover:bg-blue-700',
  icon,
  iconPosition = 'left',
}: ActionButtonProps) {
  return (
    <button
      id={id}
      className={`py-3 px-6 rounded-md font-semibold transition-colors inline-flex items-center gap-2 ${className}`}
      onClick={() => window.open(url, '_blank')}
    >
      {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
      <span>{text}</span>
      {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
    </button>
  );
}
