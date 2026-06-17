import Section from '@/components/Section';
import Link from 'next/link';

export const metadata = {
  title: 'Eliminación de Cuenta - IQISSMexico',
  description: 'Instrucciones y políticas sobre el proceso de solicitud de eliminación de cuentas y datos en IQISSMexico.',
};

export default function EliminacionCuenta() {
  return (
    <div className="flex flex-col min-h-screen">
      <Section title="Proceso de Eliminación de Cuentas y Datos" className="bg-white">
        <div className="max-w-4xl mx-auto text-left space-y-6">
          {/* Fecha de actualización */}
          <p className="text-sm text-gray-500 italic">
            Última actualización: 16 de junio de 2026
          </p>

          {/* Introducción */}
          <div className="space-y-4">
            <p className="text-gray-700">
              En IQISSMexico valoramos tu privacidad y el control sobre tus datos personales. A continuación, se detalla el proceso oficial y los términos para solicitar la eliminación definitiva de tu cuenta y los datos asociados a nuestro servicio de automatización.
            </p>
          </div>

          {/* Pasos del Proceso */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-blue-600">
              Proceso de Solicitud de Eliminación
            </h2>
            
            <div className="border-l-4 border-blue-500 pl-4 py-2 space-y-3">
              <h3 className="text-lg font-bold text-gray-800">
                Paso 1: Solicitud Inicial vía Correo Electrónico
              </h3>
              <p className="text-gray-700">
                Para iniciar la solicitud de eliminación de tu cuenta, debes enviar un correo electrónico a la dirección de soporte oficial:
              </p>
              <p className="font-semibold text-gray-900 bg-gray-100 p-2.5 rounded-md inline-block">
                chava.galindo.82@gmail.com
              </p>
              <p className="text-gray-700 font-semibold text-amber-700">
                Importante: Debes proporcionar obligatoriamente en tu correo el número de teléfono vinculado a tu cuenta para el proceso de validación.
              </p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4 py-2 space-y-2">
              <h3 className="text-lg font-bold text-gray-800">
                Paso 2: Validación vía WhatsApp
              </h3>
              <p className="text-gray-700">
                Una vez recibida la solicitud por correo electrónico, nuestro bot automatizado se pondrá en contacto con el número de teléfono proporcionado a través de la plataforma <strong>WhatsApp</strong> para confirmar tu identidad y el deseo de proceder con la eliminación.
              </p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4 py-2 space-y-2">
              <h3 className="text-lg font-bold text-gray-800">
                Paso 3: Confirmación y Tiempos de Procesamiento
              </h3>
              <p className="text-gray-700">
                Al aceptar la solicitud de eliminación mediante la conversación con el bot, comenzará formalmente el proceso de eliminación. Este proceso de baja puede llevar de <strong>1 a 72 horas</strong> para procesarse por completo en nuestros sistemas.
              </p>
            </div>
          </div>

          {/* Datos que se Eliminan */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-blue-600">
              Datos Eliminados y Retenidos
            </h2>
            <p className="text-gray-700">
              Una vez procesada la solicitud, el sistema procederá con las siguientes acciones:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
              <li>
                <strong>Registro de la Cuenta:</strong> Se eliminará de manera permanente el registro de tu usuario y cuenta de nuestra base de datos.
              </li>
              <li>
                <strong>Mensajes Almacenados:</strong> Todos los mensajes e historiales de conversaciones vinculados a tu cuenta serán purgados de forma definitiva.
              </li>
              <li>
                <strong>Metadata:</strong> Toda la metadata del servicio generada durante la prestación del mismo, como se establece en los <Link href="/terminos" className="text-blue-600 hover:underline">Términos y Condiciones</Link>, es propiedad de IQISSMexico y no será objeto de eliminación.
              </li>
            </ul>
          </div>

          {/* Preguntas Adicionales */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <p className="text-gray-700">
              Si tienes alguna duda sobre el tratamiento de tus datos o este proceso de baja, puedes consultar nuestro <Link href="/privacidad" className="text-blue-600 hover:underline">Aviso de Privacidad</Link> o contactar directamente a nuestros canales de soporte.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
