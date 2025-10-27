import { Controller, Post, Body, Req, Res, HttpException, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';
import Stripe from 'stripe';

type JWTPayload = { id: number; tenant_id: number | null; role: string };

@Controller('subscriptions')
export class SubscriptionsController {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  constructor(@Inject('PG_POOL') private readonly pg: Pool) {}

  @Post('checkout')
  async createCheckout(@Body() body: { plan: string }, @Req() req: Request, @Res() res: Response) {
    const raw = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];
    if (!raw) throw new HttpException('Unauthorized', 401);
    
    const { tenant_id } = jwt.verify(raw, process.env.JWT_SECRET!) as JWTPayload;
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
  @Post('cancel')
  async cancelSubscription(@Body() body: { subscription_id: string }, @Req() req: Request, @Res() res: Response) {
    const raw = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];
    if (!raw) throw new HttpException('Unauthorized', 401);
    
    const { tenant_id } = jwt.verify(raw, process.env.JWT_SECRET!) as JWTPayload;
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