import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface CredentialData {
  email: string;
  password: string;
  profile_name?: string;
  pin?: string;
}

interface EmailCredentialsParams {
  to: string;
  tenantName: string;
  productName: string;
  credentials: CredentialData[];
  expiresAt: string;
  orderNumber?: string;
  totalPrice?: number;
  discountApplied?: number;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configurar transporter de nodemailer
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log('📧 EmailService initialized with SMTP:', process.env.SMTP_HOST);
  }

  /**
   * Envía email con credenciales después de una compra exitosa
   */
  async sendCredentialsEmail(params: EmailCredentialsParams): Promise<boolean> {
    const {
      to,
      tenantName,
      productName,
      credentials,
      expiresAt,
      orderNumber,
      totalPrice,
      discountApplied,
    } = params;

    try {
      const htmlContent = this.generateCredentialsEmailTemplate(
        tenantName,
        productName,
        credentials,
        expiresAt,
        orderNumber,
        totalPrice,
        discountApplied
      );

      const mailOptions = {
        from: `"Skyplay Mayoristas" <${process.env.SMTP_USER}>`,
        to,
        subject: `✅ Tu compra de ${productName} - Credenciales`,
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email enviado:', info.messageId, 'to:', to);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      return false;
    }
  }

  /**
   * Envía email de renovación de servicio
   */
  async sendRenewalEmail(params: {
    to: string;
    tenantName: string;
    productName: string;
    credentials: CredentialData[];
    expiresAt: string;
    orderNumber?: string;
    totalPrice?: number;
    discountApplied?: number;
  }): Promise<boolean> {
    const {
      to,
      tenantName,
      productName,
      credentials,
      expiresAt,
      orderNumber,
      totalPrice,
      discountApplied,
    } = params;

    try {
      const htmlContent = this.generateRenewalEmailTemplate(
        tenantName,
        productName,
        credentials,
        expiresAt,
        orderNumber,
        totalPrice,
        discountApplied
      );

      const mailOptions = {
        from: `"Skyplay Mayoristas" <${process.env.SMTP_USER}>`,
        to,
        subject: `🔄 Tu servicio ${productName} ha sido renovado`,
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email de renovación enviado:', info.messageId, 'to:', to);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email de renovación:', error);
      return false;
    }
  }

  /**
   * Genera el HTML del email de renovación
   */
  private generateRenewalEmailTemplate(
    tenantName: string,
    productName: string,
    credentials: CredentialData[],
    expiresAt: string,
    orderNumber?: string,
    totalPrice?: number,
    discountApplied?: number
  ): string {
    const credential = credentials[0];
    const expirationDate = new Date(expiresAt).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Renovación de Servicio - Skyplay</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <!-- Logo Skyplay -->
              <div style="margin: 0 auto 20px auto; text-align: center;">
                <div style="color: #ffffff; font-size: 42px; font-weight: bold; line-height: 1; letter-spacing: -1px;">Skyplay</div>
                <div style="color: #d1fae5; font-size: 16px; font-weight: 500; margin-top: 4px; letter-spacing: 2px;">streaming</div>
              </div>
              <h1 style="margin: 20px 0 0 0; color: #ffffff; font-size: 28px; font-weight: bold;">🔄 ¡Renovación Exitosa!</h1>
              <p style="margin: 10px 0 0 0; color: #d1fae5; font-size: 16px;">Tu servicio ha sido renovado por 30 días más</p>
            </td>
          </tr>

          <!-- Renewal Info -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
                Hola <strong>${tenantName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                Tu servicio <strong>${productName}</strong> ha sido renovado exitosamente por 30 días más.
                ${orderNumber ? `<br>Orden de renovación: <strong>#${orderNumber}</strong>` : ''}
                ${totalPrice ? `<br>Monto cobrado: <strong>$${totalPrice.toFixed(2)}</strong>` : ''}
                ${discountApplied && discountApplied > 0 ? `<span style="color: #10b981;"> (${discountApplied}% descuento aplicado)</span>` : ''}
              </p>

              <!-- Expiration Info -->
              <div style="background-color: #ecfdf5; border-radius: 8px; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
                <p style="margin: 0; font-size: 13px; color: #065f46;">
                  ⏰ <strong>Nueva fecha de vencimiento:</strong> ${expirationDate}
                </p>
              </div>
            </td>
          </tr>

          <!-- Credentials Box -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 25px; border: 2px solid #e5e7eb;">
                <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #374151; font-weight: 600;">🔐 Tus Credenciales</h2>
                
                <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                  <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Email</p>
                  <p style="margin: 0 0 15px 0; font-size: 14px; color: #1f2937; font-family: 'Courier New', monospace; word-break: break-all;">${credential.email}</p>
                  
                  <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Contraseña</p>
                  <p style="margin: 0 0 15px 0; font-size: 14px; color: #1f2937; font-family: 'Courier New', monospace; word-break: break-all;">${credential.password}</p>
                  
                  ${credential.profile_name ? `<p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Perfil</p>
                  <p style="margin: 0 0 15px 0; font-size: 14px; color: #1f2937;">${credential.profile_name}</p>` : ''}
                  
                  ${credential.pin ? `<p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">PIN</p>
                  <p style="margin: 0; font-size: 14px; color: #1f2937; font-family: 'Courier New', monospace;">${credential.pin}</p>` : ''}
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 15px 0; font-size: 13px; color: #6b7280;">
                Si tienes alguna pregunta, contáctanos por WhatsApp
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} Skyplay · Catálogo Mayorista
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Genera el HTML del email con las credenciales
   */
  private generateCredentialsEmailTemplate(
    tenantName: string,
    productName: string,
    credentials: CredentialData[],
    expiresAt: string,
    orderNumber?: string,
    totalPrice?: number,
    discountApplied?: number
  ): string {
    const credential = credentials[0]; // Por ahora solo mostramos la primera credencial
    const expirationDate = new Date(expiresAt).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tus Credenciales - Skyplay</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; text-align: center;">
              <!-- Logo Skyplay -->
              <div style="margin: 0 auto 20px auto; text-align: center;">
                <div style="color: #ffffff; font-size: 42px; font-weight: bold; line-height: 1; letter-spacing: -1px;">Skyplay</div>
                <div style="color: #e0f2fe; font-size: 16px; font-weight: 500; margin-top: 4px; letter-spacing: 2px;">streaming</div>
              </div>
              <h1 style="margin: 20px 0 0 0; color: #ffffff; font-size: 28px; font-weight: bold;">✅ ¡Compra Exitosa!</h1>
              <p style="margin: 10px 0 0 0; color: #e0f2fe; font-size: 16px;">Tus credenciales están listas</p>
            </td>
          </tr>

          <!-- Purchase Info -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
                Hola <strong>${tenantName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                Tu compra de <strong>${productName}</strong> ha sido procesada exitosamente.
                ${orderNumber ? `<br>Orden: <strong>#${orderNumber}</strong>` : ''}
                ${totalPrice ? `<br>Monto: <strong>$${totalPrice.toFixed(2)}</strong>` : ''}
                ${discountApplied && discountApplied > 0 ? `<span style="color: #10b981;"> (${discountApplied}% descuento aplicado)</span>` : ''}
              </p>
            </td>
          </tr>

          <!-- Credentials Box -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 25px; border: 2px solid #e5e7eb;">
                <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #374151; font-weight: 600;">🔐 Tus Credenciales</h2>
                
                <!-- Email -->
                <div style="margin-bottom: 15px;">
                  <label style="display: block; font-size: 12px; color: #6b7280; margin-bottom: 5px; font-weight: 500; text-transform: uppercase;">Email / Usuario</label>
                  <div style="background-color: #ffffff; padding: 12px 15px; border-radius: 6px; border: 1px solid #d1d5db; font-family: 'Courier New', monospace; font-size: 14px; color: #1f2937;">
                    ${credential.email}
                  </div>
                </div>

                <!-- Password -->
                <div style="margin-bottom: 15px;">
                  <label style="display: block; font-size: 12px; color: #6b7280; margin-bottom: 5px; font-weight: 500; text-transform: uppercase;">Contraseña</label>
                  <div style="background-color: #ffffff; padding: 12px 15px; border-radius: 6px; border: 1px solid #d1d5db; font-family: 'Courier New', monospace; font-size: 14px; color: #1f2937;">
                    ${credential.password}
                  </div>
                </div>

                ${credential.profile_name ? `
                <!-- Profile -->
                <div style="margin-bottom: 15px;">
                  <label style="display: block; font-size: 12px; color: #6b7280; margin-bottom: 5px; font-weight: 500; text-transform: uppercase;">Perfil</label>
                  <div style="background-color: #ffffff; padding: 12px 15px; border-radius: 6px; border: 1px solid #d1d5db; font-family: 'Courier New', monospace; font-size: 14px; color: #1f2937;">
                    ${credential.profile_name}
                  </div>
                </div>
                ` : ''}

                ${credential.pin ? `
                <!-- PIN -->
                <div style="margin-bottom: 15px;">
                  <label style="display: block; font-size: 12px; color: #6b7280; margin-bottom: 5px; font-weight: 500; text-transform: uppercase;">PIN</label>
                  <div style="background-color: #ffffff; padding: 12px 15px; border-radius: 6px; border: 1px solid #d1d5db; font-family: 'Courier New', monospace; font-size: 14px; color: #1f2937;">
                    ${credential.pin}
                  </div>
                </div>
                ` : ''}

                <!-- Expiration -->
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 13px; color: #6b7280;">
                    ⏰ <strong>Expira el:</strong> ${expirationDate}
                  </p>
                </div>
              </div>
            </td>
          </tr>

          <!-- Info Box -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #eff6ff; border-radius: 6px; padding: 15px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.6;">
                  💡 <strong>Tip:</strong> Guarda este email en un lugar seguro. También puedes ver tus credenciales en cualquier momento desde tu Panel Mayorista.
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 30px 30px; text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/panel" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                Ir a Mi Panel Mayorista
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #6b7280;">
                © ${new Date().getFullYear()} Skyplay · Catálogo Mayorista
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Si tienes alguna pregunta, contáctanos por WhatsApp o tu Panel Mayorista.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Test de conexión SMTP
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified');
      return true;
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
      return false;
    }
  }
}
