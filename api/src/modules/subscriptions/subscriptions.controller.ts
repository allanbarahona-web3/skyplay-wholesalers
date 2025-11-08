import { Controller, Post, Body, Req, Res, HttpException, Inject, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { Pool } from 'pg';
import Stripe from 'stripe';
import { AuthGuard, JWTPayload } from '../../guards/auth.guard';
import { EmailService } from '../email/email.service';

@Controller('subscriptions')
@UseGuards(AuthGuard) // Proteger TODOS los endpoints de subscriptions
export class SubscriptionsController {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  constructor(
    @Inject('PG_POOL') private readonly pg: Pool,
    private readonly emailService: EmailService
  ) {}

  @Post('checkout')
  async createCheckout(@Body() body: { plan: string }, @Req() req: Request, @Res() res: Response) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    type Plan = { amount: number; interval: 'month'; interval_count?: number; name: string };
    const plans: Record<string, Plan> = {
      monthly: {
        amount: 995,
        interval: 'month',
        interval_count: 1,
        name: 'Mensual',
      },
      quarterly: {
        amount: 2687,
        interval: 'month',
        interval_count: 3,
        name: '3 Meses',
      },
      semiannual: {
        amount: 4776,
        interval: 'month',
        interval_count: 6,
        name: '6 Meses',
      },
    };

    const selectedPlan = plans[body.plan as keyof typeof plans];
    if (!selectedPlan) throw new HttpException('Invalid plan', 400);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { 
            name: `Suscripción Preferencial ${selectedPlan.name}`,
            description: 'Descuentos del 30% en todos los productos'
          },
          unit_amount: selectedPlan.amount,
          recurring: {
            interval: selectedPlan.interval,
            interval_count: selectedPlan.interval_count ?? 1,
          }
        },
        quantity: 1
      }],
      metadata: {
        tenant_id: tenant_id.toString(),
        plan: body.plan,
        subscription_type: 'preferential'
      },
      success_url: `${process.env.FRONTEND_URL}/panel_mayorista.html?subscription=success`,
      cancel_url: `${process.env.FRONTEND_URL}/panel_mayorista.html?subscription=cancel`
    });

    return res.json({ checkout_url: session.url });
  }
    @Post('create-paypal-checkout')
  async createSubscriptionPayPalCheckout(
    @Body() body: { subscriptionType: string; billingCycle: string; price: number },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    const { subscriptionType, billingCycle, price } = body;
    if (!subscriptionType || !billingCycle || price <= 0) {
      throw new HttpException('Invalid subscription data', 400);
    }

    // TODO: Implementar PayPal checkout para suscripciones
    // Por ahora, retornar error informativo
    throw new HttpException('PayPal subscription checkout en desarrollo', 501);
  }

  @Post('create-checkout')
  async createSubscriptionStripeCheckout(
    @Body() body: { subscriptionType: string; billingCycle: string; price: number },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    const { subscriptionType, billingCycle, price } = body;
    if (!subscriptionType || !billingCycle || price <= 0) {
      throw new HttpException('Invalid subscription data', 400);
    }

    const billingCycles: { [key: string]: { interval_count: number; displayName: string } } = {
      monthly: { interval_count: 1, displayName: 'Mensual' },
      quarterly: { interval_count: 3, displayName: '3 Meses' },
      semiannual: { interval_count: 6, displayName: '6 Meses' }
    };

    const cycle = billingCycles[billingCycle];
    if (!cycle) throw new HttpException('Invalid billing cycle', 400);

    const productNames: { [key: string]: string } = {
      'subscription-pref': 'Suscripción Preferencial',
      'crm-basic': 'CRM PLUS',
      'crm-pro': 'CRM PRO',
      'tienda': 'Tienda Personalizada'
    };

    const productName = productNames[subscriptionType] || 'Suscripción';

    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${productName} ${cycle.displayName}`,
              description: `Acceso a ${productName}`
            },
            unit_amount: Math.round(price * 100),
            recurring: {
              interval: 'month',
              interval_count: cycle.interval_count
            }
          },
          quantity: 1
        }],
        metadata: {
          tenant_id: tenant_id.toString(),
          subscription_type: subscriptionType,
          billing_cycle: billingCycle
        },
        success_url: `${process.env.FRONTEND_URL}/panel?payment=success&type=subscription&provider=stripe&subscription_type=${subscriptionType}`,
        cancel_url: `${process.env.FRONTEND_URL}/panel?payment=cancel`
      });

      return res.json({ 
        checkout_url: session.url,
        order_number: session.id
      });
    } catch (err: any) {
      console.error('Error creating subscription checkout:', err);
      throw new HttpException(err.message || 'Error al crear checkout', 500);
    }
  }

  @Post('create-sinpe-checkout')
  async createSubscriptionSinpeCheckout(
    @Body() body: { subscriptionType: string; billingCycle: string; price: number },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    const { subscriptionType, billingCycle, price } = body;
    if (!subscriptionType || !billingCycle || price <= 0) {
      throw new HttpException('Invalid subscription data', 400);
    }

    const orderNumber = `SUB-${Date.now()}`;
    
    try {
      // Crear registro pendiente en billing_events
      await this.pg.query(
        `INSERT INTO billing_events (tenant_id, event_type, source, order_number, payload)
         VALUES ($1, 'subscription_pending', 'SINPE', $2, $3)`,
        [
          tenant_id,
          orderNumber,
          JSON.stringify({
            subscription_type: subscriptionType,
            billing_cycle: billingCycle,
            price,
            status: 'pending'
          })
        ]
      );

      return res.json({
        order_number: orderNumber,
        instructions: {
          phone: process.env.SINPE_PHONE || '8888-8888',
          reference: orderNumber,
          amount: price.toFixed(2)
        }
      });
    } catch (err: any) {
      console.error('Error creating SINPE subscription checkout:', err);
      throw new HttpException(err.message || 'Error al crear checkout SINPE', 500);
    }
  }

  @Post('wallet-checkout')
  async createSubscriptionWalletCheckout(
    @Body() body: { subscriptionType: string; billingCycle: string; price: number },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    const { subscriptionType, billingCycle, price } = body;
    if (!subscriptionType || !billingCycle || price <= 0) {
      throw new HttpException('Invalid subscription data', 400);
    }

    const orderNumber = `SUB-WALLET-${Date.now()}`;
    
    try {
      // Obtener balance de la billetera del usuario
      const walletQuery = `SELECT balance FROM wallets WHERE tenant_id = $1`;
      const walletResult = await this.pg.query(walletQuery, [tenant_id]);
      
      if (walletResult.rows.length === 0) {
        throw new HttpException('Wallet not found', 404);
      }

      const walletBalance = parseFloat(walletResult.rows[0].balance);

      // Verificar si tiene suficiente saldo
      if (walletBalance < price) {
        throw new HttpException(
          `Saldo insuficiente. Tienes $${walletBalance.toFixed(2)}, necesitas $${price.toFixed(2)}`,
          402
        );
      }

      // Descontar de la billetera
      await this.pg.query(
        `UPDATE wallets SET balance = balance - $1 WHERE tenant_id = $2`,
        [price, tenant_id]
      );

      // Crear billing event para registrar la compra
      const now = new Date();
      const renewalDate = new Date();
      
      // Calcular fecha de renovación según el ciclo
      if (billingCycle === 'monthly') {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
      } else if (billingCycle === 'quarterly') {
        renewalDate.setMonth(renewalDate.getMonth() + 3);
      } else if (billingCycle === 'semiannual') {
        renewalDate.setMonth(renewalDate.getMonth() + 6);
      }

      await this.pg.query(
        `INSERT INTO billing_events (
          tenant_id, event_type, source, order_number, 
          amount, currency, status, payload, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          tenant_id,
          'subscription_completed',
          'WALLET',
          orderNumber,
          price,
          'USD',
          'completed',
          JSON.stringify({
            subscription_type: subscriptionType,
            billing_cycle: billingCycle,
            unit_price: price,
            original_amount: price,
            discount_applied: 0,
            renewal_date: renewalDate.toISOString()
          }),
          now.toISOString()
        ]
      );

      // Crear o actualizar suscripción en la tabla subscriptions
      const billingCycles: { [key: string]: number } = {
        'monthly': 1,
        'quarterly': 3,
        'semiannual': 6
      };

      const months = billingCycles[billingCycle] || 1;
      const startDate = now;
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + months);

      // Verificar si ya existe una suscripción activa
      const existingSubQuery = `
        SELECT id FROM subscriptions 
        WHERE tenant_id = $1 AND status IN ('active', 'pending')
        LIMIT 1
      `;
      const existingSubResult = await this.pg.query(existingSubQuery, [tenant_id]);

      if (existingSubResult.rows.length > 0) {
        // Actualizar suscripción existente
        await this.pg.query(
          `UPDATE subscriptions 
           SET status = 'active', 
               current_period_start = $2,
               current_period_end = $3,
               updated_at = NOW()
           WHERE id = $1`,
          [existingSubResult.rows[0].id, startDate.toISOString(), endDate.toISOString()]
        );
      } else {
        // Crear nueva suscripción
        await this.pg.query(
          `INSERT INTO subscriptions (
            tenant_id, status, current_period_start, current_period_end, 
            subscription_type, billing_cycle, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            tenant_id,
            'active',
            startDate.toISOString(),
            endDate.toISOString(),
            subscriptionType,
            billingCycle
          ]
        );
      }

      // Obtener datos del usuario para enviar email
      try {
        const userQuery = `SELECT u.email, u.name FROM users u WHERE u.tenant_id = $1`;
        const userResult = await this.pg.query(userQuery, [tenant_id]);
        
        if (userResult.rows.length > 0) {
          const { email, name } = userResult.rows[0];
          
          // Enviar email de bienvenida de suscripción
          await this.emailService.sendSubscriptionWelcomeEmail({
            to: email,
            tenantName: name || 'Mayorista',
            billingCycle,
            price,
            renewalDate: endDate.toISOString()
          });
        }
      } catch (emailErr) {
        console.warn('⚠️ Error sending subscription email:', emailErr);
        // No fallar el pago si falla el email
      }

      return res.json({
        ok: true,
        order_number: orderNumber,
        message: `Suscripción activada hasta ${endDate.toLocaleDateString('es-ES')}`
      });
    } catch (err: any) {
      console.error('Error creating wallet subscription checkout:', err);
      throw new HttpException(err.message || 'Error al procesar pago con billetera', 500);
    }
  }

  @Post('cancel')
  async cancelSubscription(@Body() body: { subscription_id: string }, @Req() req: Request, @Res() res: Response) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    const { subscription_id } = body;
    if (!subscription_id) throw new HttpException('Subscription ID required', 400);

    try {
      // Verificar que la suscripción pertenece al tenant
      const checkQ = `SELECT id FROM subscriptions WHERE stripe_subscription_id = $1 AND tenant_id = $2`;
      const { rows } = await this.pg.query(checkQ, [subscription_id, tenant_id]);
      
      if (rows.length === 0) {
        throw new HttpException('Subscription not found or unauthorized', 404);
      }

      // Cancelar en Stripe (al final del período actual)
      await this.stripe.subscriptions.update(subscription_id, {
        cancel_at_period_end: true
      });

      // Actualizar en DB
      await this.pg.query(
        `UPDATE subscriptions SET status = 'canceled' WHERE stripe_subscription_id = $1`,
        [subscription_id]
      );

      return res.json({ 
        ok: true, 
        message: 'Suscripción cancelada. Tendrás acceso hasta el final del período actual.' 
      });
    } catch (err: any) {
      console.error('Error canceling subscription:', err);
      throw new HttpException(err.message || 'Error al cancelar suscripción', 500);
    }
  }
}