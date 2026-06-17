import { ReactNode } from 'react';

interface SectionProps {
    children: ReactNode;
    className?: string;
    id?: string;
    title?: string;
    titleClassName?: string;
}

export default function Section({ children, className = '', id, title, titleClassName = '' }: SectionProps) {
    return (
        <section id={id} className={`py-16 px-4 sm:px-6 lg:px-8 ${className}`}>
            <div className="max-w-7xl mx-auto">
                {title && (
                    <h2 className={`text-3xl font-extrabold mb-8 text-center ${titleClassName || 'text-gray-900'}`}>
                        {title}
                    </h2>
                )}
                {children}
            </div>
        </section>
    );
}
