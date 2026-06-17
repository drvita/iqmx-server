import { ReactNode } from 'react';

interface HighlightBannerProps {
    children: ReactNode;
    variant?: 'green' | 'yellow' | 'blue' | 'custom';
    className?: string;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
}

const variantStyles = {
    green:
        'bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-500',
    yellow:
        'bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-400',
    blue: 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-500',
    custom: '',
};

const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    full: 'max-w-full',
};

export default function HighlightBanner({
    children,
    variant = 'green',
    className = '',
    maxWidth = '3xl',
}: HighlightBannerProps) {
    const baseStyles = 'rounded-xl p-6 shadow-md';
    const variantClass = variant === 'custom' ? '' : variantStyles[variant];
    const maxWidthClass = maxWidthStyles[maxWidth];

    return (
        <div
            className={`${baseStyles} ${variantClass} ${maxWidthClass} mx-auto ${className}`}
        >
            {children}
        </div>
    );
}
