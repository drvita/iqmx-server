import Link from 'next/link';
import Image from 'next/image';
import ActionButton from './ActionButton';
import WhatsAppIcon from './icons/WhatsAppIcon';

interface NavbarProps {
  showMenu?: boolean;
}

export default function Navbar({ showMenu = true }: NavbarProps) {
  const number = '5213141560219';

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center">
                <Image
                  src="/logo.png"
                  alt="IQISSMexico Logo"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                  priority
                />
              </Link>
            </div>
            {showMenu && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Inicio
                </Link>
                <Link
                  href="/aboutus"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Nosotros
                </Link>
                <Link
                  href="/landingpage/whatsapp"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  WhatsApp
                </Link>
                <Link
                  href="/landingpage/consultorios"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Consultorios
                </Link>
              </div>
            )}
          </div>
          {showMenu && (
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <ActionButton
                text="Contactanos"
                id="nav_btn_contact"
                url={`https://wa.me/${number}?text=Quiero%20una%20cita%20para%20mi%20negocio`}
                className="bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                icon={<WhatsAppIcon className="w-4 h-4" />}
                iconPosition="left"
              />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
