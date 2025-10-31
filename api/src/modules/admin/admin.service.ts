import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class AdminService {
  constructor(@Inject('PG_POOL') private readonly pg: Pool) {}

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
}
