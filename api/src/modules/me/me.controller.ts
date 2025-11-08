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
  
  return {
    code: rows[0].code,
    name: rows[0].name,
    price: parseFloat(rows[0].price) || 0
  };
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

  // Wholesaler status y wallet balance
  const tenQ = `SELECT name, status, wallet_balance FROM tenants WHERE id=$1 LIMIT 1`;
  const ten = await this.pg.query(tenQ, [tenant_id]);
  const wholesaler = { 
    name: ten.rows[0]?.name || 'Mayorista',
    status: ten.rows[0]?.status || 'active' 
  };
  const wallet_balance = parseFloat(ten.rows[0]?.wallet_balance || '0');

  // Services activos CON credenciales Y precios reales de órdenes
  const srvQ = `
    SELECT 
      s.id, 
      s.external_ref, 
      s.product_code,
      COALESCE(p.name, s.product_code) AS product_name,
      COALESCE(p.price::numeric, 0) AS price,
      COALESCE(
        (SELECT (payload->>'unit_price')::numeric FROM billing_events 
         WHERE tenant_id=$1 AND (
           (payload->>'service_id')::uuid = s.id 
           OR payload->'service_ids' @> to_jsonb(s.id::text)
         )
         ORDER BY received_at DESC LIMIT 1),
        0
      ) AS paid_price,
      s.status, 
      s.expires_at,
      s.created_at,
      c.email AS credential_email,
      c.password AS credential_password,
      c.profile_name,
      c.pin
    FROM services s
    LEFT JOIN products p ON s.product_code = p.code
    LEFT JOIN credentials c ON s.credential_id = c.id
    WHERE s.tenant_id=$1
    ORDER BY s.created_at DESC
    LIMIT 200
  `;
  const services = await this.pg.query(srvQ, [tenant_id]);
  
  // DEBUG: Ver qué precios está devolviendo la query
  console.log('🔍 Services query result (first 2):');
  services.rows.slice(0, 2).forEach(s => {
    console.log(`  Product: ${s.product_code}, Catalog Price: ${s.price}, Paid Price: ${s.paid_price}`);
  });

  // No necesitamos calcular descuentos aquí - el paid_price YA tiene el descuento aplicado
  // Solo devolvemos los servicios como están
  const servicesWithPrices = services.rows.map((svc: any) => {
    const catalogPrice = parseFloat(svc.price) || 0;
    const paidPrice = parseFloat(svc.paid_price) || 0;
    
    return {
      id: svc.id,
      external_ref: svc.external_ref,
      product_code: svc.product_code,
      product_name: svc.product_name,
      status: svc.status,
      expires_at: svc.expires_at,
      created_at: svc.created_at,
      credential_email: svc.credential_email,
      credential_password: svc.credential_password,
      profile_name: svc.profile_name,
      pin: svc.pin,
      price: catalogPrice, // Precio del catálogo
      paid_price: paidPrice, // Precio pagado (con descuento si aplica)
      discounted_price: paidPrice // Alias para claridad en frontend
    };
  });
  
  // DEBUG: Ver qué se está devolviendo al frontend
  console.log('📤 Sending to frontend - Services count:', servicesWithPrices.length);
  servicesWithPrices.slice(0, 3).forEach((svc: any, i: number) => {
    console.log(`  [${i}] ${svc.product_name}: price=${svc.price} (type: ${typeof svc.price}), discounted=${svc.discounted_price} (type: ${typeof svc.discounted_price})`);
  });

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
    COALESCE(p.name, s.product_code, be.payload->>'product_name') AS product_name,
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
    wallet_balance,
    active_services: servicesWithPrices,
    last_orders: orders.rows,
  };
}

  @Get('orders/:orderNumber/credentials')
  async getOrderCredentials(@Param('orderNumber') orderNumber: string, @Req() req: Request) {
    const payload = (req as any).user as JWTPayload;
    const { tenant_id } = payload;

    console.log(`🔍 Looking for order: ${orderNumber} for tenant: ${tenant_id}`);

    if (!tenant_id) {
      throw new HttpException('No autorizado', 403);
    }

    // Primero buscar sin filtrar por event_type para ver el estado real
    const debugQuery = `
      SELECT id, event_type, payload, source
      FROM billing_events 
      WHERE tenant_id = $1
        AND (payload->>'order_number' = $2 OR order_number = $2)
      ORDER BY id DESC 
      LIMIT 1
    `;
    const { rows: debugRows } = await this.pg.query(debugQuery, [tenant_id, orderNumber]);
    
    console.log(`📊 Debug search result: ${debugRows.length} orders found`);
    if (debugRows.length > 0) {
      console.log(`📝 Order details: ID=${debugRows[0].id}, Type=${debugRows[0].event_type}, Source=${debugRows[0].source}`);
    }

    // Ahora buscar solo pedidos completados
    const orderQuery = `
      SELECT id, event_type, payload 
      FROM billing_events 
      WHERE tenant_id = $1
        AND (payload->>'order_number' = $2 OR order_number = $2)
        AND event_type = 'purchase_completed'
      ORDER BY id DESC 
      LIMIT 1
    `;
    const { rows: orderRows } = await this.pg.query(orderQuery, [tenant_id, orderNumber]);

    console.log(`📦 Found ${orderRows.length} COMPLETED orders`);

    if (orderRows.length === 0) {
      if (debugRows.length > 0) {
        console.log(`⚠️ Order exists but status is: ${debugRows[0].event_type} (not completed yet)`);
        throw new HttpException(`Pedido en proceso (${debugRows[0].event_type}). Por favor espera unos segundos.`, 202);
      } else {
        console.log(`❌ Order ${orderNumber} not found in database`);
        throw new HttpException('Pedido no encontrado', 404);
      }
    }

    const order = orderRows[0];
    const payload_data = order.payload;

    // Obtener los servicios creados para este pedido
    // Usar solo tenant_id y product_code, obtener los más recientes por cantidad
    const servicesQuery = `
      SELECT 
        s.id,
        s.product_code,
        s.status,
        s.expires_at,
        c.email,
        c.password,
        c.profile_name,
        c.pin,
        p.name as product_name
      FROM services s
      JOIN credentials c ON s.credential_id = c.id
      JOIN products p ON s.product_code = p.code
      WHERE s.tenant_id = $1 
        AND s.product_code = $2
      ORDER BY s.id DESC
      LIMIT $3
    `;

    const quantity = parseInt(payload_data.quantity || '1');
    const productCode = payload_data.product_code;

    const { rows: services } = await this.pg.query(servicesQuery, [
      tenant_id,
      productCode,
      quantity
    ]);

    if (services.length === 0) {
      throw new HttpException('No se encontraron credenciales para este pedido', 404);
    }

    return {
      order_number: orderNumber,
      product_name: services[0].product_name,
      product_code: productCode,
      quantity,
      total_price: parseFloat(payload_data.total_price || '0'),
      discount_applied: payload_data.discount_applied ? parseFloat(payload_data.discount_applied) * 100 : 0,
      created_at: order.created_at,
      credentials: services.map(s => ({
        email: s.email,
        password: s.password,
        profile_name: s.profile_name,
        pin: s.pin,
        expires_at: s.expires_at,
      })),
    };
  }
}
