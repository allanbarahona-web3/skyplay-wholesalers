// src/modules/me/me.controller.ts
import { Controller, Get, Req, HttpException, Inject } from '@nestjs/common';
import { Request } from 'express';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';

type JWTPayload = { id: number; tenant_id: number | null; role: string };

@Controller('me')
export class MeController {
  constructor(@Inject('PG_POOL') private readonly pg: Pool) {}

  @Get('overview')
  async overview(@Req() req: Request) {
    // Verificar cookie JWT
    const raw = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];
    if (!raw) throw new HttpException('No autorizado', 401);

    let payload: JWTPayload;
    try {
      payload = jwt.verify(raw, process.env.JWT_SECRET!) as JWTPayload;
    } catch {
      throw new HttpException('Token inválido', 401);
    }

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
    const subQ = `SELECT status, current_period_end FROM subscriptions WHERE tenant_id=$1 LIMIT 1`;
    const sub = await this.pg.query(subQ, [tenant_id]);
    const subscription = sub.rows[0] || { status: 'none', current_period_end: null };

    // Wholesaler status
    const tenQ = `SELECT name, status FROM tenants WHERE id=$1 LIMIT 1`;
const ten = await this.pg.query(tenQ, [tenant_id]);
const wholesaler = { 
  name: ten.rows[0]?.name || 'Mayorista',
  status: ten.rows[0]?.status || 'active' 
};

    // Services activos
    const srvQ = `
      SELECT 
        s.id, 
        s.external_ref, 
        s.product_code,
        COALESCE(p.name, s.product_code) AS product_name,
        s.status, 
        s.expires_at
      FROM services s
      LEFT JOIN products p ON s.product_code = p.code
      WHERE s.tenant_id=$1
      ORDER BY s.expires_at ASC
      LIMIT 50
    `;
    const services = await this.pg.query(srvQ, [tenant_id]);

    // Last orders
    const ordQ = `
      SELECT 
        id, 
        received_at AS created_at,
        (payload->>'amount')::numeric AS total_amount,
        COALESCE(payload->>'currency','USD') AS currency,
        COALESCE(payload->>'status', event_type) AS status,
        source
      FROM billing_events
      WHERE tenant_id=$1
      ORDER BY received_at DESC
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
      store_active: false,  // ← AGREGAR ESTO (por ahora siempre false)
      branding,
      wholesaler,
      subscription,
      active_services: services.rows,
      last_orders: orders.rows,
    };
  }
}
