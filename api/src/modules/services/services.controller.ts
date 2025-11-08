// src/modules/services/services.controller.ts
import { Controller, Get, Post, Param, Body, Res, Req, HttpException, Inject, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { Pool } from 'pg';
import { AuthGuard, JWTPayload } from '../../guards/auth.guard';
import { EmailService } from '../email/email.service';
import { PayPalService } from '../paypal/paypal.service';


@Controller('services')
export class ServicesController {
  constructor(
    @Inject('PG_POOL') private readonly pg: Pool,
    private readonly emailService: EmailService,
    private readonly paypalService: PayPalService
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
      const discount = hasActiveSubscription ? 0.20 : 0; // 20% descuento por Suscripción Preferencial // 30% descuento si tiene suscripción
      const catalogPrice = parseFloat(product.price);
      const unitPrice = catalogPrice * (1 - discount); // Precio con descuento aplicado
      const totalPrice = unitPrice * quantity;

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
            catalog_price: catalogPrice,
            unit_price: unitPrice, // Precio con descuento
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
      const discount = hasActiveSubscription ? 0.20 : 0; // 20% descuento por Suscripción Preferencial
      const catalogPrice = parseFloat(product.price);
      const unitPrice = catalogPrice * (1 - discount); // Precio con descuento aplicado
      const totalPrice = unitPrice * quantity;

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
            catalog_price: catalogPrice,
            unit_price: unitPrice, // Precio con descuento
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
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/?payment=success&type=purchase&order=${orderNumber}&provider=stripe`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/?payment=cancel`
      });

      return res.json({ 
        checkout_url: session.url, 
        order_number: orderNumber,
        order_id: orderId,
        unit_price: unitPrice,
        total_price: totalPrice,
        discount: discount,
        discount_percentage: Math.round(discount * 100),
        final_price: totalPrice
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
      const discount = hasActiveSubscription ? 0.20 : 0; // 20% descuento por Suscripción Preferencial
      const catalogPrice = parseFloat(product.price);
      const unitPrice = catalogPrice * (1 - discount); // Precio con descuento aplicado
      const totalPrice = unitPrice * quantity;

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
            catalog_price: catalogPrice,
            unit_price: unitPrice, // Precio con descuento
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

  // Endpoint para crear checkout de PayPal para compra de producto del catálogo
  @Post('checkout/paypal')
  @UseGuards(AuthGuard)
  async createPayPalProductCheckout(
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
      const discount = hasActiveSubscription ? 0.20 : 0; // 20% descuento por Suscripción Preferencial
      const catalogPrice = parseFloat(product.price);
      const unitPrice = catalogPrice * (1 - discount); // Precio con descuento aplicado
      const totalPrice = unitPrice * quantity;

      // 3. Generar order number único
      const orderNumber = this.generateOrderNumber();

      // 4. Crear registro pendiente
      const eventResult = await this.pg.query(
        `INSERT INTO billing_events (tenant_id, event_type, source, order_number, payload)
         VALUES ($1, 'purchase_pending', 'PAYPAL', $2, $3)
         RETURNING id`,
        [
          tenant_id,
          orderNumber,
          JSON.stringify({
            product_code,
            product_name: product.name,
            quantity,
            catalog_price: catalogPrice,
            unit_price: unitPrice, // Precio con descuento
            total_price: totalPrice,
            discount_applied: discount,
            status: 'pending'
          })
        ]
      );

      const orderId = eventResult.rows[0].id;

      // 5. Crear orden de PayPal
      const paypalOrder = await this.paypalService.createOrder({
        amount: totalPrice,
        currency: 'USD',
        description: `${product.name} x${quantity}${hasActiveSubscription ? ' (Descuento Preferencial -30%)' : ''}`,
        orderNumber,
        metadata: {
          order_id: orderId.toString(),
          tenant_id: tenant_id.toString(),
          product_code,
          quantity: quantity.toString(),
          order_type: 'catalog_purchase'
        }
      });

      return res.json({
        method: 'PAYPAL',
        order_id: orderId,
        order_number: orderNumber,
        paypal_order_id: paypalOrder.orderId,
        approval_url: paypalOrder.approvalUrl,
        amount: totalPrice,
        product: {
          name: product.name,
          code: product_code,
          quantity
        }
      });
    } catch (error) {
      console.error('Error creating PayPal checkout:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Error creating PayPal checkout', 500);
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

  // Endpoint para recargar billetera con PayPal
  @Post('checkout/paypal/recharge')
  @UseGuards(AuthGuard)
  async createPayPalRechargeCheckout(
    @Body() body: { amount: number },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { tenant_id } = (req as any).user as JWTPayload;
    const { amount } = body;

    if (!amount || amount < 1) {
      throw new HttpException('Amount must be at least $1', 400);
    }

    try {
      // Generar order number único
      const orderNumber = this.generateOrderNumber();

      // Calcular bono según el monto (mismo que Stripe)
      let bonus = 0;
      if (amount >= 100) bonus = 0.40;
      else if (amount >= 50) bonus = 0.30;
      else if (amount >= 25) bonus = 0.20;
      else if (amount >= 10) bonus = 0.10;
      
      const totalWithBonus = amount * (1 + bonus);

      // Crear registro en billing_events (pendiente de pago)
      const eventResult = await this.pg.query(
        `INSERT INTO billing_events (tenant_id, event_type, source, order_number, payload)
         VALUES ($1, 'wallet_recharge_pending', 'PAYPAL', $2, $3)
         RETURNING id`,
        [
          tenant_id,
          orderNumber,
          JSON.stringify({
            amount,
            bonus_percentage: bonus * 100,
            total_with_bonus: totalWithBonus,
            method: 'PAYPAL',
            status: 'pending'
          })
        ]
      );

      const orderId = eventResult.rows[0].id;

      // Crear orden de PayPal
      const paypalOrder = await this.paypalService.createOrder({
        amount: amount, // PayPal cobra solo el monto original, el bono lo damos nosotros
        currency: 'USD',
        description: bonus > 0 
          ? `Recarga de Billetera: $${amount} + ${(bonus * 100)}% bono = $${totalWithBonus.toFixed(2)}`
          : `Recarga de Billetera: $${amount}`,
        orderNumber,
        metadata: {
          order_id: orderId.toString(),
          tenant_id: tenant_id.toString(),
          amount: amount.toString(),
          bonus_percentage: (bonus * 100).toString(),
          total_with_bonus: totalWithBonus.toString(),
          order_type: 'wallet_recharge'
        }
      });

      return res.json({
        method: 'PAYPAL',
        order_id: orderId,
        order_number: orderNumber,
        paypal_order_id: paypalOrder.orderId,
        approval_url: paypalOrder.approvalUrl,
        amount,
        bonus_percentage: bonus * 100,
        total_with_bonus: totalWithBonus
      });
    } catch (error) {
      console.error('Error creating PayPal recharge:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Error creating PayPal recharge', 500);
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
  const discount = hasActiveSubscription ? 0.20 : 0; // 20% descuento por Suscripción Preferencial
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
  const originalPrice = parseFloat(service.price);
  const discountApplied = originalPrice - finalPrice;
  const payload = {
    service_id: service.id,
    product_code: service.product_code,
    amount: finalPrice,
    unit_price: finalPrice,
    original_amount: originalPrice,
    discount_applied: discountApplied > 0 ? discountApplied / originalPrice : 0,
    currency: 'USD',
    status: 'pending'
  };
  const { rows } = await this.pg.query(q, [tenantId, JSON.stringify(payload)]);
  return rows[0].id;
}

@Post(':id/renew/wallet')
@UseGuards(AuthGuard)
async renewFromWallet(@Param('id') serviceId: string, @Req() req: Request, @Res() res: Response) {
  const { tenant_id } = (req as any).user as JWTPayload;
  if (!tenant_id) throw new HttpException('Unauthorized', 401);

  const client = await this.pg.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener servicio (con lock)
    const srvQ = `SELECT * FROM services WHERE id = $1 AND tenant_id = $2 FOR UPDATE`;
    const { rows } = await client.query(srvQ, [serviceId, tenant_id]);
    const service = rows[0];

    if (!service) {
      await client.query('ROLLBACK');
      throw new HttpException('Service not found', 404);
    }

    // 2. Obtener precio del producto
    const priceQ = `SELECT price FROM products WHERE code = $1`;
    const { rows: priceRows } = await client.query(priceQ, [service.product_code]);
    if (priceRows.length === 0) {
      await client.query('ROLLBACK');
      throw new HttpException('Product not found', 404);
    }
    service.price = priceRows[0].price;

    // 3. Verificar suscripción para descuento
    const subQ = `SELECT status, current_period_end FROM subscriptions 
                  WHERE tenant_id = $1 AND current_period_end IS NOT NULL 
                  ORDER BY current_period_end DESC LIMIT 1`;
    const { rows: subRows } = await client.query(subQ, [tenant_id]);
    let hasActiveSubscription = false;
    if (subRows.length > 0) {
      const sub = subRows[0];
      if (sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
        hasActiveSubscription = true;
      }
    }

    const originalPrice = parseFloat(service.price);
    const discount = hasActiveSubscription ? 0.20 : 0; // 20% descuento por Suscripción Preferencial
    const finalPrice = originalPrice * (1 - discount);

    // 4. Obtener balance del tenant
    const tenantQ = `SELECT wallet_balance FROM tenants WHERE id = $1 FOR UPDATE`;
    const { rows: tenantRows } = await client.query(tenantQ, [tenant_id]);
    const tenant = tenantRows[0];

    if (!tenant) {
      await client.query('ROLLBACK');
      throw new HttpException('Tenant not found', 404);
    }

    const currentBalance = parseFloat(tenant.wallet_balance || '0');
    
    if (currentBalance < finalPrice) {
      await client.query('ROLLBACK');
      throw new HttpException(
        `Insufficient balance. Required: $${finalPrice.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`,
        400
      );
    }

    // 5. Descontar del balance
    const newBalance = currentBalance - finalPrice;
    await client.query(
      `UPDATE tenants SET wallet_balance = $1 WHERE id = $2`,
      [newBalance, tenant_id]
    );

    // 6. Extender servicio por 30 días
    await client.query(
      `UPDATE services 
       SET expires_at = CASE 
         WHEN expires_at > NOW() THEN expires_at + INTERVAL '30 days'
         ELSE NOW() + INTERVAL '30 days'
       END,
       status = 'active'
       WHERE id = $1`,
      [serviceId]
    );

    // 7. Registrar billing_event
    const orderNumber = `WALLET-RENEW-${Date.now()}`;
    await client.query(
      `INSERT INTO billing_events (tenant_id, event_type, source, order_number, payload)
       VALUES ($1, 'renewal_completed', 'WALLET', $2, $3)`,
      [tenant_id, orderNumber, JSON.stringify({
        service_id: serviceId,
        product_code: service.product_code,
        amount: finalPrice,
        unit_price: finalPrice,
        original_amount: originalPrice,
        discount_applied: discount > 0 ? discount / originalPrice : 0,
        currency: 'USD',
        status: 'completed'
      })]
    );

    // 7. Obtener nueva fecha de expiración
    const { rows: updatedRows } = await client.query(
      `SELECT expires_at FROM services WHERE id = $1`,
      [serviceId]
    );

    await client.query('COMMIT');

    // 8. Enviar email de renovación (después de commit para asegurar que todo se guardó)
    try {
      // Obtener email y nombre del tenant igual que en compra
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

        // Obtener credenciales del servicio
        const credResult = await this.pg.query(
          `SELECT email, password, profile_name, pin FROM credentials WHERE id = (SELECT credential_id FROM services WHERE id = $1)`,
          [serviceId]
        );
        const cred = credResult.rows[0];

        if (cred) {
          await this.emailService.sendRenewalEmail({
            to: user.email,
            tenantName: user.tenant_name,
            productName: service.product_code,
            credentials: [{
              email: cred.email,
              password: cred.password,
              profile_name: cred.profile_name,
              pin: cred.pin
            }],
            expiresAt: new Date(updatedRows[0].expires_at).toISOString(),
            orderNumber: orderNumber,
            totalPrice: finalPrice,
            discountApplied: discount * 100
          }).catch(err => console.error('Error sending renewal email:', err));
        }
      }
    } catch (emailError) {
      console.error('Error in renewal email process:', emailError);
      // No lanzar error - el email es secundario, la renovación ya fue exitosa
    }

    return res.json({
      ok: true,
      service_id: serviceId,
      new_expires_at: updatedRows[0].expires_at,
      amount_charged: finalPrice,
      new_balance: newBalance,
      message: 'Service renewed successfully'
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

@Post(':id/checkout')
@UseGuards(AuthGuard) // Proteger este endpoint
async createCheckout(
  @Param('id') serviceId: string, 
  @Req() req: Request, 
  @Res() res: Response
) {
  console.log('>>> createCheckout called for serviceId=', serviceId);
  const { tenant_id } = (req as any).user as JWTPayload;
  if (!tenant_id) throw new HttpException('Unauthorized', 401);

  // Obtener método de pago desde query params (default: stripe)
  const method = (req.query.method as string)?.toLowerCase() || 'stripe';
  
  if (!['stripe', 'paypal'].includes(method)) {
    throw new HttpException('Invalid payment method. Use "stripe" or "paypal"', 400);
  }

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
  const discount = hasActiveSubscription ? 0.20 : 0; // 20% descuento por Suscripción Preferencial
  const originalPrice = parseFloat(order.price);
  const finalPrice = originalPrice * (1 - discount);

  console.log(`Subscription active: ${hasActiveSubscription}, Original: $${originalPrice}, Final: $${finalPrice}`);

  // Generar order number único
  const orderNumber = this.generateOrderNumber();
  
  // Actualizar order number y source en DB
  await this.pg.query(
    `UPDATE billing_events SET order_number = $1, source = $2 WHERE id = $3`,
    [orderNumber, method.toUpperCase(), order.order_id]
  );

  // ========== CREAR CHECKOUT SEGÚN MÉTODO ==========
  if (method === 'paypal') {
    // Crear orden PayPal para renovación
    const paypalOrder = await this.paypalService.createOrder({
      amount: finalPrice,
      currency: 'USD',
      description: hasActiveSubscription 
        ? `Renovación ${order.product_name} - Con descuento preferencial (-30%)`
        : `Renovación ${order.product_name}`,
      orderNumber,
      metadata: {
        order_id: order.order_id.toString(),
        tenant_id: tenant_id.toString(),
        service_id: serviceId,
        order_type: 'renewal'
      }
    });

    return res.json({ 
      method: 'PAYPAL',
      paypal_order_id: paypalOrder.orderId,
      approval_url: paypalOrder.approvalUrl,
      order_number: orderNumber 
    });
  } else {
    // Crear Stripe Checkout (comportamiento original)
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
      success_url: `${process.env.FRONTEND_URL}/panel?payment=success&type=renewal&order=${orderNumber}&provider=stripe`,
      cancel_url: `${process.env.FRONTEND_URL}/panel?payment=cancel`
    });

    return res.json({ 
      method: 'STRIPE',
      checkout_url: session.url, 
      order_number: orderNumber 
    });
  }
}

  @Post(':id/checkout/sinpe')
  @UseGuards(AuthGuard)
  async createSinpeRenewalCheckout(
    @Param('id') serviceId: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { tenant_id } = (req as any).user as JWTPayload;
    if (!tenant_id) throw new HttpException('Unauthorized', 401);

    try {
      // 1. Obtener servicio
      const serviceResult = await this.pg.query(
        `SELECT s.id, s.product_code, s.tenant_id, p.price, p.name as product_name
         FROM services s
         JOIN products p ON s.product_code = p.code
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [serviceId, tenant_id]
      );

      if (serviceResult.rows.length === 0) {
        throw new HttpException('Service not found', 404);
      }

      const service = serviceResult.rows[0];

      // 2. Verificar suscripción para descuento
      const subResult = await this.pg.query(
        `SELECT status FROM subscriptions 
         WHERE tenant_id = $1 AND current_period_end > NOW()
         ORDER BY current_period_end DESC LIMIT 1`,
        [tenant_id]
      );

      const hasActiveSubscription = subResult.rows.length > 0;
      const discount = hasActiveSubscription ? 0.20 : 0;
      const originalPrice = parseFloat(service.price);
      const finalPrice = originalPrice * (1 - discount);

      // 3. Generar order number
      const orderNumber = this.generateOrderNumber();

      // 4. Crear orden SINPE para renovación
      const eventResult = await this.pg.query(
        `INSERT INTO billing_events (tenant_id, event_type, source, order_number, payload)
         VALUES ($1, 'renewal_pending', 'SINPE', $2, $3)
         RETURNING id`,
        [
          tenant_id,
          orderNumber,
          JSON.stringify({
            service_id: serviceId,
            product_code: service.product_code,
            product_name: service.product_name,
            amount: finalPrice,
            unit_price: finalPrice,
            original_amount: originalPrice,
            discount_applied: discount > 0 ? discount : 0,
            currency: 'USD',
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
        amount: finalPrice,
        instructions: {
          phone: process.env.SINPE_PHONE || '8888-8888',
          accountName: process.env.SINPE_ACCOUNT_NAME || 'Skyplay Costa Rica',
          reference: orderNumber
        },
        service: {
          name: service.product_name,
          code: service.product_code
        }
      });
    } catch (err: any) {
      console.error('Error creating SINPE renewal checkout:', err);
      throw err;
    }
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