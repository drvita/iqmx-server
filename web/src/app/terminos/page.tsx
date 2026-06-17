import Section from '@/components/Section';

export default function TermsOfService() {
    return (
        <div className="flex flex-col min-h-screen">
            <Section title="Términos y Condiciones de Servicio" className="bg-white">
                <div className="max-w-4xl mx-auto text-left space-y-6">
                    {/* Fecha de última actualización */}
                    <p className="text-sm text-gray-500 italic">
                        Última actualización: Diciembre 2024
                    </p>

                    {/* Introducción */}
                    <div className="space-y-4">
                        <p className="text-gray-700">
                            Los presentes Términos y Condiciones de Servicio (en adelante "Términos") rigen el uso
                            del servicio de automatización de WhatsApp proporcionado por IQISS Mexico (en adelante
                            "la empresa", "nosotros" o "nuestro"). Al contratar nuestro servicio, usted (en adelante
                            "el cliente" o "usted") acepta estar sujeto a estos Términos.
                        </p>
                        <p className="text-gray-700">
                            Le recomendamos leer cuidadosamente estos Términos antes de contratar nuestros servicios.
                        </p>
                    </div>

                    {/* Descripción del Servicio */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            1. Descripción del Servicio
                        </h2>
                        <p className="text-gray-700">
                            Ofrecemos un servicio de automatización de WhatsApp que incluye:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>
                                Bot automatizado con Inteligencia Artificial para atender consultas de sus clientes
                            </li>
                            <li>
                                Integración con Google Calendar y/o Base de Datos para la gestión de citas
                            </li>
                            <li>
                                Personalización del servicio según las necesidades específicas de su negocio
                            </li>
                            <li>
                                Almacenamiento y gestión de mensajes y datos de usuarios finales
                            </li>
                        </ul>
                    </div>

                    {/* Modelo de Pago */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            2. Modelo de Pago y Facturación
                        </h2>

                        <h3 className="text-xl font-semibold text-gray-800">
                            2.1 Suscripción Mensual
                        </h3>
                        <p className="text-gray-700">
                            El servicio se ofrece bajo un modelo de suscripción mensual. El costo específico se
                            determinará en función del nivel de personalización requerido y se establecerá en el
                            contrato individual con cada cliente.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            2.2 Pago Anticipado
                        </h3>
                        <p className="text-gray-700">
                            El pago mensual debe realizarse <strong>antes de que el servicio entre en producción</strong> cada
                            mes. Este proceso se repetirá mensualmente durante la vigencia del contrato.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            2.3 Falta de Pago
                        </h3>
                        <p className="text-gray-700">
                            En caso de que el cliente no realice el pago correspondiente al siguiente mes en el plazo
                            establecido, se entenderá como una <strong>rescisión automática del contrato</strong> por parte
                            del cliente, y el servicio será suspendido.
                        </p>
                    </div>

                    {/* Garantía y Reembolsos */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            3. Garantía de Satisfacción y Reembolsos
                        </h2>

                        <h3 className="text-xl font-semibold text-gray-800">
                            3.1 Garantía de 30 Días
                        </h3>
                        <p className="text-gray-700">
                            Ofrecemos una garantía de satisfacción de <strong>30 días</strong> desde la fecha de inicio del
                            servicio. Si el cliente no está satisfecho con el servicio durante este periodo, puede
                            solicitar el reembolso completo de su pago.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            3.2 Proceso de Reembolso
                        </h3>
                        <p className="text-gray-700">
                            Para solicitar un reembolso, el cliente debe notificarnos por escrito dentro del periodo
                            de 30 días. El reembolso se procesará en un plazo máximo de 15 días hábiles después de
                            recibir la solicitud.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            3.3 Reembolsos Fuera del Periodo de Garantía
                        </h3>
                        <p className="text-gray-700">
                            Pasado el periodo de 30 días, no se realizarán reembolsos por meses ya pagados.
                        </p>
                    </div>

                    {/* Duración y Cancelación */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            4. Duración del Contrato y Cancelación
                        </h2>

                        <h3 className="text-xl font-semibold text-gray-800">
                            4.1 Sin Plazo Forzoso
                        </h3>
                        <p className="text-gray-700">
                            El contrato <strong>no tiene plazo forzoso</strong>. El cliente puede cancelar el servicio en
                            cualquier momento simplemente dejando de realizar el pago mensual, lo cual resultará en la
                            rescisión automática del contrato.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            4.2 Cancelación por Nuestra Parte
                        </h3>
                        <p className="text-gray-700">
                            Nos reservamos el derecho de cancelar el servicio en caso de:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>Uso indebido o fraudulento del servicio</li>
                            <li>Violación de estos Términos y Condiciones</li>
                            <li>Actividades ilegales o que violen las políticas de WhatsApp</li>
                        </ul>
                    </div>

                    {/* Disponibilidad del Servicio */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            5. Disponibilidad del Servicio y Limitación de Responsabilidad
                        </h2>

                        <h3 className="text-xl font-semibold text-gray-800">
                            5.1 Dependencia de Servicios de Terceros
                        </h3>
                        <p className="text-gray-700">
                            Nuestro servicio depende de servicios de terceros, específicamente <strong>Google</strong> (para
                            Calendar y API de Gemini) y <strong>WhatsApp</strong> (para la plataforma de mensajería). La
                            disponibilidad de nuestro servicio está sujeta a la disponibilidad de estos servicios
                            externos.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            5.2 Sin Garantía de Disponibilidad
                        </h3>
                        <p className="text-gray-700">
                            <strong>NO garantizamos la disponibilidad continua del servicio</strong> debido a nuestra
                            dependencia de servicios de terceros. En caso de fallos o interrupciones causadas por
                            Google, WhatsApp u otros proveedores externos, quedamos <strong>eximidos de
                                responsabilidad</strong>.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            5.3 Mantenimiento y Actualizaciones
                        </h3>
                        <p className="text-gray-700">
                            Podemos realizar mantenimientos programados que temporalmente afecten la disponibilidad
                            del servicio. Intentaremos notificar con anticipación razonable cuando sea posible.
                        </p>
                    </div>

                    {/* Responsabilidades del Cliente */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            6. Responsabilidades del Cliente
                        </h2>

                        <h3 className="text-xl font-semibold text-gray-800">
                            6.1 Reporte de Fallos
                        </h3>
                        <p className="text-gray-700">
                            El cliente tiene la responsabilidad de <strong>reportar cualquier fallo o problema</strong> con
                            el servicio a través de los canales de soporte establecidos (email en horario de oficina).
                            Una vez reportado, nosotros nos comprometemos a solucionar el problema en el menor tiempo
                            posible.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            6.2 Información Proporcionada a la IA
                        </h3>
                        <p className="text-gray-700">
                            Las respuestas generadas por la Inteligencia Artificial se basarán en la
                            <strong> información proporcionada por el cliente</strong>. Es responsabilidad del cliente
                            asegurar que la información sea precisa, actualizada y apropiada para su negocio.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            6.3 Custodia de Datos de Usuarios Finales
                        </h3>
                        <p className="text-gray-700">
                            El cliente es <strong>responsable de la custodia de la información de sus usuarios
                                finales</strong> (sus propios clientes). Aunque nosotros también tenemos acceso a esta
                            información para proporcionar el servicio, <strong>NO somos responsables de la información
                                capturada de los usuarios finales</strong>. Ambas partes debemos asegurar la protección
                            adecuada de estos datos conforme a las leyes aplicables.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            6.4 Responsabilidad del Número de WhatsApp
                        </h3>
                        <p className="text-gray-700">
                            El número de WhatsApp utilizado para el servicio es <strong>propiedad física del
                                cliente</strong>. El cliente es responsable de:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>Mantener la <strong>calidad del número</strong> conforme a las políticas de WhatsApp</li>
                            <li>Evitar prácticas que puedan resultar en la suspensión o baneo del número</li>
                            <li>
                                Cualquier consecuencia derivada del baneo del número por parte de WhatsApp debido a
                                baja calidad o violación de políticas
                            </li>
                        </ul>
                        <p className="text-gray-700 mt-2">
                            <strong>No somos responsables</strong> si WhatsApp bannea el número del cliente por
                            cuestiones de calidad o incumplimiento de sus políticas.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            6.5 Cumplimiento de Leyes y Regulaciones
                        </h3>
                        <p className="text-gray-700">
                            El cliente es responsable de cumplir con todas las leyes y regulaciones aplicables al
                            uso del servicio, incluyendo pero no limitado a:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>Leyes de protección de datos personales</li>
                            <li>Políticas de WhatsApp para empresas</li>
                            <li>Regulaciones de marketing y comunicaciones comerciales</li>
                        </ul>
                    </div>

                    {/* Limitaciones de Uso */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            7. Limitaciones de Uso del Servicio
                        </h2>

                        <h3 className="text-xl font-semibold text-gray-800">
                            7.1 Límite de Usuarios Nuevos
                        </h3>
                        <p className="text-gray-700">
                            El servicio tiene un límite de <strong>500 usuarios finales nuevos por mes</strong>. Este
                            límite se refiere a nuevos clientes que inician conversación con el bot cada mes.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            7.2 Comportamiento al Alcanzar el Límite
                        </h3>
                        <p className="text-gray-700">
                            Una vez alcanzado el límite de 500 usuarios nuevos en un mes, el bot
                            <strong> dejará de responder automáticamente a nuevos usuarios</strong>. En este caso:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>
                                El cliente tiene la <strong>responsabilidad de dar seguimiento o soporte</strong> a los
                                usuarios adicionales que intenten contactarlo
                            </li>
                            <li>
                                El límite se reinicia al comenzar el siguiente mes (una vez realizado el pago
                                correspondiente)
                            </li>
                        </ul>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            7.3 Protección Anti-Spam
                        </h3>
                        <p className="text-gray-700">
                            Para proteger la calidad del servicio y el número de WhatsApp del cliente:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>
                                Si un usuario final envía <strong>spam</strong> o mensajes abusivos, ese número será
                                <strong> bloqueado automáticamente</strong>
                            </li>
                            <li>
                                Una vez bloqueado, el bot dejará de responder a ese número específico
                            </li>
                            <li>
                                Esta medida protege la reputación del número de WhatsApp y ayuda a mantener su
                                calidad ante WhatsApp
                            </li>
                        </ul>
                    </div>

                    {/* Soporte Técnico */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            8. Soporte Técnico
                        </h2>

                        <h3 className="text-xl font-semibold text-gray-800">
                            8.1 Canal de Soporte
                        </h3>
                        <p className="text-gray-700">
                            El soporte técnico se proporciona <strong>únicamente por email</strong>. Este es el canal
                            oficial para reportar problemas, solicitar asistencia técnica o realizar consultas sobre
                            el servicio.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            8.2 Horario de Atención
                        </h3>
                        <p className="text-gray-700">
                            El soporte técnico está disponible durante <strong>horario de oficina</strong>. Las
                            solicitudes recibidas fuera de este horario serán atendidas el siguiente día hábil.
                        </p>

                        <h3 className="text-xl font-semibold text-gray-800 mt-4">
                            8.3 Tiempo de Respuesta
                        </h3>
                        <p className="text-gray-700">
                            Nos esforzamos por responder a todas las solicitudes de soporte en un plazo razonable,
                            priorizando problemas críticos que afecten la operación del servicio.
                        </p>
                    </div>

                    {/* Periodo de Prueba */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            9. Periodo de Prueba
                        </h2>
                        <p className="text-gray-700">
                            <strong>No ofrecemos periodo de prueba gratuito</strong>. Sin embargo, contamos con una
                            garantía de satisfacción de 30 días como se describe en la Sección 3 de estos Términos.
                        </p>
                    </div>

                    {/* Propiedad Intelectual */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            10. Propiedad Intelectual
                        </h2>
                        <p className="text-gray-700">
                            Todos los derechos de propiedad intelectual sobre el software, código, diseño y
                            funcionalidad del servicio son propiedad de IQISS Mexico. El cliente recibe únicamente
                            una licencia de uso del servicio durante la vigencia del contrato.
                        </p>
                        <p className="text-gray-700">
                            Asimismo, se establece que la metadata generada y recopilada en la prestación de los servicios es propiedad de IQISSMexico. (Agregado el 16 de junio de 2026).
                        </p>
                    </div>

                    {/* Confidencialidad */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            11. Confidencialidad
                        </h2>
                        <p className="text-gray-700">
                            Ambas partes se comprometen a mantener la confidencialidad de la información sensible
                            compartida durante la prestación del servicio. Esto incluye:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
                            <li>Información comercial del cliente</li>
                            <li>Datos de usuarios finales</li>
                            <li>Configuraciones y personalizaciones del servicio</li>
                            <li>Información técnica y de implementación</li>
                        </ul>
                    </div>

                    {/* Modificaciones */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            12. Modificaciones a los Términos
                        </h2>
                        <p className="text-gray-700">
                            Nos reservamos el derecho de modificar estos Términos en cualquier momento. Las
                            modificaciones entrarán en vigor inmediatamente después de su publicación en nuestro
                            sitio web. Es responsabilidad del cliente revisar periódicamente estos Términos.
                        </p>
                        <p className="text-gray-700">
                            Los cambios significativos serán notificados a los clientes activos por email con
                            anticipación razonable.
                        </p>
                    </div>

                    {/* Ley Aplicable */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            13. Legislación Aplicable y Jurisdicción
                        </h2>
                        <p className="text-gray-700">
                            Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier disputa
                            que surja en relación con estos Términos se someterá a la jurisdicción de los tribunales
                            competentes en México.
                        </p>
                    </div>

                    {/* Contacto */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            14. Contacto
                        </h2>
                        <p className="text-gray-700">
                            Para preguntas sobre estos Términos y Condiciones, puede contactarnos a través de los
                            medios disponibles en nuestro sitio web o por email a través de nuestros canales de
                            soporte.
                        </p>
                    </div>

                    {/* Aceptación */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold text-blue-600">
                            15. Aceptación de los Términos
                        </h2>
                        <p className="text-gray-700">
                            Al contratar nuestro servicio y firmar el contrato correspondiente, usted reconoce que
                            ha leído, entendido y aceptado estos Términos y Condiciones de Servicio en su totalidad.
                        </p>
                    </div>
                </div>
            </Section>
        </div>
    );
}
