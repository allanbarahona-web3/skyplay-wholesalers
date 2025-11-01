// src/modules/me/me.controller.ts
import { Controller, Get, Req, HttpException, Inject, Param, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Pool } from 'pg';
import { AuthGuard, JWTPayload } from '../../guards/auth.guard';

@Controller('me')
@UseGuards(AuthGuard) // Proteger TODOS los endpoints de /me
export class MeController {
  constructor(@Inject('PG_POOL') private readonly pg: Pool) {}

  @Get('products/:code/price')
async getProductPrice(@Param('code') code: string) {
  const q = `SELECT code, name, price FROM products WHERE code = $1 LIMIT 1`;
  const { rows } = await this.pg.query(q, [code]);
  
  if (!rows[0]) {
    throw new HttpException('Producto no encontrado', 404);
  }
  
  return rows[0];
}

  @Get('overview')
async overview(@Req() req: Request) {
  // El AuthGuard ya validó el token y agregó el user al request
  const payload = (req as any).user as JWTPayload;
  const { id: userId, tenant_id, role } = payload;

  // Obtener datos del usuario
  const userQuery = `SELECT id, email, role, created_at FROM users WHERE id = $1`;
  const { rows: userRows } = await this.pg.query(userQuery, [userId]);
  const user = userRows[0];

  if (!user) {
    throw new HttpException('Usuario no encontrado', 404);
  }

  // Si no tiene tenant_id, retornar datos básicos
  if (!tenant_id) {
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
      tenant_id: null,
      branding: {},
      wholesaler: { status: 'pending' },
      subscription: { status: 'none', current_period_end: null },
      active_services: [],
      last_orders: [],
    };
  }

  // Branding
  const confQ = `SELECT branding FROM tenant_configs WHERE tenant_id = $1 LIMIT 1`;
  const conf = await this.pg.query(confQ, [tenant_id]);
  const branding = conf.rows[0]?.branding || {};

  // Subscription
  const subQ = `SELECT status, current_period_end, stripe_subscription_id FROM subscriptions WHERE tenant_id=$1 LIMIT 1`;
  const sub = await this.pg.query(subQ, [tenant_id]);
  const subscription = sub.rows[0] || { status: 'none', current_period_end: null };

  // Wholesaler status
  const tenQ = `SELECT name, status FROM tenants WHERE id=$1 LIMIT 1`;
  const ten = await this.pg.query(tenQ, [tenant_id]);
  const wholesaler = { 
    name: ten.rows[0]?.name || 'Mayorista',
    status: ten.rows[0]?.status || 'active' 
  };

  // Services activos CON credenciales
  const srvQ = `
    SELECT 
      s.id, 
      s.external_ref, 
      s.product_code,
      COALESCE(p.name, s.product_code) AS product_name,
      s.status, 
      s.expires_at,
      c.email AS credential_email,
      c.password AS credential_password,
      c.profile_name,
      c.pin
    FROM services s
    LEFT JOIN products p ON s.product_code = p.code
    LEFT JOIN credentials c ON s.credential_id = c.id
    WHERE s.tenant_id=$1
    ORDER BY s.expires_at ASC
    LIMIT 50
  `;
  const services = await this.pg.query(srvQ, [tenant_id]);

 const ordQ = `
  SELECT 
    be.id,
    be.order_number,
    be.received_at AS created_at,
    (be.payload->>'amount')::numeric AS total_amount,
    COALESCE(be.payload->>'currency','USD') AS currency,
    COALESCE(
      be.payload->>'status',
      CASE 
        WHEN be.event_type = 'renewal_completed' THEN 'completed'
        WHEN be.event_type = 'payment_succeeded' THEN 'completed'
        WHEN be.event_type = 'renewal_pending' THEN 'pending'
        ELSE be.event_type
      END
    ) AS status,
    be.source,
    s.product_code,
    COALESCE(p.name, s.product_code) AS product_name,
    c.email AS credential_email
  FROM billing_events be
  LEFT JOIN services s ON (be.payload->>'service_id')::uuid = s.id
  LEFT JOIN products p ON s.product_code = p.code
  LEFT JOIN credentials c ON s.credential_id = c.id
  WHERE be.tenant_id=$1
  AND be.event_type IN ('renewal_completed', 'renewal_pending', 'payment_succeeded')
  ORDER BY be.received_at DESC
  LIMIT 10
`;
const orders = await this.pg.query(ordQ, [tenant_id]);
  

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    tenant_id,
    tenant_name: wholesaler.name,
    store_active: false,
    branding,
    wholesaler,
    subscription,
    active_services: services.rows,
    last_orders: orders.rows,
  };
}
}
