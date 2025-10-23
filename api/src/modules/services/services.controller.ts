// src/modules/services/services.controller.ts
import { Controller, Get, Post, Param, Body, Res, Req, HttpException, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';

type JWTPayload = { id: number; tenant_id: number | null; role: string };


@Controller('services')
export class ServicesController {
  constructor(@Inject('PG_POOL') private readonly pg: Pool) {}
  

  @Post(':id/renew')
async renew(@Param('id') serviceId: string, @Req() req: Request, @Res() res: Response) {
  const raw = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];
  if (!raw) throw new HttpException('Unauthorized', 401);
  
  const { tenant_id } = jwt.verify(raw, process.env.JWT_SECRET!) as JWTPayload;
  if (!tenant_id) throw new HttpException('Unauthorized', 401);

  // Obtener servicio
  const srvQ = `SELECT s.*, p.price FROM services s 
                LEFT JOIN products p ON s.product_code = p.code 
                WHERE s.id = $1 AND s.tenant_id = $2`;
  const { rows } = await this.pg.query(srvQ, [serviceId, tenant_id]);
  const service = rows[0];

  if (!service) throw new HttpException('Service not found', 404);

  // Verificar si tiene suscripción activa
  const subQ = `SELECT status FROM subscriptions WHERE tenant_id = $1 AND status = 'active' LIMIT 1`;
  const { rows: subRows } = await this.pg.query(subQ, [tenant_id]);
  const hasActiveSubscription = subRows.length > 0;

  // Aplicar descuento
  const originalPrice = parseFloat(service.price);
  const discount = hasActiveSubscription ? 0.30 : 0;
  const finalPrice = originalPrice * (1 - discount);

  // Crear orden con precio final
  const orderId = await this.createOrder(tenant_id, service, finalPrice);

  return res.json({
    order_id: orderId,
    service_id: serviceId,
    amount: finalPrice,
    original_amount: originalPrice,
    discount_applied: discount,
    currency: 'USD'
  });
}

private async createOrder(tenantId: number, service: any, finalPrice: number) {
  const q = `INSERT INTO billing_events (tenant_id, event_type, source, payload)
             VALUES ($1, 'renewal_pending', 'MANUAL', $2) RETURNING id`;
  const payload = {
    service_id: service.id,
    product_code: service.product_code,
    amount: finalPrice,
    original_amount: parseFloat(service.price),
    currency: 'USD',
    status: 'pending'
  };
  const { rows } = await this.pg.query(q, [tenantId, JSON.stringify(payload)]);
  return rows[0].id;
}

 @Post(':id/checkout')
async createCheckout(@Param('id') serviceId: string, @Req() req: Request, @Res() res: Response) {
  console.log('>>> createCheckout called for serviceId=', serviceId);
  const raw = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];
  if (!raw) throw new HttpException('Unauthorized', 401);
  
  const { tenant_id } = jwt.verify(raw, process.env.JWT_SECRET!) as JWTPayload;
  if (!tenant_id) throw new HttpException('Unauthorized', 401);

  // Obtener orden pendiente y precio
  const ordQ = `SELECT be.id as order_id, be.payload, p.price, p.name as product_name
                FROM billing_events be
                JOIN services s ON (be.payload->>'service_id')::uuid = s.id
                JOIN products p ON s.product_code = p.code
                WHERE (be.payload->>'service_id')::uuid = $1 
                AND be.tenant_id = $2 
                AND be.event_type = 'renewal_pending'
                ORDER BY be.received_at DESC LIMIT 1`;
  
  const { rows } = await this.pg.query(ordQ, [serviceId, tenant_id]);
  const order = rows[0];
  
  if (!order) throw new HttpException('Order not found', 404);

  // Verificar si tiene suscripción activa
  const subQ = `SELECT status FROM subscriptions WHERE tenant_id = $1 AND status = 'active' LIMIT 1`;
  const { rows: subRows } = await this.pg.query(subQ, [tenant_id]);
  const hasActiveSubscription = subRows.length > 0;

  // Aplicar descuento del 30% si tiene suscripción
  const discount = hasActiveSubscription ? 0.30 : 0;
  const originalPrice = parseFloat(order.price);
  const finalPrice = originalPrice * (1 - discount);

  console.log(`Subscription active: ${hasActiveSubscription}, Original: $${originalPrice}, Final: $${finalPrice}`);

  // Generar order number único
  const orderNumber = this.generateOrderNumber();
  
  // Guardar order number en DB
  await this.pg.query(
    `UPDATE billing_events SET order_number = $1 WHERE id = $2`,
    [orderNumber, order.order_id]
  );

  // Crear Stripe Checkout
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { 
          name: `Orden #${orderNumber}`,
          description: hasActiveSubscription 
            ? 'Servicio digital - Con descuento preferencial (-30%)'
            : 'Servicio digital - Renovación mensual'
        },
        unit_amount: Math.round(finalPrice * 100)
      },
      quantity: 1
    }],
    mode: 'payment',
    metadata: {
      order_id: order.order_id,
      order_number: orderNumber,
      service_id: serviceId,
      tenant_id: tenant_id.toString(),
      order_type: 'renewal'
    },
    success_url: `${process.env.FRONTEND_URL}/panel_mayorista.html?payment=success&order=${orderNumber}`,
    cancel_url: `${process.env.FRONTEND_URL}/panel_mayorista.html?payment=cancel`
  });

  return res.json({ checkout_url: session.url, order_number: orderNumber });

  }

  private generateOrderNumber(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 7; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}