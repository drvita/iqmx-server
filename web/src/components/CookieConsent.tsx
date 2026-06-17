'use client';

import { useEffect, useState } from 'react';

export default function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Verificar si el usuario ya aceptó las cookies
        const cookieConsent = localStorage.getItem('cookieConsent');
        if (!cookieConsent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        // Guardar la aceptación en localStorage
        localStorage.setItem('cookieConsent', 'accepted');
        setIsVisible(false);
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg z-50 animate-slide-up">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1 text-sm">
                    <p className="mb-2 sm:mb-0">
                        🍪 Utilizamos cookies propias y de terceros para mejorar nuestros servicios y
                        analizar el tráfico del sitio web. Al continuar navegando, aceptas su uso.
                    </p>
                    <p className="text-xs text-gray-400">
                        Consulta nuestro{' '}
                        <a
                            href="/privacidad"
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                            Aviso de Privacidad
                        </a>{' '}
                        y{' '}
                        <a
                            href="/terminos"
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                            Términos de Servicio
                        </a>
                        .
                    </p>
                </div>
                <button
                    onClick={handleAccept}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors whitespace-nowrap"
                >
                    Aceptar
                </button>
            </div>
        </div>
    );
}
