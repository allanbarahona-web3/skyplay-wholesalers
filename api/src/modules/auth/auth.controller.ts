// src/modules/auth/auth.controller.ts
import { Controller, Get, Post, Body, Res, Req, HttpException, Inject, RawBodyRequest } from '@nestjs/common';
import { Response, Request } from 'express';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';


type JWTPayload = { id: number; tenant_id: number|null; role: string };

@Controller('auth')
export class AuthController {
  constructor(@Inject('PG_POOL') private readonly pg: Pool) {}
  
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
  
  // Verificar si es renovación de servicio
if (session.metadata?.order_type === 'renewal') {
  const serviceId = session.metadata.service_id;
  const orderId = session.metadata.order_id;
  
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