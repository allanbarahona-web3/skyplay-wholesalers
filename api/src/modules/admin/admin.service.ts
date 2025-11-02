import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { EmailService } from '../email/email.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject('PG_POOL') private readonly pg: Pool,
    private readonly emailService: EmailService
  ) {}

  async getTenants() {
    const { rows } = await this.pg.query(
      `SELECT t.id, t.name, t.email, t.status, t.whatsapp, t.country,
        COUNT(c.id) AS credentials_count
       FROM tenants t
       LEFT JOIN services s ON s.tenant_id = t.id
       LEFT JOIN credentials c ON s.credential_id = c.id
       WHERE t.status = 'active'
       GROUP BY t.id, t.name, t.email, t.status, t.whatsapp, t.country
       ORDER BY credentials_count DESC`
    );
    return rows;
  }

  getPendingPayments() {
    // TODO: Consultar pagos pendientes en la base de datos
    return [];
  }

  approvePayment(paymentId: string) {
    // TODO: Marcar pago como aprobado y liberar credenciales
    return { success: true };
  }

  rejectPayment(paymentId: string) {
    // TODO: Marcar pago como rechazado
    return { success: true };
  }

  async getWholesalerRequests() {
    const { rows } = await this.pg.query(
      `SELECT * FROM resellers WHERE status = 'pending' ORDER BY created_at DESC`
    );
    return rows;
  }

  async approveWholesalerRequest(id: string, approved_by: number) {
    const client = await this.pg.connect();
    try {
      await client.query('BEGIN');
      // 1. Actualiza status a 'approved', setea approved_at y approved_by
      const updateRes = await client.query(
        `UPDATE resellers SET status = 'approved', approved_at = NOW(), approved_by = $1 WHERE id = $2 RETURNING *`,
        [approved_by, id]
      );
      if (updateRes.rowCount === 0) throw new Error('Reseller not found');
      const reseller = updateRes.rows[0];

      // 2. Crea el tenant en la tabla tenants con los nuevos campos
      const tenantRes = await client.query(
        `INSERT INTO tenants (name, email, whatsapp, country, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          reseller.company_name,
          reseller.email,
          reseller.whatsapp || null,
          reseller.country || null,
          approved_by
        ]
      );
      const tenant_id = tenantRes.rows[0].id;

      // 3. Asocia tenant_id en la fila de resellers
      await client.query(
        `UPDATE resellers SET tenant_id = $1 WHERE id = $2`,
        [tenant_id, id]
      );

      await client.query('COMMIT');
      return { success: true, tenant_id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async rejectWholesalerRequest(id: string, reason?: string) {
    const res = await this.pg.query(
      `UPDATE resellers SET status = 'rejected', rejected_at = NOW(), notes = COALESCE(notes, '') || $2 WHERE id = $1 RETURNING id`,
      [id, reason ? `\nRechazo: ${reason}` : '']
    );
    if (res.rowCount === 0) throw new Error('Reseller not found');
    return { success: true };
  }

  async getSinpePendingOrders() {
    const { rows } = await this.pg.query(
      `SELECT 
        be.id,
        be.order_number,
        be.tenant_id,
        be.created_at,
        be.payload,
        t.name as tenant_name,
        t.email as tenant_email
       FROM billing_events be
       JOIN tenants t ON t.id = be.tenant_id
       WHERE be.event_type = 'purchase_pending' 
         AND be.source = 'SINPE'
       ORDER BY be.created_at DESC`
    );
    return rows;
  }

  async confirmSinpeOrder(orderId: number) {
    const client = await this.pg.connect();
    try {
      await client.query('BEGIN');

      // 1. Verificar idempotencia - si ya se procesó, rechazar
      const checkResult = await client.query(
        `SELECT event_type FROM billing_events WHERE id = $1`,
        [orderId]
      );

      if (checkResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      if (checkResult.rows[0].event_type !== 'purchase_pending') {
        throw new Error(`Order already processed with status: ${checkResult.rows[0].event_type}`);
      }

      // 2. Obtener detalles de la orden
      const orderResult = await client.query(
        `SELECT tenant_id, payload FROM billing_events WHERE id = $1 AND event_type = 'purchase_pending' AND source = 'SINPE'`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found or invalid state');
      }

      const { tenant_id, payload } = orderResult.rows[0];
      const { product_code, quantity = 1 } = payload;

      // 3. Crear servicios y asignar credenciales (igual que en el webhook)
      const services = [];
      for (let i = 0; i < quantity; i++) {
        // Buscar credencial disponible
        const credResult = await client.query(
          `SELECT id, email, password, profile_name, pin 
           FROM credentials 
           WHERE product_code = $1 AND status = 'available' 
           LIMIT 1 FOR UPDATE`,
          [product_code]
        );

        if (credResult.rows.length === 0) {
          throw new Error(`No available credentials for product ${product_code}`);
        }

        const credential = credResult.rows[0];
        
        // Crear el servicio
        const serviceResult = await client.query(
          `INSERT INTO services (tenant_id, product_code, credential_id, status, expires_at)
           VALUES ($1, $2, $3, 'active', NOW() + INTERVAL '30 days')
           RETURNING id`,
          [tenant_id, product_code, credential.id]
        );

        const serviceId = serviceResult.rows[0].id;

        // Marcar credencial como asignada
        await client.query(
          `UPDATE credentials SET status = 'assigned', assigned_to = $1, updated_at = NOW() WHERE id = $2`,
          [serviceId, credential.id]
        );

        services.push({
          id: serviceId,
          credential: {
            email: credential.email,
            password: credential.password,
            profile_name: credential.profile_name,
            pin: credential.pin
          }
        });
      }

      // 4. Actualizar stock del producto
      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE code = $2`,
        [quantity, product_code]
      );

      // 5. Actualizar orden a completada
      await client.query(
        `UPDATE billing_events 
         SET event_type = 'purchase_completed', 
             payload = jsonb_set(payload, '{payment_status}', '"completed"'),
             payload = jsonb_set(payload, '{confirmed_at}', to_jsonb(NOW()::text))
         WHERE id = $1`,
        [orderId]
      );

      await client.query('COMMIT');

      console.log(`✅ SINPE order confirmed: ${orderId} for tenant ${tenant_id}`);
      
      // 6. Enviar email con credenciales (async, no bloqueante)
      try {
        const userResult = await this.pg.query(
          `SELECT u.email, t.name as tenant_name 
           FROM users u 
           JOIN tenants t ON u.tenant_id = t.id 
           WHERE u.tenant_id = $1 
           LIMIT 1`,
          [tenant_id]
        );
        
        if (userResult.rows.length > 0 && userResult.rows[0].email) {
          const user = userResult.rows[0];
          
          // Obtener nombre del producto
          const productResult = await this.pg.query(
            `SELECT name FROM products WHERE code = $1`,
            [product_code]
          );
          
          const productName = productResult.rows[0]?.name || product_code;
          
          // Obtener order_number del payload
          const orderNumber = payload.order_number || `SINPE-${orderId}`;
          
          await this.emailService.sendCredentialsEmail({
            to: user.email,
            tenantName: user.tenant_name,
            productName,
            credentials: services.map(s => s.credential),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
            orderNumber,
            totalPrice: payload.total_price,
            discountApplied: payload.discount_applied ? Math.round(payload.discount_applied * 100) : undefined,
          });
          
          console.log(`📧 Email sent to ${user.email} for SINPE order ${orderId}`);
        }
      } catch (emailErr: any) {
        console.error('Error sending email after SINPE confirmation:', emailErr.message);
      }
      
      return { 
        success: true, 
        order_id: orderId,
        services,
        message: 'Order confirmed and credentials assigned'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error confirming SINPE order:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
