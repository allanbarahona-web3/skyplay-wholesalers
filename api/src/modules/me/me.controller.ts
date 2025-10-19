// src/modules/me/me.controller.ts
import { Controller, Get, Post, Body, Res, Req, HttpException, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';


@Controller('me')
export class MeController {
  constructor(@Inject('PG_POOL') private readonly pg: Pool) {}
  
  

  @Get('overview')
  async overview(@Req() req: Request) {
    const raw = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];
    if (!raw) throw new HttpException('Unauthorized', 401);
    const { tenant_id } = jwt.verify(raw, process.env.JWT_SECRET!) as any;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    // branding
    const confQ = `SELECT branding FROM tenant_configs WHERE tenant_id = $1 LIMIT 1`;
    const conf = await (this.pg as any).query(confQ, [tenant_id]);
    const branding = conf.rows[0]?.branding || {};

    // subscription
    const subQ = `SELECT status, current_period_end FROM subscriptions WHERE tenant_id=$1 LIMIT 1`;
    const sub = await (this.pg as any).query(subQ, [tenant_id]);
    const subscription = sub.rows[0] || { status: 'none', current_period_end: null };

    // wholesaler status (kill switch) desde tenants.status
    const tenQ = `SELECT status FROM tenants WHERE id=$1 LIMIT 1`;
    const ten = await (this.pg as any).query(tenQ, [tenant_id]);
    const wholesaler = { status: ten.rows[0]?.status || 'active' };

    // services (activos o próximos a vencer)
    const srvQ = `
      SELECT id, external_ref, product_code, status, expires_at
      FROM services
      WHERE tenant_id=$1
      ORDER BY expires_at ASC
      LIMIT 50`;
    const services = await (this.pg as any).query(srvQ, [tenant_id]);

    // last orders → a partir de billing_events (si luego tienes tabla orders, la usamos)
    const ordQ = `
      SELECT id, received_at AS created_at,
             (payload->>'amount')::numeric AS total_amount,
             COALESCE(payload->>'currency','USD') AS currency,
             COALESCE(payload->>'status', event_type) AS status,
             source
      FROM billing_events
      WHERE tenant_id=$1
      ORDER BY received_at DESC
      LIMIT 10`;
    const orders = await (this.pg as any).query(ordQ, [tenant_id]);

    return {
      branding,
      wholesaler,
      subscription,
      active_services: services.rows,
      last_orders: orders.rows,
    };
  }
}
