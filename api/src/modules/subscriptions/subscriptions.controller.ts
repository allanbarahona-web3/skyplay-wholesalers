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

    const billingCycles: { [key: string]: { displayName: string; interval_unit: string; frequency: number } } = {
      monthly: { displayName: 'Mensual', interval_unit: 'MONTH', frequency: 1 },
      quarterly: { displayName: '3 Meses', interval_unit: 'MONTH', frequency: 3 },
      semiannual: { displayName: '6 Meses', interval_unit: 'MONTH', frequency: 6 }
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
    const planName = `${productName} ${cycle.displayName}`;
    const planId = `SKYPLAY-${subscriptionType.toUpperCase()}-${billingCycle.toUpperCase()}-${Date.now()}`;

    try {
      // Crear plan de suscripción en PayPal
      const planResponse = await fetch('https://api-m.paypal.com/v1/billing/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getPayPalAccessToken()}`
        },
        body: JSON.stringify({
          product_id: process.env.PAYPAL_PRODUCT_ID || 'SKYPLAY_SUBSCRIPTIONS',
          name: planName,
          description: `Suscripción a ${productName}`,
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: {
                interval_unit: cycle.interval_unit,
                interval_count: cycle.frequency
              },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0, // 0 = indefinido (hasta que cancele)
              pricing_scheme: {
                fixed_price: {
                  value: price.toFixed(2),
                  currency_code: 'USD'
                }
              }
            }
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: 'CANCEL',
            payment_failure_threshold: 3
          }
        })
      });

      if (!planResponse.ok) {
        const errorData = await planResponse.json();
        console.error('PayPal plan creation error:', errorData);
        throw new HttpException('Error creating PayPal plan', 500);
      }

      const plan = await planResponse.json();

      // Crear suscripción con el plan
      const subscriptionResponse = await fetch('https://api-m.paypal.com/v1/billing/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getPayPalAccessToken()}`
        },
        body: JSON.stringify({
          plan_id: plan.id,
          custom_id: `tenant_${tenant_id}`,
          application_context: {
            brand_name: 'Skyplay',
            locale: 'es-ES',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'SUBSCRIBE_NOW',
            payment_method: {
              payer_selected: 'PAYPAL',
              payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
            },
            return_url: `${process.env.FRONTEND_URL}/panel?payment=success&type=subscription&provider=paypal&subscription_type=${subscriptionType}`,
            cancel_url: `${process.env.FRONTEND_URL}/panel?payment=cancel`
          }
        })
      });

      if (!subscriptionResponse.ok) {
        const errorData = await subscriptionResponse.json();
        console.error('PayPal subscription creation error:', errorData);
        throw new HttpException('Error creating PayPal subscription', 500);
      }

      const subscription = await subscriptionResponse.json();
      
      // Obtener URL de aprobación
      const approveLink = subscription.links.find((link: any) => link.rel === 'approve');
      
      if (!approveLink) {
        throw new HttpException('No approval link found', 500);
      }

      // Guardar referencia de la suscripción pendiente
      await this.pg.query(
        `INSERT INTO billing_events (tenant_id, event_type, source, order_number, payload)
         VALUES ($1, 'subscription_pending', 'PAYPAL', $2, $3)`,
        [
          tenant_id,
          subscription.id,
          JSON.stringify({
            subscription_type: subscriptionType,
            billing_cycle: billingCycle,
            price,
            paypal_plan_id: plan.id,
            paypal_subscription_id: subscription.id,
            status: 'pending'
          })
        ]
      );

      return res.json({
        checkout_url: approveLink.href,
        order_number: subscription.id
      });
    } catch (err: any) {
      console.error('Error creating PayPal subscription checkout:', err);
      throw new HttpException(err.message || 'Error al crear checkout PayPal', 500);
    }
  }

  // Helper para obtener token de PayPal
  private async getPayPalAccessToken(): Promise<string> {
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const data = await response.json();
    return data.access_token;
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

    let { subscriptionType, billingCycle, price } = body;
    if (!subscriptionType || !billingCycle || price <= 0) {
      throw new HttpException('Invalid subscription data', 400);
    }

    // Mapear valores del frontend a valores válidos del enum subscription_product_type
    const typeMapping: { [key: string]: string } = {
      'subscription-pref': 'preferential',
      'crm-basic': 'crm-pro',
      'crm-pro': 'crm-pro',
      'preferential': 'preferential',
      'tienda': 'tienda'
    };
    
    const mappedType = typeMapping[subscriptionType] || subscriptionType;

    const orderNumber = `SUB-WALLET-${Date.now()}`;
    
    try {
      // Obtener balance de la billetera del usuario desde tenants
      const walletQuery = `SELECT wallet_balance FROM tenants WHERE id = $1`;
      const walletResult = await this.pg.query(walletQuery, [tenant_id]);
      
      if (walletResult.rows.length === 0) {
        throw new HttpException('Tenant not found', 404);
      }

      const walletBalance = parseFloat(walletResult.rows[0].wallet_balance || 0);

      // Verificar si tiene suficiente saldo
      if (walletBalance < price) {
        throw new HttpException(
          `Saldo insuficiente. Tienes $${walletBalance.toFixed(2)}, necesitas $${price.toFixed(2)}`,
          402
        );
      }

      // Descontar de la billetera
      await this.pg.query(
        `UPDATE tenants SET wallet_balance = wallet_balance - $1 WHERE id = $2`,
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
          tenant_id, event_type, source, order_number, payload
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          tenant_id,
          'subscription_completed',
          'WALLET',
          orderNumber,
          JSON.stringify({
            subscription_type: subscriptionType,
            billing_cycle: billingCycle,
            unit_price: price,
            original_amount: price,
            discount_applied: 0,
            renewal_date: renewalDate.toISOString()
          })
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

      // Verificar si ya existe una suscripción para este tenant
      const existingSubQuery = `
        SELECT id FROM subscriptions 
        WHERE tenant_id = $1
        LIMIT 1
      `;
      const existingSubResult = await this.pg.query(existingSubQuery, [tenant_id]);

      if (existingSubResult.rows.length > 0) {
        // Actualizar suscripción existente
        await this.pg.query(
          `UPDATE subscriptions 
           SET status = 'active', 
               current_period_end = $2,
               product_type = $3,
               billing_cycle = $4,
               updated_at = NOW()
           WHERE id = $1`,
          [existingSubResult.rows[0].id, endDate.toISOString(), mappedType, billingCycle]
        );
      } else {
        // Crear nueva suscripción
        await this.pg.query(
          `INSERT INTO subscriptions (
            tenant_id, status, current_period_end, 
            product_type, billing_cycle, provider
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            tenant_id,
            'active',
            endDate.toISOString(),
            mappedType,
            billingCycle,
            'manual'
          ]
        );
      }

      // Obtener datos del usuario para enviar email
      try {
        const userQuery = `
          SELECT u.email, t.name 
          FROM users u 
          JOIN tenants t ON t.id = u.tenant_id 
          WHERE u.tenant_id = $1
          LIMIT 1
        `;
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

  // ========== OPCIONES DE CANCELACIÓN ==========

  @Post('pause')
  async pauseSubscription(@Req() req: Request, @Res() res: Response) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    try {
      // Obtener suscripción actual
      const subResult = await this.pg.query(
        `SELECT stripe_subscription_id, current_period_end, status, provider 
         FROM subscriptions 
         WHERE tenant_id = $1 AND status = 'active'`,
        [tenant_id]
      );

      if (subResult.rows.length === 0) {
        throw new HttpException('No active subscription found', 404);
      }

      const { stripe_subscription_id, current_period_end, provider } = subResult.rows[0];

      // Calcular días restantes
      const now = new Date();
      const endDate = new Date(current_period_end);
      const remainingDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Solo pausar en Stripe/PayPal si NO es manual
      if (provider !== 'manual') {
        if (stripe_subscription_id && stripe_subscription_id.startsWith('sub_')) {
          // Es de Stripe - pausar
          await this.stripe.subscriptions.update(stripe_subscription_id, {
            pause_collection: { behavior: 'void' }
          });
        } else if (stripe_subscription_id && stripe_subscription_id.startsWith('I-')) {
          // Es de PayPal - suspender
          const accessToken = await this.getPayPalAccessToken();
          await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${stripe_subscription_id}/suspend`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              reason: 'User requested pause'
            })
          });
        }
      }

      // Actualizar en DB
      await this.pg.query(
        `UPDATE subscriptions 
         SET status = 'paused', 
             remaining_days = $1, 
             paused_at = NOW(),
             current_period_end = NULL
         WHERE tenant_id = $2`,
        [remainingDays, tenant_id]
      );

      return res.json({
        ok: true,
        message: `Suscripción pausada. Tienes ${remainingDays} días guardados para cuando reactives.`,
        remaining_days: remainingDays
      });
    } catch (err: any) {
      console.error('Error pausing subscription:', err);
      throw new HttpException(err.message || 'Error al pausar suscripción', 500);
    }
  }

  @Post('resume')
  async resumeSubscription(@Req() req: Request, @Res() res: Response) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    try {
      // Obtener suscripción pausada
      const subResult = await this.pg.query(
        `SELECT stripe_subscription_id, remaining_days, status, provider 
         FROM subscriptions 
         WHERE tenant_id = $1 AND status = 'paused'`,
        [tenant_id]
      );

      if (subResult.rows.length === 0) {
        throw new HttpException('No paused subscription found', 404);
      }

      const { stripe_subscription_id, remaining_days, provider } = subResult.rows[0];

      // Calcular nueva fecha de expiración
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + (remaining_days || 0));

      // Solo reactivar en Stripe/PayPal si NO es manual
      if (provider !== 'manual') {
        if (stripe_subscription_id && stripe_subscription_id.startsWith('sub_')) {
          // Es de Stripe - reactivar
          await this.stripe.subscriptions.update(stripe_subscription_id, {
            pause_collection: null as any
          });
        } else if (stripe_subscription_id && stripe_subscription_id.startsWith('I-')) {
          // Es de PayPal - activar
          const accessToken = await this.getPayPalAccessToken();
          await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${stripe_subscription_id}/activate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              reason: 'User resumed subscription'
            })
          });
        }
      }

      // Actualizar en DB
      await this.pg.query(
        `UPDATE subscriptions 
         SET status = 'active', 
             current_period_end = $1,
             remaining_days = NULL,
             paused_at = NULL
         WHERE tenant_id = $2`,
        [newEndDate, tenant_id]
      );

      return res.json({
        ok: true,
        message: `Suscripción reactivada hasta ${newEndDate.toLocaleDateString('es-ES')}`,
        new_end_date: newEndDate.toISOString()
      });
    } catch (err: any) {
      console.error('Error resuming subscription:', err);
      throw new HttpException(err.message || 'Error al reactivar suscripción', 500);
    }
  }

  @Post('cancel-at-period-end')
  async cancelAtPeriodEnd(@Req() req: Request, @Res() res: Response) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    try {
      // Obtener suscripción actual
      const subResult = await this.pg.query(
        `SELECT stripe_subscription_id, current_period_end, status, provider 
         FROM subscriptions 
         WHERE tenant_id = $1 AND status = 'active'`,
        [tenant_id]
      );

      if (subResult.rows.length === 0) {
        throw new HttpException('No active subscription found', 404);
      }

      const { stripe_subscription_id, current_period_end, provider } = subResult.rows[0];

      // Solo cancelar en Stripe/PayPal si NO es manual
      if (provider !== 'manual') {
        if (stripe_subscription_id && stripe_subscription_id.startsWith('sub_')) {
          // Es de Stripe
          await this.stripe.subscriptions.update(stripe_subscription_id, {
            cancel_at_period_end: true
          });
        } else if (stripe_subscription_id && stripe_subscription_id.startsWith('I-')) {
          // Es de PayPal - cancelar
          const accessToken = await this.getPayPalAccessToken();
          await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${stripe_subscription_id}/cancel`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              reason: 'User requested cancellation at period end'
            })
          });
        }
      }

      // Actualizar en DB
      await this.pg.query(
        `UPDATE subscriptions 
         SET cancel_at_period_end = true
         WHERE tenant_id = $1`,
        [tenant_id]
      );

      return res.json({
        ok: true,
        message: `Tu suscripción se cancelará el ${new Date(current_period_end).toLocaleDateString('es-ES')}. Seguirás disfrutando los beneficios hasta esa fecha.`,
        end_date: current_period_end
      });
    } catch (err: any) {
      console.error('Error scheduling cancellation:', err);
      throw new HttpException(err.message || 'Error al programar cancelación', 500);
    }
  }

  @Post('cancel-immediately')
  async cancelImmediately(@Req() req: Request, @Res() res: Response) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    try {
      // Obtener suscripción actual
      const subResult = await this.pg.query(
        `SELECT stripe_subscription_id, status, provider 
         FROM subscriptions 
         WHERE tenant_id = $1 AND (status = 'active' OR status = 'paused')`,
        [tenant_id]
      );

      if (subResult.rows.length === 0) {
        throw new HttpException('No subscription found', 404);
      }

      const { stripe_subscription_id, provider } = subResult.rows[0];

      // Solo cancelar en Stripe/PayPal si NO es manual
      if (provider !== 'manual') {
        if (stripe_subscription_id && stripe_subscription_id.startsWith('sub_')) {
          // Es de Stripe - cancelar ahora
          await this.stripe.subscriptions.cancel(stripe_subscription_id);
        } else if (stripe_subscription_id && stripe_subscription_id.startsWith('I-')) {
          // Es de PayPal - cancelar
          const accessToken = await this.getPayPalAccessToken();
          await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${stripe_subscription_id}/cancel`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              reason: 'User requested immediate cancellation'
            })
          });
        }
      }

      // Actualizar en DB - marcar como cancelada inmediatamente
      await this.pg.query(
        `UPDATE subscriptions 
         SET status = 'canceled', 
             current_period_end = NOW(),
             cancel_at_period_end = false,
             remaining_days = NULL
         WHERE tenant_id = $1`,
        [tenant_id]
      );

      return res.json({
        ok: true,
        message: 'Suscripción cancelada inmediatamente. Ya no tienes acceso a los beneficios.'
      });
    } catch (err: any) {
      console.error('Error canceling immediately:', err);
      throw new HttpException(err.message || 'Error al cancelar inmediatamente', 500);
    }
  }

  @Post('revert-cancellation')
  async revertCancellation(@Req() req: Request, @Res() res: Response) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    try {
      // Revertir la cancelación programada
      await this.pg.query(
        `UPDATE subscriptions 
         SET cancel_at_period_end = false
         WHERE tenant_id = $1`,
        [tenant_id]
      );

      return res.json({
        ok: true,
        message: 'Cancelación revertida. Tu suscripción continuará renovándose automáticamente.'
      });
    } catch (err: any) {
      console.error('Error reverting cancellation:', err);
      throw new HttpException(err.message || 'Error al revertir cancelación', 500);
    }
  }

  @Post('cancel')
  async cancelSubscription(@Body() body: { subscription_id: string }, @Req() req: Request, @Res() res: Response) {
    // Mantener endpoint antiguo por compatibilidad - redirige a cancel-at-period-end
    return this.cancelAtPeriodEnd(req, res);
  }
}