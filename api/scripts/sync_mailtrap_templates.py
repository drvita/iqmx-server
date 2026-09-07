#!/usr/bin/env python3
"""
Sincronizador y Generador Centralizado de Plantillas de Correo para Mailtrap API.

Garantiza la estandarización visual de marca (IQISSMexico):
- Header navy institucional (#0f2a4a) con logo sobre contenedor blanco
- Tarjeta central blanca con bordes redondeados y tipografía accesible
- Botones de acción CTA y cajas de alerta contextuales (informativa, preventiva, urgente, suspensión)
- Footer corporativo con datos de soporte

Uso:
  python scripts/sync_mailtrap_templates.py [--dry-run]
"""

import os
import sys
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List

# Constantes de configuración
LOGO_URL = "https://iqissmexico.com/logo.png"
SUPPORT_EMAIL = "soporte@iqissmexico.com"
COMPANY_NAME = "IQISSMexico"

def build_email_html(
    title: str,
    headline: str,
    body_paragraphs: List[str],
    cta_text: str,
    cta_url_var: str,
    alert_box: Dict[str, str] = None,
    feedback_box: Dict[str, str] = None,
    warning_text: str = None
) -> str:
    """
    Genera el HTML estandarizado para correos de IQISSMexico.
    """
    paragraphs_html = "".join([
        f'<p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.7; color: #4a5568;">{p}</p>'
        for p in body_paragraphs
    ])

    alert_box_html = ""
    if alert_box:
        bg = alert_box.get("bg", "#f0f4f8")
        border = alert_box.get("border", "#d2dce6")
        text_color = alert_box.get("text_color", "#0f2a4a")
        content = alert_box.get("content", "")
        alert_box_html = f"""
        <div style="background-color: {bg}; border-radius: 10px; padding: 16px 20px; border: 1px solid {border}; margin: 20px 0 28px 0; color: {text_color}; font-size: 13px; line-height: 1.6;">
          {content}
        </div>
        """

    feedback_box_html = ""
    if feedback_box:
        f_title = feedback_box.get("title", "¿Podemos mejorar en algo?")
        f_msg = feedback_box.get("message", "")
        f_cta = feedback_box.get("cta_text", "Escribirnos por WhatsApp")
        f_url = feedback_box.get("cta_url_var", "{{whatsapp_feedback_url}}")
        feedback_box_html = f"""
        <div style="background-color: #f0fdf4; border-radius: 12px; padding: 22px 20px; border: 1px solid #bbf7d0; margin: 28px 0 24px 0; text-align: center;">
          <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #166534;">
            {f_title}
          </p>
          <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #15803d;">
            {f_msg}
          </p>
          <a href="{f_url}" target="_blank" style="display: inline-block; background-color: #25d366; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 3px 10px rgba(37, 211, 102, 0.25);">
            {f_cta} &rarr;
          </a>
        </div>
        """

    warning_html = ""
    if warning_text:
        warning_html = f"""
        <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #718096; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          {warning_text}
        </p>
        """

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a2332;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0f4f8; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(15, 42, 74, 0.08); border: 1px solid #d2dce6;">
          
          <!-- Encabezado con Logo -->
          <tr>
            <td style="padding: 28px 40px 20px 40px; text-align: center; background-color: #0f2a4a;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #ffffff; border-radius: 12px; padding: 12px 24px;">
                    <img src="{LOGO_URL}" alt="IQISSMexico" width="160" style="display: block; max-width: 160px; height: auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding: 36px 40px 32px 40px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0f2a4a; line-height: 1.3;">
                {headline}
              </h1>
              
              {paragraphs_html}

              {alert_box_html}

              <!-- Botón de Acción Principal -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0 28px 0;">
                <tr>
                  <td align="center">
                    <a href="{cta_url_var}" target="_blank" style="display: inline-block; background-color: #0f2a4a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(15, 42, 74, 0.30); letter-spacing: 0.3px;">
                      {cta_text} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Enlace alternativo en texto plano -->
              <div style="background-color: #f8fafc; border-radius: 10px; padding: 14px 18px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
                <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b; font-weight: 600;">
                  Si no puedes hacer clic en el botón, copia y abre este enlace:
                </p>
                <p style="margin: 0; font-size: 11px; word-break: break-all; color: #1e3a5f; font-family: monospace;">
                  {cta_url_var}
                </p>
              </div>

              {feedback_box_html}

              {warning_html}
            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f2a4a; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">
                ¿Necesitas asistencia? Escríbenos a <a href="mailto:{SUPPORT_EMAIL}" style="color: #60a5fa; text-decoration: none; font-weight: 600;">{SUPPORT_EMAIL}</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                &copy; {COMPANY_NAME}. Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# Catálogo oficial de plantillas del ciclo de vida
TEMPLATES_CATALOG = [
    {
        "key": "MAILTRAP_TEMPLATE_WELCOME",
        "name": "Bienvenida y Verificación de Cuenta",
        "subject": "¡Bienvenido a IQISSMexico, {{user_name}}! Confirma tu correo",
        "category": "onboarding",
        "title": "Bienvenido a IQISSMexico",
        "headline": "¡Bienvenido a bordo, {{user_name}}!",
        "paragraphs": [
            "Nos entusiasma darte la bienvenida y acompañar a <strong>{{company}}</strong> en la gestión de sus comunicaciones y soluciones tecnológicas con IQISSMexico.",
            "Para garantizar la seguridad de tu cuenta y activar el acceso a todos los servicios del portal, por favor confirma tu dirección de correo electrónico haciendo clic en el siguiente botón:"
        ],
        "cta_text": "Confirmar mi Correo Electrónico",
        "cta_url_var": "{{verification_url}}",
        "alert_box": None,
        "feedback_box": None,
        "warning_text": "🔒 <strong>Aviso de seguridad:</strong> Si no reconoces este registro o no solicitaste una cuenta en IQISSMexico, puedes ignorar este mensaje de forma segura. Ninguna cuenta será activada sin tu confirmación."
    },
    {
        "key": "MAILTRAP_TEMPLATE_PAYMENT_FAILED",
        "name": "Aviso Urgente: Fallo en Cobro de Membresía",
        "subject": "⚠️ Problema con el cobro de tu membresía de IQISSMexico - {{company}}",
        "category": "billing",
        "title": "Fallo en Cobro Recurrente",
        "headline": "No pudimos procesar tu pago de renovación",
        "paragraphs": [
            "Hola <strong>{{user_name}}</strong>, intentamos procesar el cargo automático correspondiente a la membresía de <strong>{{company}}</strong> para el plan <strong>{{plan_name}}</strong>, pero tu institución bancaria no autorizó la transacción.",
            "Para evitar la interrupción de tus flujos de WhatsApp y suspender el acceso a tu CRM, por favor actualiza tu método de pago o liquida el importe pendiente a la brevedad."
        ],
        "cta_text": "Actualizar Tarjeta o Pagar Ahora",
        "cta_url_var": "{{update_payment_url}}",
        "alert_box": {
            "bg": "#fff1f2",
            "border": "#fecdd3",
            "text_color": "#9f1239",
            "content": "⚠️ <strong>Servicio activo temporalmente:</strong> Cuentas con un periodo de gracia para actualizar tu método de pago antes de pausar la atención automatizada."
        },
        "feedback_box": None,
        "warning_text": "Si ya actualizaste tus datos bancarios en las últimas horas o requieres pagar por transferencia SPEI, contáctanos en soporte."
    },
    {
        "key": "MAILTRAP_TEMPLATE_CANCELLED_EXPIRING",
        "name": "Aviso de Suscripción Cancelada Próxima a Vencer (-3 Días)",
        "subject": "Tu servicio de IQISSMexico finalizará en 3 días - {{company}}",
        "category": "billing",
        "title": "Aviso de Finalización de Servicio",
        "headline": "Tu servicio finalizará próximamente",
        "paragraphs": [
            "Hola <strong>{{user_name}}</strong>, te recordamos que la suscripción de <strong>{{company}}</strong> ({{plan_name}}) fue cancelada previamente y tu periodo contratado concluye el día <strong>{{expiry_date}}</strong>.",
            "Al llegar esta fecha, la atención automatizada del chatbot de WhatsApp y el acceso a las funciones del CRM serán pausados para no generar cargos.",
            "Si deseas continuar disfrutando de la plataforma, puedes reactivar tu membresía en cualquier momento sin perder tus datos ni tus configuraciones."
        ],
        "cta_text": "Reactivar mi Suscripción",
        "cta_url_var": "{{reactivation_url}}",
        "alert_box": {
            "bg": "#fffbeb",
            "border": "#fde68a",
            "text_color": "#92400e",
            "content": "📅 <strong>Fecha límite de operación:</strong> {{expiry_date}} a las 23:59 CST.<br>Reactivando antes de esta fecha evitarás cualquier corte con tus clientes y pacientes."
        },
        "feedback_box": None,
        "warning_text": "Si cancelaste por error o requieres una propuesta personalizada para tu negocio, escríbenos a soporte@iqissmexico.com."
    },
    {
        "key": "MAILTRAP_TEMPLATE_TRIAL_EXPIRING",
        "name": "Finalización de Prueba Gratuita (-24 Horas)",
        "subject": "Tu prueba gratuita de IQISSMexico concluye mañana - {{company}}",
        "category": "onboarding",
        "title": "Periodo de Prueba por Concluir",
        "headline": "Tu prueba gratuita está por finalizar",
        "paragraphs": [
            "Estimado(a) <strong>{{user_name}}</strong>, esperamos que la experiencia de <strong>{{company}}</strong> con nuestro asistente de IA y CRM haya sido de gran provecho.",
            "Te recordamos que tu prueba gratuita concluye el día de mañana <strong>{{expiry_date}}</strong>. Para mantener tus líneas de WhatsApp conectadas y seguir atendiendo a tus clientes sin interrupción, te invitamos a elegir el plan que mejor se adapte a tu operación."
        ],
        "cta_text": "Elegir mi Plan y Continuar",
        "cta_url_var": "{{plans_url}}",
        "alert_box": {
            "bg": "#eff6ff",
            "border": "#bfdbfe",
            "text_color": "#1e40af",
            "content": "✨ <strong>Tus avances se conservan:</strong> Toda tu configuración, historial de conversaciones y números vinculados durante la prueba permanecerán intactos al contratar tu membresía."
        },
        "feedback_box": None,
        "warning_text": "Consulta los planes disponibles en nuestro portal para activar tu membresía oficial."
    },
    {
        "key": "MAILTRAP_TEMPLATE_EXPIRED",
        "name": "Notificación de Suspensión del Servicio y Feedback",
        "subject": "Tu servicio de IQISSMexico ha finalizado - {{company}}",
        "category": "billing",
        "title": "Servicio Pausado",
        "headline": "Tu servicio ha finalizado",
        "paragraphs": [
            "Hola <strong>{{user_name}}</strong>, te informamos que el periodo de servicio para <strong>{{company}}</strong> correspondiente al plan <strong>{{plan_name}}</strong> ha finalizado el día de hoy.",
            "Tus números de WhatsApp, el historial de conversaciones y las configuraciones de tu asistente IA se encuentran <strong>completamente respaldados y seguros</strong>. Sin embargo, las respuestas automáticas y el acceso al CRM han sido temporalmente pausados."
        ],
        "cta_text": "Reactivar mi Servicio Ahora",
        "cta_url_var": "{{reactivation_url}}",
        "alert_box": {
            "bg": "#f1f5f9",
            "border": "#cbd5e1",
            "text_color": "#334155",
            "content": "🔒 <strong>Tus datos están protegidos:</strong> Tu cuenta no ha sido eliminada. Al completar el pago, tu chatbot y el CRM volverán a operar de inmediato."
        },
        "feedback_box": {
            "title": "💬 ¿Podemos mejorar en algo?",
            "message": "Nos gustaría mucho conocer tu experiencia. ¿Hubo algún motivo en particular por el cual decidiste no renovar? Tu opinión nos ayuda directamente a mejorar y ofrecer una mejor solución.",
            "cta_text": "Cuéntanos por WhatsApp",
            "cta_url_var": "{{whatsapp_feedback_url}}"
        },
        "warning_text": "Si requieres conservar tus datos por un periodo extendido o necesitas un plan especial, ponte en contacto con nosotros."
    }
]


def sync_templates(account_id: str, api_token: str, dry_run: bool = False):
    """
    Registra o actualiza de forma idempotente las plantillas en la cuenta de Mailtrap.
    """
    print(f"🚀 Iniciando sincronización de plantillas en Mailtrap (Account ID: {account_id})...")

    # 1. Obtener plantillas existentes
    existing_templates_by_name = {}
    if not dry_run:
        list_url = f"https://mailtrap.io/api/accounts/{account_id}/email_templates"
        list_req = urllib.request.Request(list_url, headers={"Api-Token": api_token})
        try:
            with urllib.request.urlopen(list_req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for t in data:
                    existing_templates_by_name[t.get("name")] = t
            print(f"  ℹ️ {len(existing_templates_by_name)} plantillas existentes encontradas en Mailtrap.")
        except Exception as e:
            print(f"  ⚠️ No se pudo consultar la lista de plantillas existentes: {e}")

    results = {}
    for tpl in TEMPLATES_CATALOG:
        html_body = build_email_html(
            title=tpl["title"],
            headline=tpl["headline"],
            body_paragraphs=tpl["paragraphs"],
            cta_text=tpl["cta_text"],
            cta_url_var=tpl["cta_url_var"],
            alert_box=tpl["alert_box"],
            feedback_box=tpl.get("feedback_box"),
            warning_text=tpl["warning_text"]
        )

        fb_text = ""
        if tpl.get("feedback_box"):
            fb = tpl["feedback_box"]
            fb_text = f"\n\n{fb['title']}\n{fb['message']}\nWhatsApp: {fb['cta_url_var']}"

        payload = {
            "email_template": {
                "name": tpl["name"],
                "subject": tpl["subject"],
                "category": tpl["category"],
                "body_html": html_body,
                "body_text": tpl["headline"] + "\n\n" + "\n".join(tpl["paragraphs"]) + fb_text
            }
        }

        if dry_run:
            print(f"  [DRY RUN] Preparada plantilla '{tpl['name']}' ({tpl['key']})")
            continue

        existing = existing_templates_by_name.get(tpl["name"])
        data_bytes = json.dumps(payload).encode("utf-8")

        if existing:
            # PATCH
            url = f"https://mailtrap.io/api/accounts/{account_id}/email_templates/{existing['id']}"
            method = "PATCH"
            action_name = "Actualizada"
        else:
            # POST
            url = f"https://mailtrap.io/api/accounts/{account_id}/email_templates"
            method = "POST"
            action_name = "Creada"

        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={
                "Api-Token": api_token,
                "Content-Type": "application/json"
            },
            method=method
        )

        try:
            with urllib.request.urlopen(req) as resp:
                res_json = json.loads(resp.read().decode("utf-8"))
                uuid = res_json.get("uuid")
                template_id = res_json.get("id")
                results[tpl["key"]] = {"uuid": uuid, "id": template_id, "name": tpl["name"]}
                print(f"  ✅ {action_name}: '{tpl['name']}' -> UUID: {uuid} (ID: {template_id})")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            print(f"  ⚠️ Error HTTP {e.code} en '{tpl['name']}': {err_body}")
        except Exception as e:
            print(f"  ❌ Excepción en '{tpl['name']}': {e}")

    return results


if __name__ == "__main__":
    is_dry_run = "--dry-run" in sys.argv
    account = os.environ.get("MAILTRAP_ACCOUNT_ID", "1525192")
    token = os.environ.get("MAILTRAP_TEMPLATE_API_TOKEN", "ab6ebf80d99accaa0c92b5c09c7a212e")

    results = sync_templates(account_id=account, api_token=token, dry_run=is_dry_run)
    print("\n--- RESUMEN DE UUIDs ---")
    for k, v in results.items():
        print(f"{k}={v['uuid']}")
