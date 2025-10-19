// src/modules/services/services.controller.ts
import { Controller, Get, Post, Param, Body, Res, Req, HttpException, Inject } from '@nestjs/common';
import { Response, Request } from 'express';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';


@Controller('services')
export class ServicesController {
  constructor(@Inject('PG_POOL') private readonly pg: Pool) {}
  

  @Post(':id/renew')
  async renew(@Param('id') id: string, @Req() req: Request) {
    const raw = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'sky_sid'];
    if (!raw) throw new HttpException('Unauthorized', 401);
    const { tenant_id } = jwt.verify(raw, process.env.JWT_SECRET!) as any;

    // verifica que el servicio sea del tenant
    const { rows } = await (this.pg as any).query(
      `SELECT id FROM services WHERE id=$1 AND tenant_id=$2 LIMIT 1`,
      [id, tenant_id],
    );
    if (!rows[0]) throw new HttpException('Not Found', 404);

    // Aquí crearías una orden y generarías checkout_url (Stripe/Coinpal)
    // Por ahora, devuelve objeto vacío para probar el panel (mostrará "Renovación registrada")
    return {};
    // O si ya tienes un link:
    // return { checkout_url: 'https://pay.stripe.com/...' };
  }
}
