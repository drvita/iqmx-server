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
