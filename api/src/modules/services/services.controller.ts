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

    // Crear orden pendiente
    const orderId = await this.createOrder(tenant_id, service);

    return res.json({
      order_id: orderId,
      service_id: serviceId,
      amount: service.price,
      currency: 'USD'
    });
  }

  private async createOrder(tenantId: number, service: any) {
    const q = `INSERT INTO billing_events (tenant_id, event_type, source, payload)
               VALUES ($1, 'renewal_pending', 'MANUAL', $2) RETURNING id`;
    const payload = {
      service_id: service.id,
      product_code: service.product_code,
      amount: service.price,
      currency: 'USD',
      status: 'pending'
    };
    const { rows } = await this.pg.query(q, [tenantId, JSON.stringify(payload)]);
    return rows[0].id;
  }
}