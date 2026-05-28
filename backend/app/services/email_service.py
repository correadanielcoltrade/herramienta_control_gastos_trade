import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests

from app.core.config import settings


def _build_reset_html(user_name: str, reset_link: str) -> str:
    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">MKP Serial Control</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;">
            <p>Hola <strong>{user_name}</strong>,</p>

            <p>Recibimos una solicitud para recuperar tu contraseña. Si no fuiste tú, ignora este correo.</p>

            <p>Para establecer una nueva contraseña, haz clic en el botón de abajo. <strong>Este enlace es válido por 30 minutos.</strong></p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="{reset_link}" target="_blank" rel="noopener noreferrer" style="background-color: #667eea; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; mso-padding-alt: 0; border: 1px solid #667eea;">
                <!--[if mso]>
                <i style="letter-spacing: 32px; mso-font-width: -100%; mso-text-raise: 24pt;">&nbsp;</i>
                <![endif]-->
                <span style="mso-text-raise: 12pt; color: #ffffff;">Recuperar Contraseña</span>
                <!--[if mso]>
                <i style="letter-spacing: 32px; mso-font-width: -100%;">&nbsp;</i>
                <![endif]-->
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

            <p style="font-size: 12px; color: #999;">
              Si tienes problemas, contacta al soporte técnico.<br>
              <strong>Por seguridad, nunca compartas tu contraseña por correo.</strong>
            </p>
          </div>
        </div>
      </body>
    </html>
    """


def _send_via_smtp(recipient_email: str, subject: str, html: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.mail_from
        msg["To"] = recipient_email
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(
            settings.mail_server,
            settings.mail_port,
            timeout=settings.mail_timeout_seconds,
        ) as server:
            server.starttls()
            server.login(settings.mail_username, settings.mail_password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Error enviando email (SMTP): {e}")
        return False


def _send_via_brevo(recipient_email: str, subject: str, html: str) -> bool:
    if not settings.brevo_api_key:
        print("Error enviando email (Brevo): BREVO_API_KEY no configurada")
        return False
    try:
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": settings.brevo_api_key,
                "Content-Type": "application/json",
                "accept": "application/json",
            },
            json={
                "sender": {"name": settings.mail_from_name, "email": settings.mail_from},
                "to": [{"email": recipient_email}],
                "subject": subject,
                "htmlContent": html,
            },
            timeout=settings.mail_timeout_seconds,
        )
        if response.status_code >= 400:
            print(f"Error enviando email (Brevo): {response.status_code} {response.text}")
            return False
        return True
    except Exception as e:
        print(f"Error enviando email (Brevo): {e}")
        return False


def _build_welcome_html(user_name: str, correo: str, password: str, login_link: str) -> str:
    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">MKP Serial Control</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;">
            <p>Hola <strong>{user_name}</strong>,</p>

            <p>Se ha creado tu usuario en la <strong>Herramienta de Control de Gastos Trade</strong>. Estos son tus datos de acceso:</p>

            <table style="width: 100%; background: #ffffff; border: 1px solid #ddd; border-radius: 6px; padding: 16px; margin: 20px 0;">
              <tr>
                <td style="padding: 6px 0;"><strong>Usuario / correo:</strong></td>
                <td style="padding: 6px 0;">{correo}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0;"><strong>Contraseña temporal:</strong></td>
                <td style="padding: 6px 0;"><code style="background: #f0f0f0; padding: 4px 8px; border-radius: 3px;">{password}</code></td>
              </tr>
            </table>

            <p>Por seguridad, te recomendamos cambiar la contraseña la primera vez que ingreses.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="{login_link}" target="_blank" rel="noopener noreferrer" style="background-color: #667eea; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; border: 1px solid #667eea;">
                <span style="color: #ffffff;">Ingresar a la herramienta</span>
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

            <p style="font-size: 12px; color: #999;">
              Si tienes problemas para ingresar, contacta al soporte técnico.<br>
              <strong>Por seguridad, nunca compartas tu contraseña por correo.</strong>
            </p>
          </div>
        </div>
      </body>
    </html>
    """


class EmailService:
    @staticmethod
    def send_password_reset_email(recipient_email: str, reset_link: str, user_name: str) -> bool:
        subject = "Recuperación de Contraseña - MKP Serial Control"
        html = _build_reset_html(user_name, reset_link)
        return EmailService._dispatch(recipient_email, subject, html)

    @staticmethod
    def send_welcome_email(
        recipient_email: str, user_name: str, password: str, login_link: str
    ) -> bool:
        subject = "Bienvenido a la Herramienta de Control de Gastos Trade"
        html = _build_welcome_html(user_name, recipient_email, password, login_link)
        return EmailService._dispatch(recipient_email, subject, html)

    @staticmethod
    def _dispatch(recipient_email: str, subject: str, html: str) -> bool:
        provider = (settings.email_provider or "smtp").lower()
        if provider == "brevo":
            return _send_via_brevo(recipient_email, subject, html)
        return _send_via_smtp(recipient_email, subject, html)
