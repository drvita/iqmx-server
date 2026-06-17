export default function Footer() {
    return (
        <footer className="bg-gray-800 text-white">
            <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <h3 className="text-lg font-semibold mb-4">IQISSMexico</h3>
                        <p className="text-gray-400">
                            Soluciones tecnológicas accesibles para que tu negocio crezca y trabaje mejor.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-4">Enlaces</h3>
                        <ul className="space-y-2">
                            <li>
                                <a href="/" className="text-gray-400 hover:text-white">
                                    Inicio
                                </a>
                            </li>
                            <li>
                                <a href="/aboutus" className="text-gray-400 hover:text-white">
                                    Nosotros
                                </a>
                            </li>
                            <li>
                                <a href="/landingpage/whatsapp" className="text-gray-400 hover:text-white">
                                    Automatización de WhatsApp
                                </a>
                            </li>
                            <li>
                                <a href="/privacidad" className="text-gray-400 hover:text-white">
                                    Aviso de Privacidad
                                </a>
                            </li>
                            <li>
                                <a href="/terminos" className="text-gray-400 hover:text-white">
                                    Términos de Servicio
                                </a>
                            </li>
                            <li>
                                <a href="/eliminacion-cuenta" className="text-gray-400 hover:text-white">
                                    Eliminación de Cuenta
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Contacto</h3>
                        <p className="text-gray-400">info@iqissmexico.com</p>
                    </div>
                </div>
                <div className="mt-8 border-t border-gray-700 pt-8 text-center">
                    <p className="text-gray-400">
                        &copy; {new Date().getFullYear()} IQISSMexico. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
}
