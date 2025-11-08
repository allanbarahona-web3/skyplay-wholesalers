// src/modules/auth/auth.controller.ts
import { Controller, Get, Post, Body, Res, Req, HttpException, Inject, RawBodyRequest, UseInterceptors } from '@nestjs/common';
import { Response, Request } from 'express';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { EmailService } from '../email/email.service';
import { PayPalService } from '../paypal/paypal.service';
import { UseLoginRateLimit, UseStrictRateLimit } from '../../middleware/rate-limit.interceptor';


type JWTPayload = { id: number; tenant_id: number|null; role: string };

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('PG_POOL') private readonly pg: Pool,
    private readonly emailService: EmailService,
    private readonly paypalService: PayPalService
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
  @UseLoginRateLimit()
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
  @UseStrictRateLimit()
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
  @UseStrictRateLimit()
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

    console.log(`📥 Stripe webhook received: ${event.type}, Event ID: ${event.id}`);

    switch (event.type) {
      case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;
  console.log(`🔍 Session metadata:`, JSON.stringify(session.metadata, null, 2));
  
  // ========== COMPRA DE CATÁLOGO ==========
  if (session.metadata?.order_type === 'catalog_purchase') {
    const orderId = session.metadata.order_id;
    const productCode = session.metadata.product_code;
    const tenantId = parseInt(session.metadata.tenant_id || '0');
    const quantity = parseInt(session.metadata.quantity || '1');
    
    console.log(`🛒 Processing catalog purchase: Order=${orderId}, Product=${productCode}, Qty=${quantity}`);

    const client = await this.pg.connect();
    try {
      await client.query('BEGIN');

      // 1. Verificar idempotencia CON LOCK - si ya se procesó, salir
      const checkResult = await client.query(
        `SELECT event_type FROM billing_events WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (checkResult.rows.length === 0) {
        console.error(`❌ Order ${orderId} not found`);
        await client.query('ROLLBACK');
        break;
      }

      if (checkResult.rows[0].event_type === 'purchase_completed') {
        console.log(`⚠️ Order ${orderId} already processed (idempotent check), skipping`);
        await client.query('ROLLBACK');
        break;
      }

      // 2. Verificar stock disponible
      const productResult = await client.query(
        `SELECT code, name, stock FROM products WHERE code = $1 FOR UPDATE`,
        [productCode]
      );

      if (productResult.rows.length === 0 || productResult.rows[0].stock < quantity) {
        throw new Error('Insufficient stock');
      }

      const product = productResult.rows[0];

      // 3. Seleccionar credenciales disponibles con FOR UPDATE SKIP LOCKED
      const availableCredsResult = await client.query(
        `SELECT id, email, password, profile_name, pin
         FROM credentials 
         WHERE product_code = $1 AND status = 'available'
         ORDER BY created_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED`,
        [productCode, quantity]
      );

      if (availableCredsResult.rows.length < quantity) {
        throw new Error(`Not enough available credentials. Need ${quantity}, found ${availableCredsResult.rows.length}`);
      }

      const credIds = availableCredsResult.rows.map(c => c.id);
      
      // 4. Marcar como asignadas
      const credentialsResult = await client.query(
        `UPDATE credentials 
         SET status = 'assigned', updated_at = NOW()
         WHERE id = ANY($1)
         RETURNING id, email, password, profile_name, pin`,
        [credIds]
      );

      if (credentialsResult.rows.length < quantity) {
        throw new Error('Failed to assign credentials');
      }

      const credentials = credentialsResult.rows;

      // 5. Crear servicios para cada credencial
      for (const cred of credentials) {
        await client.query(
          `INSERT INTO services (tenant_id, product_code, credential_id, status, expires_at)
           VALUES ($1, $2, $3, 'active', NOW() + INTERVAL '30 days')`,
          [tenantId, productCode, cred.id]
        );
      }

      // 6. Descontar stock
      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE code = $2`,
        [quantity, productCode]
      );

      // 7. Actualizar orden a completada
      await client.query(
        `UPDATE billing_events 
         SET event_type = 'purchase_completed', 
             payload = jsonb_set(payload, '{payment_status}', '"completed"')
         WHERE id = $1`,
        [orderId]
      );

      await client.query('COMMIT');

      console.log(`✅ Stripe catalog purchase completed: Order ${orderId}, Product: ${productCode}, Qty: ${quantity}`);
      
      // 8. Enviar email con credenciales (después del commit)
      const userResult = await client.query(
        `SELECT u.email, t.name as tenant_name 
         FROM users u 
         JOIN tenants t ON u.tenant_id = t.id 
         WHERE u.tenant_id = $1 
         LIMIT 1`,
        [tenantId]
      );
      
      if (userResult.rows.length > 0 && userResult.rows[0].email) {
        const user = userResult.rows[0];
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();
        
        this.emailService.sendCredentialsEmail({
          to: user.email,
          tenantName: user.tenant_name || 'Cliente',
          productName: product.name,
          credentials: credentials.map(c => ({
            email: c.email,
            password: c.password,
            profileName: c.profile_name,
            pin: c.pin,
          })),
          expiresAt: expiresAt,
          orderNumber: session.metadata?.order_number || orderId.toString(),
          totalPrice: parseFloat(session.amount_total?.toString() || '0') / 100,
          discountApplied: 0,
        }).catch(err => console.error('Error sending email:', err));
      }
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Error processing Stripe catalog purchase:', err.message);
    } finally {
      client.release();
    }
    break;
  }

  // ========== RECARGA DE BILLETERA ==========
  if (session.metadata?.order_type === 'wallet_recharge') {
    const orderId = session.metadata.order_id;
    const tenantId = parseInt(session.metadata.tenant_id || '0');
    const amount = parseFloat(session.metadata.amount || '0');
    const totalWithBonus = parseFloat(session.metadata.total_with_bonus || amount.toString());

    const client = await this.pg.connect();
    try {
      await client.query('BEGIN');

      // 1. Verificar idempotencia CON LOCK - si ya se procesó, salir
      const checkResult = await client.query(
        `SELECT event_type FROM billing_events WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (checkResult.rows.length > 0 && checkResult.rows[0].event_type === 'wallet_recharge_completed') {
        console.log(`⚠️ Wallet recharge order ${orderId} already processed (idempotent check), skipping`);
        await client.query('ROLLBACK');
        break;
      }

      // 2. Actualizar balance de la billetera
      await client.query(
        `UPDATE tenants SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
        [totalWithBonus, tenantId]
      );

      // 3. Actualizar orden a completada
      await client.query(
        `UPDATE billing_events 
         SET event_type = 'wallet_recharge_completed', 
             payload = jsonb_set(payload, '{payment_status}', '"completed"')
         WHERE id = $1`,
        [orderId]
      );

      await client.query('COMMIT');
      console.log(`✅ Wallet recharged: $${totalWithBonus} for tenant ${tenantId} (original: $${amount})`);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Error processing wallet recharge:', err.message);
    } finally {
      client.release();
    }
    break;
  }
  
  // ========== RENOVACIÓN DE SERVICIO ==========
  if (session.metadata?.order_type === 'renewal') {
    const serviceId = session.metadata.service_id;
    const orderId = session.metadata.order_id;
    
    const client = await this.pg.connect();
    try {
      await client.query('BEGIN');

      // Verificar idempotencia CON LOCK - si ya se procesó, salir
      const checkResult = await client.query(
        `SELECT event_type FROM billing_events WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (checkResult.rows.length > 0 && checkResult.rows[0].event_type === 'renewal_completed') {
        console.log(`⚠️ Renewal order ${orderId} already processed (idempotent check), skipping`);
        await client.query('ROLLBACK');
        break;
      }
      
      // Actualizar orden a completada
      await client.query(
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
      await client.query(
      `UPDATE services 
       SET expires_at = CASE 
         WHEN expires_at > NOW() THEN expires_at + INTERVAL '30 days'
         ELSE NOW() + INTERVAL '30 days'
       END,
       status = 'active'
       WHERE id = $1`,
      [serviceId]
    );
      
      await client.query('COMMIT');
      console.log(`✅ Service ${serviceId} renewed for 30 days`);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Error processing service renewal:', err.message);
    } finally {
      client.release();
    }
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

    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata || {};
      const subscriptionType = metadata.subscription_type || 'preferential'; // Map to ENUM: preferential, crm-pro, tienda
      const billingCycle = metadata.billing_cycle || 'monthly'; // ENUM: monthly, quarterly, semiannual
      const tenantId = metadata.tenant_id ? parseInt(metadata.tenant_id) : null;

      if (!tenantId) {
        console.warn(`⚠️ customer.subscription.created: No tenant_id in metadata for subscription ${subscription.id}`);
        break;
      }

      try {
        const periodEnd = (subscription as any).current_period_end;
        const periodEndDate = periodEnd ? new Date(periodEnd * 1000) : null;

        // Map subscription-pref to 'preferential' enum
        const productTypeEnum = subscriptionType === 'subscription-pref' ? 'preferential' : subscriptionType;

        await this.pg.query(
          `INSERT INTO subscriptions (tenant_id, stripe_subscription_id, status, current_period_end, product_type, billing_cycle)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tenant_id) 
           DO UPDATE SET 
             stripe_subscription_id = $2,
             status = $3,
             current_period_end = CASE WHEN $4 IS NOT NULL THEN $4 ELSE subscriptions.current_period_end END,
             product_type = $5,
             billing_cycle = $6`,
          [
            tenantId,
            subscription.id,
            subscription.status,
            periodEndDate,
            productTypeEnum,
            billingCycle
          ]
        );
        console.log(`✅ Subscription ${subscription.id} CREATED for tenant ${tenantId}, type: ${productTypeEnum}, cycle: ${billingCycle}, expires: ${periodEndDate ? periodEndDate.toISOString() : 'undefined'}`);
      } catch (err: any) {
        console.error('Error creating subscription:', err && err.message ? err.message : err);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata || {};
      const subscriptionType = metadata.subscription_type || 'preferential';
      const billingCycle = metadata.billing_cycle || 'monthly';
      
      // Map subscription-pref to 'preferential' enum
      const productTypeEnum = subscriptionType === 'subscription-pref' ? 'preferential' : subscriptionType;

      await this.pg.query(
        `UPDATE subscriptions SET status = $1, current_period_end = $2, product_type = $3, billing_cycle = $4
         WHERE stripe_subscription_id = $5`,
        [
          subscription.status,
          new Date((subscription as any).current_period_end * 1000),
          productTypeEnum,
          billingCycle,
          subscription.id
        ]
      );
      console.log(`✅ Subscription ${subscription.id} UPDATED, status: ${subscription.status}, type: ${productTypeEnum}`);
      break;
    }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.pg.query(
          `UPDATE subscriptions SET status = 'canceled' 
           WHERE stripe_subscription_id = $1`,
          [subscription.id]
        );
        console.log(`✅ Subscription ${subscription.id} DELETED/CANCELED`);
        break;
      }
    }

    res.json({ received: true });
  }

  @Post('webhook/paypal')
  async handlePayPalWebhook(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    
    // Verificar firma del webhook (en producción es crítico)
    if (webhookId) {
      const isValid = await this.paypalService.verifyWebhookSignature(
        webhookId,
        req.headers,
        req.body
      );
      
      if (!isValid) {
        console.error('❌ PayPal webhook signature verification failed');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body;
    const eventType = event.event_type;

    console.log(`📥 PayPal webhook received: ${eventType}`);

    switch (eventType) {
      // Cuando el usuario aprueba el pago en PayPal
      case 'CHECKOUT.ORDER.APPROVED': {
        const resource = event.resource;
        const paypalOrderId = resource.id;
        
        try {
          // Capturar el pago automáticamente
          const captureResult = await this.paypalService.captureOrder(paypalOrderId);
          console.log(`✅ PayPal order captured: ${paypalOrderId}`);
        } catch (error) {
          console.error('Error capturing PayPal order:', error);
        }
        break;
      }

      // Cuando el pago se completa exitosamente
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const resource = event.resource;
        const paypalOrderId = resource.supplementary_data?.related_ids?.order_id;
        
        if (!paypalOrderId) {
          console.error('❌ No order_id in PayPal capture event');
          break;
        }

        try {
          // Obtener detalles completos de la orden
          const orderDetails = await this.paypalService.getOrder(paypalOrderId);
          const customId = orderDetails.purchase_units?.[0]?.custom_id;

          if (!customId) {
            console.error('❌ No custom_id (order_id) in PayPal order');
            break;
          }

          const orderId = parseInt(customId);

          // 1. Verificar idempotencia - si ya se procesó, salir
          const checkResult = await this.pg.query(
            `SELECT event_type, payload FROM billing_events WHERE id = $1`,
            [orderId]
          );

          if (checkResult.rows.length === 0) {
            console.error(`❌ Order ${orderId} not found`);
            break;
          }

          const eventType = checkResult.rows[0].event_type;
          const payload = checkResult.rows[0].payload;

          // Verificar idempotencia según el tipo de orden
          if (eventType === 'purchase_completed' || eventType === 'wallet_recharge_completed' || eventType === 'renewal_completed') {
            console.warn(`⚠️ Order ${orderId} already completed (idempotency): ${eventType}`);
            break;
          }

          // ========== PROCESAR RECARGA DE BILLETERA ==========
          if (eventType === 'wallet_recharge_pending') {
            // Obtener tenant_id desde la orden en billing_events
            const orderInfo = await this.pg.query(
              `SELECT tenant_id FROM billing_events WHERE id = $1`,
              [orderId]
            );
            
            if (orderInfo.rows.length === 0) {
              console.error(`❌ Order ${orderId} not found in billing_events`);
              break;
            }
            
            const tenantId = orderInfo.rows[0].tenant_id;
            const amount = parseFloat(payload.amount || '0');
            const totalWithBonus = parseFloat(payload.total_with_bonus || amount.toString());

            const client = await this.pg.connect();
            try {
              await client.query('BEGIN');

              // 1. Actualizar balance de la billetera
              await client.query(
                `UPDATE tenants SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
                [totalWithBonus, tenantId]
              );

              // 2. Actualizar orden a completada
              await client.query(
                `UPDATE billing_events 
                 SET event_type = 'wallet_recharge_completed', 
                     payload = jsonb_set(payload, '{status}', '"completed"')
                 WHERE id = $1`,
                [orderId]
              );

              await client.query('COMMIT');
              console.log(`✅ PayPal wallet recharged: $${totalWithBonus} for tenant ${tenantId} (original: $${amount})`);
            } catch (error) {
              await client.query('ROLLBACK');
              console.error('Error processing PayPal wallet recharge:', error);
            } finally {
              client.release();
            }
            break;
          }

          // ========== PROCESAR RENOVACIÓN DE SERVICIO ==========
          if (eventType === 'renewal_pending') {
            const serviceId = payload.service_id;
            
            const client = await this.pg.connect();
            try {
              await client.query('BEGIN');

              // 1. Verificar idempotencia CON LOCK - si ya se procesó, salir
              const checkResult = await client.query(
                `SELECT event_type FROM billing_events WHERE id = $1 FOR UPDATE`,
                [orderId]
              );

              if (checkResult.rows.length > 0 && checkResult.rows[0].event_type === 'renewal_completed') {
                console.log(`⚠️ PayPal renewal order ${orderId} already processed (idempotent check), skipping`);
                await client.query('ROLLBACK');
                break;
              }

              // 2. Actualizar orden a completada
              await client.query(
                `UPDATE billing_events 
                 SET event_type = 'renewal_completed', 
                     payload = jsonb_set(
                       jsonb_set(payload, '{payment_status}', '"completed"'),
                       '{status}', '"completed"'
                     )
                 WHERE id = $1`,
                [orderId]
              );
              
              // 3. Extender servicio por 30 días
              await client.query(
                `UPDATE services 
                 SET expires_at = CASE 
                   WHEN expires_at > NOW() THEN expires_at + INTERVAL '30 days'
                   ELSE NOW() + INTERVAL '30 days'
                 END,
                 status = 'active'
                 WHERE id = $1`,
                [serviceId]
              );
              
              await client.query('COMMIT');
              console.log(`✅ PayPal service ${serviceId} renewed for 30 days`);
            } catch (error) {
              await client.query('ROLLBACK');
              console.error('Error processing PayPal service renewal:', error);
            } finally {
              client.release();
            }
            break;
          }

          // ========== PROCESAR COMPRA DE CATÁLOGO ==========
          const productCode = payload.product_code;
          const quantity = parseInt(payload.quantity || '1');

          const client = await this.pg.connect();
          try {
            await client.query('BEGIN');

            // 2. Verificar stock disponible
            const productResult = await client.query(
              `SELECT code, name, stock FROM products WHERE code = $1 FOR UPDATE`,
              [productCode]
            );

            if (productResult.rows.length === 0 || productResult.rows[0].stock < quantity) {
              throw new Error('Insufficient stock');
            }

            const product = productResult.rows[0];

            // 3. Seleccionar credenciales disponibles
            const availableCredsResult = await client.query(
              `SELECT id, email, password, profile_name, pin
               FROM credentials 
               WHERE product_code = $1 AND status = 'available'
               ORDER BY created_at ASC
               LIMIT $2
               FOR UPDATE SKIP LOCKED`,
              [productCode, quantity]
            );

            if (availableCredsResult.rows.length < quantity) {
              throw new Error(`Not enough available credentials. Need ${quantity}, found ${availableCredsResult.rows.length}`);
            }

            const credIds = availableCredsResult.rows.map(c => c.id);
            
            // 4. Marcar como asignadas
            const credentialsResult = await client.query(
              `UPDATE credentials 
               SET status = 'assigned', updated_at = NOW()
               WHERE id = ANY($1)
               RETURNING id, email, password, profile_name, pin`,
              [credIds]
            );

            if (credentialsResult.rows.length < quantity) {
              throw new Error('Failed to assign credentials');
            }

            const credentials = credentialsResult.rows;

            // 5. Descontar stock
            await client.query(
              `UPDATE products SET stock = stock - $1 WHERE code = $2`,
              [quantity, productCode]
            );

            // 6. Obtener tenant_id del billing_event
            const eventResult = await client.query(
              `SELECT tenant_id FROM billing_events WHERE id = $1`,
              [orderId]
            );
            const tenantId = eventResult.rows[0].tenant_id;

            // 7. Crear registros en services para cada credencial
            for (const cred of credentials) {
              await client.query(
                `INSERT INTO services (tenant_id, product_code, credential_id, status, expires_at)
                 VALUES ($1, $2, $3, 'active', NOW() + INTERVAL '30 days')`,
                [tenantId, productCode, cred.id]
              );
            }

            // 8. Actualizar billing_event como completado
            await client.query(
              `UPDATE billing_events 
               SET event_type = 'purchase_completed',
                   payload = jsonb_set(payload, '{status}', '"completed"')
               WHERE id = $1`,
              [orderId]
            );

            await client.query('COMMIT');

            // 9. Enviar email con credenciales
            const userResult = await client.query(
              `SELECT u.email, t.name as tenant_name
               FROM users u
               INNER JOIN tenants t ON u.tenant_id = t.id
               WHERE t.id = $1`,
              [tenantId]
            );

            if (userResult.rows.length > 0 && userResult.rows[0].email) {
              const user = userResult.rows[0];
              // Calcular fecha de expiración (30 días desde ahora)
              const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();
              
              this.emailService.sendCredentialsEmail({
                to: user.email,
                tenantName: user.tenant_name || 'Cliente',
                productName: product.name,
                credentials: credentials.map(c => ({
                  email: c.email,
                  password: c.password,
                  profileName: c.profile_name,
                  pin: c.pin,
                })),
                expiresAt: expiresAt,
                orderNumber: payload.order_number || orderId.toString(),
                totalPrice: parseFloat(payload.total_price),
                discountApplied: parseFloat(payload.discount_applied || '0') * 100,
              }).catch(err => console.error('Error sending email:', err));
            }

            console.log(`✅ PayPal purchase completed: Order ${orderId}, Product: ${productCode}, Qty: ${quantity}`);
          } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error processing PayPal purchase:', error);
          } finally {
            client.release();
          }
        } catch (error) {
          console.error('Error handling PayPal capture:', error);
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled PayPal webhook event: ${eventType}`);
    }

    res.json({ received: true });
  }
}