// src/modules/services/services.controller.ts
import { Controller, Get, Post, Param, Body, Res, Req, HttpException, Inject, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { Pool } from 'pg';
import { AuthGuard, JWTPayload } from '../../guards/auth.guard';
import { EmailService } from '../email/email.service';


@Controller('services')
export class ServicesController {
  constructor(
    @Inject('PG_POOL') private readonly pg: Pool,
    private readonly emailService: EmailService
  ) {}
  
  // Endpoint público para obtener catálogo completo (SIN GUARD - es público)
  @Get('catalog')
  async getCatalog(@Res() res: Response) {
    try {
      const { rows } = await this.pg.query(
        `SELECT code, name, category, price, stock FROM products ORDER BY category, name`
      );
      return res.json(rows);
    } catch (error) {
      console.error('Error getting catalog:', error);
      throw new HttpException('Error fetching catalog', 500);
    }
  }

  // Endpoint para comprar un producto del catálogo
  @Post('purchase')
  @UseGuards(AuthGuard)
  async purchaseProduct(
    @Body() body: { product_code: string; quantity?: number },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { tenant_id } = (req as any).user as JWTPayload;
    const { product_code, quantity = 1 } = body;

    if (!product_code) {
      throw new HttpException('product_code is required', 400);
    }

    // Validar que NO sea un producto de créditos (esos usan /wallet/recharge)
    if (product_code.startsWith('CREDITS_')) {
      throw new HttpException('Credit products must use /wallet/recharge endpoint', 400);
    }

    const client = await this.pg.connect();
    try {
      await client.query('BEGIN');

      // 1. Verificar que el producto existe y tiene stock
      const productResult = await client.query(
        `SELECT code, name, category, price, stock FROM products WHERE code = $1 FOR UPDATE`,
        [product_code]
      );

      if (productResult.rows.length === 0) {
        throw new HttpException('Product not found', 404);
      }

      const product = productResult.rows[0];

      if (product.stock < quantity) {
        throw new HttpException(`Insufficient stock. Available: ${product.stock}`, 400);
      }

      // 2. Verificar si tiene suscripción activa para aplicar descuento
      const subResult = await client.query(
        `SELECT status, current_period_end FROM subscriptions 
         WHERE tenant_id = $1 AND current_period_end > NOW() 
         ORDER BY current_period_end DESC LIMIT 1`,
        [tenant_id]
      );

      const hasActiveSubscription = subResult.rows.length > 0;
      const discount = hasActiveSubscription ? 0.30 : 0; // 30% descuento si tiene suscripción
      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * quantity * (1 - discount);

      // 3. Verificar saldo en billetera
      const tenantResult = await client.query(
        `SELECT wallet_balance FROM tenants WHERE id = $1 FOR UPDATE`,
        [tenant_id]
      );

      if (tenantResult.rows.length === 0) {
        throw new HttpException('Tenant not found', 404);
      }

      const currentBalance = parseFloat(tenantResult.rows[0].wallet_balance || '0');

      if (currentBalance < totalPrice) {
        throw new HttpException(
          `Insufficient balance. Required: $${totalPrice.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`,
          400
        );
      }

      // 4. Descontar de la billetera
      const newBalance = currentBalance - totalPrice;
      await client.query(
        `UPDATE tenants SET wallet_balance = $1 WHERE id = $2`,
        [newBalance, tenant_id]
      );

            // 5. Crear servicios (uno por cada quantity)
      const services = [];
      for (let i = 0; i < quantity; i++) {
        // Buscar una credencial disponible del producto
        const credentialResult = await client.query(
          `SELECT id, email, password, profile_name, pin 
           FROM credentials 
           WHERE product_code = $1 AND status = 'available' 
           LIMIT 1 FOR UPDATE`,
          [product_code]
        );

        if (credentialResult.rows.length === 0) {
          throw new HttpException(`No available credentials for product ${product_code}`, 400);
        }

        const credential = credentialResult.rows[0];
        
        // Crear el servicio
        const serviceResult = await client.query(
          `INSERT INTO services (tenant_id, product_code, credential_id, status, expires_at)
           VALUES ($1, $2, $3, 'active', NOW() + INTERVAL '30 days')
           RETURNING id, product_code, credential_id, status, expires_at, created_at`,
          [tenant_id, product_code, credential.id]
        );

        const service = serviceResult.rows[0];

        // Marcar la credencial como asignada
        await client.query(
          `UPDATE credentials SET status = 'assigned', assigned_to = $1, updated_at = NOW() WHERE id = $2`,
          [service.id, credential.id]
        );

        // Agregar las credenciales al objeto del servicio para devolverlas
        services.push({
          ...service,
          credentials: {
            email: credential.email,
            password: credential.password,
            profile_name: credential.profile_name,
            pin: credential.pin
          }
        });
      }

      // 6. Actualizar stock del producto
      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE code = $2`,
        [quantity, product_code]
      );

      // 7. Registrar la transacción en billing_events
      await client.query(
        `INSERT INTO billing_events (tenant_id, event_type, source, payload)
         VALUES ($1, 'purchase', 'WALLET', $2)`,
        [
          tenant_id,
          JSON.stringify({
            product_code,
            product_name: product.name,
            quantity,
            unit_price: unitPrice,
            total_price: totalPrice,
            discount_applied: discount,
            service_ids: services.map(s => s.id)
          })
        ]
      );

      await client.query('COMMIT');

      // Enviar email con credenciales (async, no bloqueante)
      const userEmailResult = await this.pg.query(
        `SELECT u.email, t.name as tenant_name 
         FROM users u 
         JOIN tenants t ON u.tenant_id = t.id 
         WHERE u.tenant_id = $1 
         LIMIT 1`,
        [tenant_id]
      );
      if (userEmailResult.rows.length > 0 && userEmailResult.rows[0].email) {
        const user = userEmailResult.rows[0];
        this.emailService.sendCredentialsEmail({
          to: user.email,
          tenantName: user.tenant_name,
          productName: product.name,
          credentials: services.map(s => s.credentials),
          expiresAt: services[0].expires_at,
          totalPrice,
          discountApplied: discount > 0 ? Math.round(discount * 100) : undefined,
        }).catch(err => console.error('Error sending email:', err));
      }

      return res.json({
        success: true,
        services,
        purchase: {
          product_code,
          product_name: product.name,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          discount_applied: discount * 100, // Porcentaje
          new_balance: newBalance
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error purchasing product:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Error processing purchase', 500);
    } finally {
      client.release();
    }
  }

  // Función removida - ahora usamos credenciales reales de la tabla credentials

  // Endpoint para crear checkout de Stripe para compra de producto del catálogo
  @Post('checkout')
  @UseGuards(AuthGuard)
  async createProductCheckout(
    @Body() body: { product_code: string; quantity?: number },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { tenant_id } = (req as any).user as JWTPayload;
    const { product_code, quantity = 1 } = body;

    if (!product_code) {
      throw new HttpException('product_code is required', 400);
    }

    // Validar que NO sea un producto de créditos (esos usan /wallet/recharge)
    if (product_code.startsWith('CREDITS_')) {
      throw new HttpException('Credit products must use /wallet/recharge endpoint', 400);
    }

    try {
      // 1. Verificar que el producto existe
      const productResult = await this.pg.query(
        `SELECT code, name, category, price, stock FROM products WHERE code = $1`,
        [product_code]
      );

      if (productResult.rows.length === 0) {
        throw new HttpException('Product not found', 404);
      }

      const product = productResult.rows[0];

      if (product.stock < quantity) {
        throw new HttpException(`Insufficient stock. Available: ${product.stock}`, 400);
      }

      // 2. Verificar si tiene suscripción activa para aplicar descuento
      const subResult = await this.pg.query(
        `SELECT status, current_period_end FROM subscriptions 
         WHERE tenant_id = $1 AND current_period_end > NOW() 
         ORDER BY current_period_end DESC LIMIT 1`,
        [tenant_id]
      );

      const hasActiveSubscription = subResult.rows.length > 0;
      const discount = hasActiveSubscription ? 0.30 : 0;
      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * quantity * (1 - discount);

      // 3. Generar order number único
      const orderNumber = this.generateOrderNumber();

      // 4. Crear registro en billing_events (pendiente de pago)
      const eventResult = await this.pg.query(
        `INSERT INTO billing_events (tenant_id, event_type, source, order_number, payload)
         VALUES ($1, 'purchase_pending', 'STRIPE', $2, $3)
         RETURNING id`,
        [
          tenant_id,
          orderNumber,
          JSON.stringify({
            product_code,
            product_name: product.name,
            quantity,
            unit_price: unitPrice,
            total_price: totalPrice,
            discount_applied: discount,
            status: 'pending'
          })
        ]
      );

      const orderId = eventResult.rows[0].id;

      // 5. Crear Stripe Checkout Session
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { 
              name: product.name,
              description: hasActiveSubscription 
                ? `${product.category} - Con descuento preferencial (-30%)`
                : `${product.category} - Servicio digital`
            },
            unit_amount: Math.round(totalPrice * 100)
          },
          quantity: 1
        }],
        mode: 'payment',
        metadata: {
          order_id: orderId.toString(),
          order_number: orderNumber,
          product_code,
          tenant_id: tenant_id.toString(),
          quantity: quantity.toString(),
          order_type: 'catalog_purchase'
        },
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/?payment=success&type=purchase&order=${orderNumber}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/?payment=cancel`
      });

      return res.json({ 
        checkout_url: session.url, 
        order_number: orderNumber,
        order_id: orderId
      });
    } catch (error) {
      console.error('Error creating checkout:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Error creating checkout', 500);
    }
  }

  // Endpoint para crear orden SINPE para compra de producto del catálogo
  @Post('checkout/sinpe')
  @UseGuards(AuthGuard)
  async createSinpeProductCheckout(
    @Body() body: { product_code: string; quantity?: number },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { tenant_id } = (req as any).user as JWTPayload;
    const { product_code, quantity = 1 } = body;

    if (!product_code) {
      throw new HttpException('product_code is required', 400);
    }

    // Validar que NO sea un producto de créditos
    if (product_code.startsWith('CREDITS_')) {
      throw new HttpException('Credit products must use /wallet/recharge endpoint', 400);
    }

    try {
      // 1. Verificar que el producto existe
      const productResult = await this.pg.query(
        `SELECT code, name, category, price, stock FROM products WHERE code = $1`,
        [product_code]
      );

      if (productResult.rows.length === 0) {
        throw new HttpException('Product not found', 404);
      }

      const product = productResult.rows[0];

      if (product.stock < quantity) {
        throw new HttpException(`Insufficient stock. Available: ${product.stock}`, 400);
      }

      // 2. Verificar suscripción para descuento
      const subResult = await this.pg.query(
        `SELECT status FROM subscriptions 
         WHERE tenant_id = $1 AND current_period_end > NOW() 
         ORDER BY current_period_end DESC LIMIT 1`,
        [tenant_id]
      );

      const hasActiveSubscription = subResult.rows.length > 0;
      const discount = hasActiveSubscription ? 0.30 : 0;
      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * quantity * (1 - discount);

      // 3. Generar order number
      const orderNumber = this.generateOrderNumber();

      // 4. Crear registro pendiente
      const eventResult = await this.pg.query(
        `INSERT INTO billing_events (tenant_id, event_type, source, order_number, payload)
         VALUES ($1, 'purchase_pending', 'SINPE', $2, $3)
         RETURNING id`,
        [
          tenant_id,
          orderNumber,
          JSON.stringify({
            product_code,
            product_name: product.name,
            quantity,
            unit_price: unitPrice,
            total_price: totalPrice,
            discount_applied: discount,
            status: 'pending'
          })
        ]
      );

      const orderId = eventResult.rows[0].id;

      // 5. Devolver instrucciones SINPE
      return res.json({
        order_id: orderId,
        order_number: orderNumber,
        method: 'SINPE',
        amount: totalPrice,
        instructions: {
          phone: process.env.SINPE_PHONE || '8888-8888',
          accountName: process.env.SINPE_ACCOUNT_NAME || 'Skyplay Costa Rica',
          reference: orderNumber
        },
        product: {
          name: product.name,
          code: product_code,
          quantity
        }
      });
    } catch (error) {
      console.error('Error creating SINPE checkout:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Error creating SINPE checkout', 500);
    }
  }

  // Endpoint para recargar billetera (solo con Stripe/Tarjetas por ahora)
  @Post('wallet/recharge')
  @UseGuards(AuthGuard)
  async rechargeWallet(
    @Body() body: { amount: number; method: 'CARD' | 'SINPE' | 'BINANCE' },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { tenant_id } = (req as any).user as JWTPayload;
    const { amount, method } = body;

    if (!amount || amount < 1) {
      throw new HttpException('Amount must be at least $1', 400);
    }

    if (!method || !['CARD', 'SINPE', 'BINANCE'].includes(method)) {
      throw new HttpException('Invalid payment method', 400);
    }

    try {
      // Generar order number único
      const orderNumber = this.generateOrderNumber();

      // Crear registro en billing_events (pendiente de pago)
      const eventResult = await this.pg.query(
        `INSERT INTO billing_events (tenant_id, event_type, source, order_number, payload)
         VALUES ($1, 'wallet_recharge_pending', $2, $3, $4)
         RETURNING id`,
        [
          tenant_id,
          method,
          orderNumber,
          JSON.stringify({
            amount,
            method,
            status: 'pending'
          })
        ]
      );

      const orderId = eventResult.rows[0].id;

      // Para SINPE, devolver instrucciones
      if (method === 'SINPE') {
        return res.json({
          method: 'SINPE',
          order_number: orderNumber,
          order_id: orderId,
          instructions: {
            phone: '8888-8888',
            amount: amount,
            message: `Recarga ${orderNumber}`
          }
        });
      }

      // Para Binance, devolver instrucciones (placeholder)
      if (method === 'BINANCE') {
        return res.json({
          method: 'BINANCE',
          order_number: orderNumber,
          order_id: orderId,
          instructions: {
            message: 'Binance Pay integration pending'
          }
        });
      }

      // Para tarjetas (CARD), crear Stripe Checkout
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      // Calcular bono según el monto
      let bonus = 0;
      if (amount >= 100) bonus = 0.40;
      else if (amount >= 50) bonus = 0.30;
      else if (amount >= 25) bonus = 0.20;
      else if (amount >= 10) bonus = 0.10;
      
      const totalWithBonus = amount * (1 + bonus);

      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { 
              name: 'Recarga de Billetera',
              description: bonus > 0 
                ? `$${amount} + ${(bonus * 100)}% bono = $${totalWithBonus.toFixed(2)}`
                : `Recarga de $${amount}`
            },
            unit_amount: Math.round(amount * 100)
          },
          quantity: 1
        }],
        mode: 'payment',
        metadata: {
          order_id: orderId.toString(),
          order_number: orderNumber,
          tenant_id: tenant_id.toString(),
          amount: amount.toString(),
          bonus_percentage: (bonus * 100).toString(),
          total_with_bonus: totalWithBonus.toString(),
          order_type: 'wallet_recharge'
        },
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/?payment=success&order=${orderNumber}&type=recharge`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/?payment=cancel`
      });

      return res.json({ 
        checkout_url: session.url, 
        order_number: orderNumber,
        order_id: orderId,
        amount,
        bonus_percentage: bonus * 100,
        total_with_bonus: totalWithBonus
      });
    } catch (error) {
      console.error('Error creating wallet recharge:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Error creating wallet recharge', 500);
    }
  }

  @Post(':id/renew')
  @UseGuards(AuthGuard) // Proteger este endpoint
async renew(@Param('id') serviceId: string, @Req() req: Request, @Res() res: Response) {
  const { tenant_id } = (req as any).user as JWTPayload;
  if (!tenant_id) throw new HttpException('Unauthorized', 401);

  // Obtener servicio
  const srvQ = `SELECT s.*, p.price FROM services s 
                LEFT JOIN products p ON s.product_code = p.code 
                WHERE s.id = $1 AND s.tenant_id = $2`;
  const { rows } = await this.pg.query(srvQ, [serviceId, tenant_id]);
  const service = rows[0];

  if (!service) throw new HttpException('Service not found', 404);

  // Verificar si tiene suscripción vigente (active o canceled, con fecha futura)
  const subQ = `SELECT status, current_period_end FROM subscriptions WHERE tenant_id = $1 AND current_period_end IS NOT NULL ORDER BY current_period_end DESC LIMIT 1`;
  const { rows: subRows } = await this.pg.query(subQ, [tenant_id]);
  let hasActiveSubscription = false;
  if (subRows.length > 0) {
    const sub = subRows[0];
    if (sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
      hasActiveSubscription = true;
    }
  }
  // Aplicar descuento solo si la suscripción está vigente
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
  @UseGuards(AuthGuard) // Proteger este endpoint
async createCheckout(@Param('id') serviceId: string, @Req() req: Request, @Res() res: Response) {
  console.log('>>> createCheckout called for serviceId=', serviceId);
  const { tenant_id } = (req as any).user as JWTPayload;
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

  // Verificar si tiene suscripción vigente (active o canceled, con fecha futura)
  const subQ = `SELECT status, current_period_end FROM subscriptions WHERE tenant_id = $1 AND current_period_end IS NOT NULL ORDER BY current_period_end DESC LIMIT 1`;
  const { rows: subRows } = await this.pg.query(subQ, [tenant_id]);
  let hasActiveSubscription = false;
  if (subRows.length > 0) {
    const sub = subRows[0];
    if (sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
      hasActiveSubscription = true;
    }
  }
  // Aplicar descuento solo si la suscripción está vigente
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