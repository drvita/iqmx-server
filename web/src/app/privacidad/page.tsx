import Section from '@/components/Section';

export default function PrivacyPolicy() {
    return (
        <div className="flex flex-col min-h-screen">
            <Section title="Aviso de Privacidad" className="bg-white">
                <div className="max-w-4xl mx-auto text-left space-y-6">
                    {/* Fecha de última actualización */}
                    <p className="text-sm text-gray-500 italic">
                        Última actualización: Diciembre 2024
                    </p>

                    {/* Introducción */}
                    <div className="space-y-4">
                        <p className="text-gray-700">
                            IQISS Mexico (en adelante "nosotros" o "la empresa") se compromete a proteger
                            la privacidad de los usuarios que visitan nuestro sitio web. Este Aviso de
                            Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos su
                            información personal.
                        </p>
                    </div>

                    {/* Información que Recopilamos */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            1. Información que Recopilamos
                        </h2>

                        <h3 className="text-xl font-semibold text-gray-800">
                            1.1 Información proporcionada a través de WhatsApp
                        </h3>
                        <p className="text-gray-700">
                            Nuestro sitio web tiene como objetivo informar sobre nuestros productos a través
                            de landing pages. Cuando usted decide contactarnos vía WhatsApp y envía su primer
                            mensaje, recopilamos:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>Nombre registrado en WhatsApp</li>
                            <li>Número de teléfono</li>
                            <li>Contenido de los mensajes intercambiados</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            1.2 Autenticación de Google
                        </h3>
                        <p className="text-gray-700">
                            Para usuarios que contraten nuestros servicios, utilizamos autenticación de
                            terceros (Google) para acceder a Google Calendar. Esta funcionalidad NO es
                            obligatoria para todos los visitantes, solo aplica para clientes que contraten
                            servicios específicos. Los detalles de este acceso se establecen en el contrato
                            de servicios correspondiente.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            1.3 Cookies y tecnologías de seguimiento
                        </h3>
                        <p className="text-gray-700">
                            Utilizamos cookies de terceros para mejorar nuestro servicio y análisis:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>
                                <strong>Google Analytics:</strong> Para analizar el tráfico del sitio web y
                                comprender cómo los usuarios interactúan con nuestro contenido
                            </li>
                            <li>
                                <strong>Facebook Pixel:</strong> Para medir la efectividad de nuestras campañas
                                publicitarias y remarketing
                            </li>
                        </ul>
                        <p className="text-gray-700 mt-2">
                            Al navegar en nuestro sitio web después de ver el aviso de cookies, usted otorga
                            su consentimiento para el uso de estas tecnologías.
                        </p>
                    </div>

                    {/* Uso de la Información */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            2. Uso de la Información
                        </h2>
                        <p className="text-gray-700">
                            Utilizamos la información recopilada para los siguientes propósitos:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>Dar seguimiento a consultas y requerimientos de servicio</li>
                            <li>Enviar nuevas ofertas y promociones de productos</li>
                            <li>Mejorar nuestros servicios y experiencia del usuario</li>
                            <li>Analizar el rendimiento de nuestras campañas publicitarias</li>
                            <li>Cumplir con obligaciones contractuales para clientes que contraten servicios</li>
                        </ul>
                    </div>

                    {/* Procesamiento con IA */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            3. Procesamiento con Inteligencia Artificial
                        </h2>
                        <p className="text-gray-700">
                            Los mensajes enviados a través de WhatsApp pueden ser procesados mediante
                            Inteligencia Artificial. Específicamente:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>
                                Utilizamos un asistente automatizado (Bot) para responder consultas iniciales
                            </li>
                            <li>
                                El primer mensaje en WhatsApp informa al usuario sobre el uso del Bot.
                                Al continuar la conversación, usted otorga su consentimiento para esta interacción
                            </li>
                            <li>
                                Los mensajes son enviados a una API de terceros (Gemini de Google) para la
                                generación de respuestas mediante IA
                            </li>
                        </ul>
                    </div>

                    {/* Almacenamiento y Seguridad */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            4. Almacenamiento y Seguridad de Datos
                        </h2>
                        <p className="text-gray-700">
                            Su información es importante para nosotros. Por ello:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>
                                Almacenamos su información en bases de datos seguras dentro de una red privada
                            </li>
                            <li>
                                Implementamos medidas de seguridad técnicas y organizativas para proteger
                                sus datos contra acceso no autorizado, pérdida o alteración
                            </li>
                            <li>
                                Su información NO está expuesta públicamente
                            </li>
                            <li>
                                Conservamos sus datos solo durante el tiempo necesario para cumplir con
                                los fines descritos en este aviso
                            </li>
                        </ul>
                    </div>

                    {/* Compartir Información */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            5. Compartir Información con Terceros
                        </h2>
                        <p className="text-gray-700">
                            <strong>NO compartimos su información personal con terceros</strong> para
                            fines comerciales. Sin embargo, trabajamos con proveedores de servicios
                            que requieren acceso limitado:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>
                                <strong>Partner de WhatsApp:</strong> Utilizamos un partner oficial para
                                acceder a la API de WhatsApp. Desconocemos qué información adicional pueda
                                capturar este proveedor bajo sus propias políticas
                            </li>
                            <li>
                                <strong>Gemini API (Google):</strong> Para procesamiento de mensajes mediante IA
                            </li>
                            <li>
                                <strong>Google (Analytics y Calendar):</strong> Para análisis y funcionalidades
                                de calendario
                            </li>
                            <li>
                                <strong>Facebook (Pixel):</strong> Para medición de campañas publicitarias
                            </li>
                        </ul>
                        <p className="text-gray-700 mt-2">
                            Estos terceros están obligados a mantener la confidencialidad de su información
                            y solo pueden usarla para los propósitos específicos acordados.
                        </p>
                    </div>

                    {/* Derechos del Usuario */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            6. Sus Derechos ARCO
                        </h2>
                        <p className="text-gray-700">
                            Usted tiene derecho a:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>
                                <strong>Acceder</strong> a sus datos personales que poseemos
                            </li>
                            <li>
                                <strong>Rectificar</strong> sus datos si son inexactos o incompletos
                            </li>
                            <li>
                                <strong>Cancelar</strong> sus datos cuando considere que no se requieren
                                para alguna de las finalidades señaladas
                            </li>
                            <li>
                                <strong>Oponerse</strong> al tratamiento de sus datos para fines específicos
                            </li>
                        </ul>
                        <p className="text-gray-700 mt-2">
                            Para ejercer estos derechos, puede contactarnos a través de WhatsApp o
                            mediante los canales de contacto disponibles en nuestro sitio web.
                        </p>
                    </div>

                    {/* Consentimiento */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            7. Consentimiento
                        </h2>
                        <p className="text-gray-700">
                            Al utilizar nuestro sitio web y servicios, usted otorga su consentimiento para:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>
                                El uso de cookies al navegar en el sitio (después de aceptar el aviso de cookies)
                            </li>
                            <li>
                                La recopilación de su nombre y número de teléfono al contactarnos vía WhatsApp
                            </li>
                            <li>
                                La interacción con nuestro Bot automatizado al continuar la conversación
                                después del primer mensaje informativo
                            </li>
                            <li>
                                El procesamiento de sus mensajes con tecnología de IA
                            </li>
                        </ul>
                    </div>

                    {/* Cambios al Aviso */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            8. Cambios a este Aviso de Privacidad
                        </h2>
                        <p className="text-gray-700">
                            Nos reservamos el derecho de actualizar este Aviso de Privacidad en cualquier momento.
                            Cuando realicemos cambios significativos, actualizaremos la fecha de "última actualización"
                            en la parte superior de esta página. Le recomendamos revisar periódicamente este aviso
                            para mantenerse informado sobre cómo protegemos su información.
                        </p>
                    </div>

                    {/* Contacto */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            9. Contacto
                        </h2>
                        <p className="text-gray-700">
                            Si tiene preguntas, comentarios o inquietudes sobre este Aviso de Privacidad o
                            sobre el tratamiento de sus datos personales, puede contactarnos a través de
                            los medios disponibles en nuestro sitio web.
                        </p>
                    </div>

                    {/* Legislación Aplicable */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            10. Legislación Aplicable
                        </h2>
                        <p className="text-gray-700">
                            Este Aviso de Privacidad se rige por la Ley Federal de Protección de Datos
                            Personales en Posesión de los Particulares (LFPDPPP) de México y su Reglamento.
                        </p>
                    </div>
                </div>
            </Section>
        </div>
    );
}
