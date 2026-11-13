import Link from "next/link";
import { Building2, ExternalLink, Info, Lock, ShieldCheck } from "lucide-react";
import pkg from "../../../package.json";

interface AboutPrivacyContentProps {
  showBackToLogin?: boolean;
}

export function AboutPrivacyContent({
  showBackToLogin = false,
}: AboutPrivacyContentProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[#4f46e5]">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1e1b4b]">
                Checador Facial — Aviso de Privacidad y Seguridad
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Desarrollado por{" "}
                <strong className="text-slate-900">IQISSMexico (IQMX)</strong> ·
                Año 2026 · Versión{" "}
                <span className="font-mono font-semibold text-[#4f46e5]">
                  v{pkg.version}
                </span>
              </p>
            </div>
          </div>

          <a
            href="https://iqissmexico.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            iqissmexico.com
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {showBackToLogin && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4 text-xs">
            <Link
              href="/login"
              className="font-semibold text-[#4f46e5] hover:underline"
            >
              Ir al acceso administrativo
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/kiosk"
              className="font-semibold text-slate-600 hover:text-slate-900 hover:underline"
            >
              Volver al Quiosco
            </Link>
          </div>
        )}
      </div>

      {/* Marco Normativo y Tratamiento Biométrico */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-[#1e1b4b]">
            Marco Normativo y Tratamiento de Datos Biométricos (LFPDPPP)
          </h2>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            De conformidad con la{" "}
            <strong className="text-slate-800">
              Ley Federal de Protección de Datos Personales en Posesión de los
              Particulares (LFPDPPP)
            </strong>{" "}
            y su Reglamento (incluyendo las disposiciones aplicables a datos
            personales sensibles y biométricos), la empresa contratante del
            servicio actúa como{" "}
            <strong className="text-slate-800">Responsable</strong> del
            tratamiento de los datos laborales de sus colaboradores, mientras
            que{" "}
            <strong className="text-slate-800">IQISSMexico (IQMX)</strong>{" "}
            actúa como proveedor tecnológico bajo principios de licitud,
            consentimiento, información, finalidad, proporcionalidad y
            responsabilidad.
          </p>

          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Finalidad exclusiva:</strong> Verificación de identidad
              para el registro de entradas, salidas, pausas de comida y cálculo
              de cumplimiento de jornada laboral. Queda prohibido cualquier uso
              comercial, publicitario o ajeno a la relación laboral.
            </li>
            <li>
              <strong>Representación matemática irreversible:</strong> El
              enrolamiento genera vectores biométricos numéricos de 512
              dimensiones en la terminal autorizada, sin almacenar fotografías
              originales de alta resolución como plantilla maestra.
            </li>
            <li>
              <strong>Retención acotada y evidencias:</strong> En el plan Básico,
              las miniaturas de auditoría local permanecen exclusivamente en la
              terminal por un máximo de 15 días. En planes con respaldo en la
              nube activo, se resguardan en almacenamiento privado aislado por
              organización.
            </li>
            <li>
              <strong>Derechos ARCO y eliminación:</strong> El colaborador puede
              ejercer sus derechos de Acceso, Rectificación, Cancelación y
              Oposición (ARCO) directamente ante el área de Recursos Humanos o
              Administrador de su empresa, o escribir a{" "}
              <a
                href="mailto:privacidad@iqissmexico.com"
                className="font-semibold text-[#4f46e5] hover:underline"
              >
                privacidad@iqissmexico.com
              </a>
              .
            </li>
          </ul>
        </div>
      </div>

      {/* Normas y Controles Técnicos de Seguridad */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-[#4f46e5]" />
          <h2 className="text-lg font-bold text-[#1e1b4b]">
            Normas y Controles Técnicos de Seguridad de la Plataforma
          </h2>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            Para proteger la confidencialidad, integridad y disponibilidad de la
            información laboral y biométrica,{" "}
            <strong className="text-slate-800">Checador Facial</strong> aplica
            controles técnicos alineados a buenas prácticas de seguridad de la
            información (ISO/IEC 27001, OWASP ASVS y estándares criptográficos
            vigentes):
          </p>

          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Aislamiento multi-inquilino estricto:</strong> Cada
              organización opera en un perímetro lógico independiente; todas las
              consultas, reportes, sesiones y terminales están vinculadas y
              validadas por organización.
            </li>
            <li>
              <strong>Cifrado en tránsito y credenciales protegidas:</strong>{" "}
              Las comunicaciones entre el panel, las terminales quiosco y el
              servidor viajan cifradas mediante HTTPS/TLS. Las contraseñas de
              acceso se resguardan con algoritmos de hash criptográfico con sal
              única, y el PIN de auditoría local se valida mediante SHA-256 con
              sal por organización.
            </li>
            <li>
              <strong>Prueba de vida anti-suplantación en dispositivo:</strong>{" "}
              El motor biométrico local valida detección facial y vida antes de
              registrar cualquier asistencia, evitando intentos con fotografías,
              videos o pantallas.
            </li>
            <li>
              <strong>Revocación inmediata y purga por baja:</strong> Al
              desvincular o eliminar una terminal desde el panel, su token de
              sesión se invalida al instante y el dispositivo purga su caché
              local. Al dar de baja a un colaborador, sus vectores biométricos se
              eliminan en la siguiente sincronización.
            </li>
            <li>
              <strong>Trazabilidad de auditoría:</strong> Las acciones
              administrativas críticas (altas, bajas, cambios de contraseña,
              vinculación y desvinculación de terminales) quedan registradas en
              bitácora de auditoría.
            </li>
          </ul>
        </div>
      </div>

      {/* Responsabilidades de la Empresa Contratante */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Building2 className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-bold text-[#1e1b4b]">
            Obligaciones de la Empresa Contratante (Responsable del Tratamiento)
          </h2>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            La seguridad integral de los datos es una responsabilidad
            compartida. Para garantizar el cumplimiento legal y operativo, la
            empresa contratante debe cubrir los siguientes puntos:
          </p>

          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Consentimiento expreso y aviso laboral interno:</strong>{" "}
              Poner a disposición de sus colaboradores su propio Aviso de
              Privacidad laboral y recabar su consentimiento expreso (por
              escrito o medio verificable) previo al enrolamiento biométrico,
              conforme al artículo 9 de la LFPDPPP.
            </li>
            <li>
              <strong>Mecanismo alternativo de registro:</strong> Habilitar una
              opción no biométrica (por ejemplo, registro supervisado por RH)
              para cualquier colaborador que decida no otorgar su consentimiento
              o ejerza su derecho de oposición.
            </li>
            <li>
              <strong>Resguardo físico y operativo de terminales:</strong>{" "}
              Instalar los dispositivos quiosco en áreas supervisadas, mantener
              el sistema operativo actualizado con bloqueo de pantalla y
              desvincular de inmediato cualquier equipo extraviado, dañado o
              reemplazado.
            </li>
            <li>
              <strong>Higiene de accesos y PIN de auditoría:</strong> Asignar
              cuentas individuales a cada asistente (sin compartir contraseñas),
              sustituir la contraseña temporal en el primer ingreso y configurar
              un PIN de auditoría local robusto compartido únicamente con
              personal autorizado.
            </li>
            <li>
              <strong>Bajas oportunas y atención ARCO:</strong> Registrar en el
              panel la baja de personal de forma oportuna para activar la purga
              biométrica en terminales y atender dentro de los plazos legales las
              solicitudes ARCO de sus colaboradores.
            </li>
          </ul>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
            El acceso, enrolamiento y uso continuo de{" "}
            <strong>Checador Facial</strong> implica la aceptación expresa
            de este Aviso de Privacidad y de los Términos de Uso aplicables de{" "}
            <strong>IQISSMexico (IQMX)</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}
