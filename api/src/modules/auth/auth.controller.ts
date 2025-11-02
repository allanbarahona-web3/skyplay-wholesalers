// src/modules/auth/auth.controller.ts
import { Controller, Get, Post, Body, Res, Req, HttpException, Inject, RawBodyRequest } from '@nestjs/common';
import { Response, Request } from 'express';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { EmailService } from '../email/email.service';


type JWTPayload = { id: number; tenant_id: number|null; role: string };

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('PG_POOL') private readonly pg: Pool,
    private readonly emailService: EmailService
  ) {}
  
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  private generateCredentials(productName: string): { email: string; password: string } {
    // Generar credenciales temporales
    // En producción, esto debería obtener credenciales reales de un pool
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return {
      email: `user_${randomSuffix}@temp.skyplay.com`,
      password: `temp_${randomSuffix}`
    };
  }

  @Post('login-otp')
  async login(@Body() body: any, @Res() res: Response) {
    const { email, password, otp } = body || {};
    
    if (!email || !password || !otp) {
      throw new HttpException('Email, password y OTP son requeridos', 400);
    }

    // Buscar usuario
    const q = `SELECT id, email, password_hash, totp_secret, totp_enabled, tenant_id, role, is_active FROM users WHERE email = $1 LIMIT 1`;
    const { rows } = await this.pg.query(q, [email]);
    const u = rows[0];

    if (!u || u.is_active === false) {
      throw new HttpException('Usuario no encontrado o inactivo', 401);
    }

    // Validar password
    const isValidPassword = await bcrypt.compare(password, u.password_hash);
    if (!isValidPassword) {
      throw new HttpException('Credenciales inválidas', 401);
    }

    // Validar TOTP
    if (!u.totp_secret) {
      throw new HttpException('Debes configurar Google Authenticator primero', 401);
    }

    const { authenticator } = await import('otplib');
    const isValidOtp = authenticator.verify({ token: otp, secret: u.totp_secret });
    
    if (!isValidOtp) {
      throw new HttpException('Código TOTP inválido o expirado', 401);
    }

    // Activar TOTP si es la primera vez que lo usa correctamente
    if (!u.totp_enabled) {
      await this.pg.query('UPDATE users SET totp_enabled = true WHERE id = $1', [u.id]);
    }

    // Generar JWT
    const payload: JWTPayload = { 
      id: Number(u.id), 
      tenant_id: u.tenant_id ?? null, 
      role: u.role 
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });

    // Setear cookie
    res.cookie(process.env.SESSION_COOKIE_NAME || 'sky_sid', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ 
      ok: true, 
      user: { 
        id: u.id, 
        email: u.email, 
        tenant_id: u.tenant_id, 
        role: u.role 
      } 
    });
  }

  @Post('setup-totp')
  async setupTotp(@Body() body: any, @Res() res: Response) {
    const { email } = body;
    if (!email) throw new HttpException('Email requerido', 400);

    // Buscar usuario
    const { rows } = await this.pg.query(
      'SELECT id, email, totp_secret FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    if (!user) throw new HttpException('Usuario no encontrado', 404);

    // Generar secret si no existe
    let secret = user.totp_secret;
    if (!secret) {
      const { authenticator } = await import('otplib');
      secret = authenticator.generateSecret();
      await this.pg.query(
        'UPDATE users SET totp_secret = $1 WHERE id = $2',
        [secret, user.id]
      );
    }

    // Generar QR code
    const { authenticator } = await import('otplib');
    const QRCode = await import('qrcode');
    const otpauth = authenticator.keyuri(user.email, 'Skyplay Mayoristas', secret);
    const qrcode = await QRCode.toDataURL(otpauth);

    return res.json({ qrcode, secret });
  }

  @Post('reset-password-totp')
  async resetPasswordTotp(@Body() body: any) {
    const { email, totp, newPassword } = body;

    if (!email || !totp || !newPassword) {
      throw new HttpException('Email, TOTP y nueva contraseña son requeridos', 400);
    }

    if (newPassword.length < 8) {
      throw new HttpException('La contraseña debe tener al menos 8 caracteres', 400);
    }

    // Buscar usuario
    const { rows } = await this.pg.query(
      'SELECT id, email, totp_secret FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];

    if (!user) {
      throw new HttpException('Usuario no encontrado', 404);
    }

    if (!user.totp_secret) {
      throw new HttpException('Este usuario no tiene Google Authenticator configurado', 400);
    }

    // Validar TOTP
    const { authenticator } = await import('otplib');
    const isValidOtp = authenticator.verify({ token: totp, secret: user.totp_secret });

    if (!isValidOtp) {
      throw new HttpException('Código TOTP inválido o expirado', 401);
    }

    // Hash de la nueva contraseña
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await this.pg.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, user.id]
    );

    return { ok: true, message: 'Contraseña actualizada correctamente' };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const raw = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];
    if (!raw) throw new HttpException('Unauthorized', 401);
    try {
      const payload = jwt.verify(raw, process.env.JWT_SECRET!) as JWTPayload;
      return payload;
    } catch {
      throw new HttpException('Unauthorized', 401);
    }
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie(process.env.SESSION_COOKIE_NAME || 'sky_sid', { path: '/' });
    return res.json({ ok: true });
  }

  @Post('webhook/subscription')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      throw new HttpException('Missing signature or secret', 400);
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody!,
        sig,
        webhookSecret,
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;
  
  // ========== COMPRA DE CATÁLOGO ==========
  if (session.metadata?.order_type === 'catalog_purchase') {
    const orderId = session.metadata.order_id;
    const productCode = session.metadata.product_code;
    const tenantId = parseInt(session.metadata.tenant_id || '0');
    const quantity = parseInt(session.metadata.quantity || '1');

    try {
      // 1. Verificar idempotencia - si ya se procesó, salir
      const checkResult = await this.pg.query(
        `SELECT event_type FROM billing_events WHERE id = $1`,
        [orderId]
      );

      if (checkResult.rows.length === 0) {
        console.error(`❌ Order ${orderId} not found`);
        break;
      }

      if (checkResult.rows[0].event_type === 'purchase_completed') {
        console.log(`⚠️ Order ${orderId} already processed (idempotent check), skipping`);
        break;
      }

      // 2. Obtener detalles de la orden
      const orderResult = await this.pg.query(
        `SELECT payload FROM billing_events WHERE id = $1`,
        [orderId]
      );

      const orderPayload = orderResult.rows[0].payload;
      
      // 3. Crear servicios (uno por cada quantity)
      for (let i = 0; i < quantity; i++) {
        // Buscar una credencial disponible
        const credResult = await this.pg.query(
          `SELECT id FROM credentials 
           WHERE product_code = $1 AND status = 'available' 
           LIMIT 1`,
          [productCode]
        );

        if (credResult.rows.length === 0) {
          console.error(`❌ No credentials available for product ${productCode}`);
          continue;
        }

        const credentialId = credResult.rows[0].id;
        
        // Crear el servicio
        const serviceResult = await this.pg.query(
          `INSERT INTO services (tenant_id, product_code, credential_id, status, expires_at)
           VALUES ($1, $2, $3, 'active', NOW() + INTERVAL '30 days')
           RETURNING id`,
          [tenantId, productCode, credentialId]
        );

        const serviceId = serviceResult.rows[0].id;

        // Marcar la credencial como asignada
        await this.pg.query(
          `UPDATE credentials SET status = 'assigned', assigned_to = $1 WHERE id = $2`,
          [serviceId, credentialId]
        );
      }

      // 4. Actualizar stock del producto
      await this.pg.query(
        `UPDATE products SET stock = stock - $1 WHERE code = $2`,
        [quantity, productCode]
      );

      // 5. Actualizar orden a completada
      await this.pg.query(
        `UPDATE billing_events 
         SET event_type = 'purchase_completed', 
             payload = jsonb_set(payload, '{payment_status}', '"completed"')
         WHERE id = $1`,
        [orderId]
      );

      console.log(`✅ Catalog purchase completed: ${quantity}x ${productCode} for tenant ${tenantId}`);
      
      // 6. Enviar email con credenciales (async, no bloqueante)
      try {
        const userResult = await this.pg.query(
          `SELECT u.email, t.name as tenant_name 
           FROM users u 
           JOIN tenants t ON u.tenant_id = t.id 
           WHERE u.tenant_id = $1 
           LIMIT 1`,
          [tenantId]
        );
        
        if (userResult.rows.length > 0 && userResult.rows[0].email) {
          const user = userResult.rows[0];
          
          // Obtener credenciales del servicio creado
          const servicesResult = await this.pg.query(
            `SELECT s.id, s.expires_at, c.email, c.password, c.profile_name, c.pin, p.name as product_name
             FROM services s
             JOIN credentials c ON s.credential_id = c.id
             JOIN products p ON s.product_code = p.code
             WHERE s.tenant_id = $1 AND s.product_code = $2
             ORDER BY s.created_at DESC
             LIMIT $3`,
            [tenantId, productCode, quantity]
          );
          
          if (servicesResult.rows.length > 0) {
            const service = servicesResult.rows[0];
            await this.emailService.sendCredentialsEmail({
              to: user.email,
              tenantName: user.tenant_name,
              productName: service.product_name,
              credentials: servicesResult.rows.map(s => ({
                email: s.email,
                password: s.password,
                profile_name: s.profile_name,
                pin: s.pin,
              })),
              expiresAt: service.expires_at,
              orderNumber: session.metadata?.order_number,
            });
            console.log(`📧 Email sent to ${user.email} for order ${orderId}`);
          }
        }
      } catch (emailErr: any) {
        console.error('Error sending email after catalog purchase:', emailErr.message);
      }
    } catch (err: any) {
      console.error('Error processing catalog purchase:', err.message);
    }
    break;
  }

  // ========== RECARGA DE BILLETERA ==========
  if (session.metadata?.order_type === 'wallet_recharge') {
    const orderId = session.metadata.order_id;
    const tenantId = parseInt(session.metadata.tenant_id || '0');
    const amount = parseFloat(session.metadata.amount || '0');
    const totalWithBonus = parseFloat(session.metadata.total_with_bonus || amount.toString());

    try {
      // 1. Verificar idempotencia - si ya se procesó, salir
      const checkResult = await this.pg.query(
        `SELECT event_type FROM billing_events WHERE id = $1`,
        [orderId]
      );

      if (checkResult.rows.length > 0 && checkResult.rows[0].event_type === 'wallet_recharge_completed') {
        console.log(`⚠️ Wallet recharge order ${orderId} already processed (idempotent check), skipping`);
        break;
      }

      // 2. Actualizar balance de la billetera
      await this.pg.query(
        `UPDATE tenants SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
        [totalWithBonus, tenantId]
      );

      // 3. Actualizar orden a completada
      await this.pg.query(
        `UPDATE billing_events 
         SET event_type = 'wallet_recharge_completed', 
             payload = jsonb_set(payload, '{payment_status}', '"completed"')
         WHERE id = $1`,
        [orderId]
      );

      console.log(`✅ Wallet recharged: $${totalWithBonus} for tenant ${tenantId} (original: $${amount})`);
    } catch (err: any) {
      console.error('Error processing wallet recharge:', err.message);
    }
    break;
  }
  
  // ========== RENOVACIÓN DE SERVICIO ==========
  if (session.metadata?.order_type === 'renewal') {
    const serviceId = session.metadata.service_id;
    const orderId = session.metadata.order_id;
    
    // Verificar idempotencia - si ya se procesó, salir
    const checkResult = await this.pg.query(
      `SELECT event_type FROM billing_events WHERE id = $1`,
      [orderId]
    );

    if (checkResult.rows.length > 0 && checkResult.rows[0].event_type === 'renewal_completed') {
      console.log(`⚠️ Renewal order ${orderId} already processed (idempotent check), skipping`);
      break;
    }
    
    // Actualizar orden a completada
    await this.pg.query(
    `UPDATE billing_events 
     SET event_type = 'renewal_completed', 
         payload = jsonb_set(
           jsonb_set(payload, '{payment_status}', '"completed"'),
           '{status}', '"completed"'
         )
     WHERE id = $1`,
    [orderId]
  );
    
    // Extender servicio
    await this.pg.query(
      `UPDATE services 
       SET expires_at = CASE 
         WHEN expires_at > NOW() THEN expires_at + INTERVAL '30 days'
         ELSE NOW() + INTERVAL '30 days'
       END,
       status = 'active'
       WHERE id = $1`,
      [serviceId]
    );
    
    console.log(`✅ Service ${serviceId} renewed for 30 days`);
    break;
  }
  
  // Suscripción preferencial
  const tenantId = session.metadata?.tenant_id;
  if (tenantId && session.subscription) {
    try {
      // Obtener la suscripción real desde Stripe (tiene el current_period_end correcto)
      const subscriptionResp = await this.stripe.subscriptions.retrieve(session.subscription as string);
      console.log('🔎 Stripe subscription object:', JSON.stringify(subscriptionResp, null, 2));
      const subscription = (subscriptionResp as any).data || subscriptionResp;
      let periodEndDate: Date|null = null;
      const periodEnd = subscription.items?.data?.[0]?.current_period_end;
      if (typeof periodEnd === 'number' && periodEnd > 0 && !isNaN(periodEnd)) {
        const d = new Date(periodEnd * 1000);
        if (!isNaN(d.getTime())) {
          periodEndDate = d;
        }
      }
      // Solo actualizar current_period_end si la fecha es válida, si no, conservar la anterior
      await this.pg.query(
        `INSERT INTO subscriptions (tenant_id, stripe_subscription_id, status, current_period_end)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id) 
         DO UPDATE SET 
           stripe_subscription_id = $2,
           status = $3,
           current_period_end = CASE WHEN $4 IS NOT NULL THEN $4 ELSE subscriptions.current_period_end END`,
        [
          tenantId,
          subscription.id,
          subscription.status,
          periodEndDate
        ]
      );
      console.log(`✅ Subscription ${subscription.id} for tenant ${tenantId}, expires: ${periodEndDate ? periodEndDate.toISOString() : 'undefined'}`);
    } catch (err: any) {
      console.error('Error retrieving/updating subscription from Stripe:', err && err.message ? err.message : err);
      // Don't throw here — respond received:true so Stripe doesn't consider this a permanent failure.
    }
  }
  break;
}

    case 'customer.subscription.updated': {
  const subscription = event.data.object as Stripe.Subscription;
  await this.pg.query(
    `UPDATE subscriptions SET status = $1, current_period_end = $2 
     WHERE stripe_subscription_id = $3`,
    [subscription.status, new Date((subscription as any).current_period_end * 1000), subscription.id]
  );
  break;
}

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.pg.query(
          `UPDATE subscriptions SET status = 'canceled' 
           WHERE stripe_subscription_id = $1`,
          [subscription.id]
        );
        break;
      }
    }

    res.json({ received: true });
  }
}