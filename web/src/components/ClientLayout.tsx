'use client';

import { usePathname } from 'next/navigation';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isLandingPage = pathname?.startsWith('/landingpage');
    const isPortal = pathname?.startsWith('/portal');
    const isAdmin = pathname?.startsWith('/admin');

    // El portal de clientes y el panel de administración cuentan con sus propios layouts dedicados
    if (isPortal || isAdmin) {
        return (
            <main className="flex-grow min-h-screen">
                {children}
            </main>
        );
    }

    return (
        <>
            <Navbar showMenu={!isLandingPage} />
            <main className="flex-grow">
                {children}
            </main>
            {!isLandingPage && <Footer />}
            <CookieConsent />
        </>
    );
}
