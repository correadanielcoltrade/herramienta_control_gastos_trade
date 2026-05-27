import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


class EmailService:
    @staticmethod
    def send_password_reset_email(recipient_email: str, reset_link: str, user_name: str) -> bool:
        """Envía email de recuperación de contraseña"""
        try:
            # Crear mensaje
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Recuperación de Contraseña - MKP Serial Control"
            msg["From"] = settings.mail_from
            msg["To"] = recipient_email

            # HTML del email
            html = f"""
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
                      <a href="{reset_link}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                        Recuperar Contraseña
                      </a>
                    </div>

                    <p style="font-size: 12px; color: #666;">
                      O copia y pega este enlace en tu navegador:<br>
                      <code style="background: #f0f0f0; padding: 5px; border-radius: 3px; word-break: break-all;">{reset_link}</code>
                    </p>

                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

                    <p style="font-size: 12px; color: #999;">
                      Si tienes problemas, contacta al soporte técnico.<br>
                      <strong>Por seguridad, nunca compartamos tu contraseña por correo.</strong>
                    </p>
                  </div>
                </div>
              </body>
            </html>
            """

            # Agregar contenido
            msg.attach(MIMEText(html, "html"))

            # Conectar y enviar (con timeout para evitar bloqueos en producción)
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
            print(f"Error enviando email: {e}")
            return False
