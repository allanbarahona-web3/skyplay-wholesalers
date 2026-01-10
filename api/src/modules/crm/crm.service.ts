import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateCRMClientDto } from './dto/create-crm-client.dto';
import { UpdateCRMClientDto } from './dto/update-crm-client.dto';

@Injectable()
export class CRMService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  /**
   * Verificar que el tenant tiene una suscripción CRM activa
   * (Preferencial, CRM PRO o Tienda)
   */
  async verifyCRMAccess(tenantId: string): Promise<boolean> {
    const query = `
      SELECT status FROM subscriptions 
      WHERE tenant_id = $1 
        AND status = 'active'
        AND (product_type = 'preferential' 
          OR product_type = 'crm-pro' 
          OR product_type = 'tienda')
      LIMIT 1
    `;
    
    try {
      const result = await this.pool.query(query, [tenantId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error verificando acceso CRM:', error);
      throw new HttpException(
        'Error verificando acceso al CRM',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Crear un nuevo cliente CRM
   */
  async createClient(tenantId: string, createCRMClientDto: CreateCRMClientDto) {
    console.log('🎫 [CRM] Creating client for tenant:', tenantId);
    console.log('🎫 [CRM] Client data:', createCRMClientDto);
    
    // Verificar acceso CRM
    const hasCRMAccess = await this.verifyCRMAccess(tenantId);
    console.log('🎫 [CRM] Has CRM access:', hasCRMAccess);
    
    if (!hasCRMAccess) {
      throw new HttpException(
        'No tienes acceso al CRM. Requiere suscripción activa (Preferencial, CRM PLUS o CRM PRO)',
        HttpStatus.FORBIDDEN,
      );
    }

    const {
      name,
      email,
      phone,
      credential_id,
      expires_at,
      notes,
    } = createCRMClientDto;

    // Validar que la credencial no esté ya asignada a otro cliente
    if (credential_id) {
      const existingClientQuery = `
        SELECT id FROM crm_clients 
        WHERE tenant_id = $1 AND credential_id = $2
        LIMIT 1;
      `;
      const existingClientResult = await this.pool.query(existingClientQuery, [tenantId, credential_id]);
      if (existingClientResult.rows.length > 0) {
        throw new HttpException(
          'Esta credencial ya está asignada a otro cliente. Una credencial solo puede tener un cliente.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const query = `
      INSERT INTO crm_clients (tenant_id, name, email, phone, credential_id, expires_at, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, name, email, phone, credential_id, expires_at, notes, created_at, updated_at;
    `;

    const values = [
      tenantId,
      name,
      email,
      phone || null,
      credential_id || null,
      expires_at || null,
      notes || null,
    ];

    console.log('🎫 [CRM] Executing INSERT query with values:', values);

    try {
      const result = await this.pool.query(query, values);
      console.log('🎫 [CRM] Client created successfully:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('🎫 [CRM] Error creating client:', error);
      if (error.code === '23505') {
        // Unique constraint violation
        if (error.constraint === 'crm_clients_tenant_credential_unique') {
          throw new HttpException(
            'Esta credencial ya está asignada a otro cliente',
            HttpStatus.BAD_REQUEST,
          );
        }
        throw new HttpException(
          'Este cliente ya existe',
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        'Error al crear cliente',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener todos los clientes CRM del tenant
   */
  async getClients(tenantId: string) {
    // Verificar acceso CRM
    const hasCRMAccess = await this.verifyCRMAccess(tenantId);
    if (!hasCRMAccess) {
      throw new HttpException(
        'No tienes acceso al CRM. Requiere suscripción activa (Preferencial, CRM PLUS o CRM PRO)',
        HttpStatus.FORBIDDEN,
      );
    }

    const query = `
      SELECT 
        id, 
        tenant_id, 
        name, 
        email, 
        phone, 
        credential_id, 
        expires_at, 
        notes, 
        created_at, 
        updated_at
      FROM crm_clients
      WHERE tenant_id = $1
      ORDER BY created_at DESC;
    `;

    try {
      const result = await this.pool.query(query, [tenantId]);
      return result.rows;
    } catch (error) {
      throw new HttpException(
        'Error al obtener clientes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener un cliente específico
   */
  async getClient(tenantId: string, clientId: string) {
    // Verificar acceso CRM
    const hasCRMAccess = await this.verifyCRMAccess(tenantId);
    if (!hasCRMAccess) {
      throw new HttpException(
        'No tienes acceso al CRM. Requiere suscripción activa (Preferencial, CRM PLUS o CRM PRO)',
        HttpStatus.FORBIDDEN,
      );
    }

    const query = `
      SELECT 
        id, 
        tenant_id, 
        name, 
        email, 
        phone, 
        credential_id, 
        expires_at, 
        notes, 
        created_at, 
        updated_at
      FROM crm_clients
      WHERE id = $1 AND tenant_id = $2;
    `;

    try {
      const result = await this.pool.query(query, [clientId, tenantId]);
      if (result.rows.length === 0) {
        throw new HttpException('Cliente no encontrado', HttpStatus.NOT_FOUND);
      }
      return result.rows[0];
    } catch (error) {
      if (error.status === 404) throw error;
      throw new HttpException(
        'Error al obtener cliente',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Actualizar un cliente CRM
   */
  async updateClient(
    tenantId: string,
    clientId: string,
    updateCRMClientDto: UpdateCRMClientDto,
  ) {
    console.log('🎫 [CRM] Update client request:', {
      clientId,
      tenantId,
      updateData: updateCRMClientDto
    });

    // Verificar acceso CRM
    const hasCRMAccess = await this.verifyCRMAccess(tenantId);
    if (!hasCRMAccess) {
      throw new HttpException(
        'No tienes acceso al CRM. Requiere suscripción activa (Preferencial, CRM PLUS o CRM PRO)',
        HttpStatus.FORBIDDEN,
      );
    }

    // Primero verificar que el cliente pertenece al tenant
    const checkQuery = 'SELECT id, credential_id FROM crm_clients WHERE id = $1 AND tenant_id = $2;';
    const checkResult = await this.pool.query(checkQuery, [clientId, tenantId]);

    if (checkResult.rows.length === 0) {
      throw new HttpException('Cliente no encontrado', HttpStatus.NOT_FOUND);
    }

    const currentClient = checkResult.rows[0];

    // Validar que la credencial no esté ya asignada a otro cliente (si se está cambiando)
    if (updateCRMClientDto.credential_id && updateCRMClientDto.credential_id !== currentClient.credential_id) {
      const existingClientQuery = `
        SELECT id FROM crm_clients 
        WHERE tenant_id = $1 AND credential_id = $2 AND id != $3
        LIMIT 1;
      `;
      const existingClientResult = await this.pool.query(existingClientQuery, [tenantId, updateCRMClientDto.credential_id, clientId]);
      if (existingClientResult.rows.length > 0) {
        throw new HttpException(
          'Esta credencial ya está asignada a otro cliente. Una credencial solo puede tener un cliente.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Construir query de actualización dinámicamente
    const allowedFields = ['name', 'email', 'phone', 'credential_id', 'expires_at', 'notes'];
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updateCRMClientDto).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new HttpException('No hay campos para actualizar', HttpStatus.BAD_REQUEST);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(clientId);
    values.push(tenantId);

    const updateQuery = `
      UPDATE crm_clients
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
      RETURNING id, tenant_id, name, email, phone, credential_id, expires_at, notes, created_at, updated_at;
    `;

    try {
      const result = await this.pool.query(updateQuery, values);
      console.log('🎫 [CRM] Client updated successfully:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ [CRM] Error updating client:', error);
      if (error.code === '23505') {
        if (error.constraint === 'crm_clients_tenant_credential_unique') {
          throw new HttpException(
            'Esta credencial ya está asignada a otro cliente',
            HttpStatus.BAD_REQUEST,
          );
        }
        throw new HttpException(
          'Este cliente ya existe',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (error.code === '23503') {
        throw new HttpException(
          'La credencial especificada no existe',
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        'Error al actualizar cliente',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Eliminar un cliente CRM
   */
  async deleteClient(tenantId: string, clientId: string) {
    // Verificar acceso CRM
    const hasCRMAccess = await this.verifyCRMAccess(tenantId);
    if (!hasCRMAccess) {
      throw new HttpException(
        'No tienes acceso al CRM. Requiere suscripción activa (Preferencial, CRM PLUS o CRM PRO)',
        HttpStatus.FORBIDDEN,
      );
    }

    const query = `
      DELETE FROM crm_clients
      WHERE id = $1 AND tenant_id = $2
      RETURNING id;
    `;

    try {
      const result = await this.pool.query(query, [clientId, tenantId]);
      if (result.rows.length === 0) {
        throw new HttpException('Cliente no encontrado', HttpStatus.NOT_FOUND);
      }
      return { message: 'Cliente eliminado correctamente', id: result.rows[0].id };
    } catch (error) {
      if (error.status === 404) throw error;
      throw new HttpException(
        'Error al eliminar cliente',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener estadísticas del CRM
   */
  async getStats(tenantId: string) {
    // Verificar acceso CRM
    const hasCRMAccess = await this.verifyCRMAccess(tenantId);
    if (!hasCRMAccess) {
      throw new HttpException(
        'No tienes acceso al CRM. Requiere suscripción activa (Preferencial, CRM PLUS o CRM PRO)',
        HttpStatus.FORBIDDEN,
      );
    }

    const query = `
      SELECT
        COUNT(*) as total_clients,
        COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_clients,
        COUNT(CASE WHEN expires_at <= CURRENT_TIMESTAMP AND expires_at IS NOT NULL THEN 1 END) as expired_clients,
        COUNT(CASE WHEN expires_at <= (CURRENT_TIMESTAMP + INTERVAL '5 days') AND expires_at > CURRENT_TIMESTAMP THEN 1 END) as expiring_soon
      FROM crm_clients
      WHERE tenant_id = $1;
    `;

    try {
      const result = await this.pool.query(query, [tenantId]);
      return result.rows[0];
    } catch (error) {
      throw new HttpException(
        'Error al obtener estadísticas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener credenciales disponibles para asignar a clientes CRM
   * Retorna todas las credenciales activas del tenant que pueden ser reasignadas
   */
  async getAvailableCredentials(tenantId: string) {
    // Verificar acceso CRM
    const hasCRMAccess = await this.verifyCRMAccess(tenantId);
    if (!hasCRMAccess) {
      throw new HttpException(
        'No tienes acceso al CRM. Requiere suscripción activa (Preferencial, CRM PLUS o CRM PRO)',
        HttpStatus.FORBIDDEN,
      );
    }

    // Obtener todas las credenciales disponibles del tenant
    // Incluyen tanto credenciales sin asignar como aquellas ya asignadas a servicios
    const query = `
      SELECT 
        c.id,
        c.product_code,
        c.email,
        c.profile_name,
        c.pin,
        c.status,
        c.created_at,
        (SELECT COUNT(*) FROM crm_clients WHERE credential_id = c.id) as clients_assigned,
        (SELECT expires_at FROM services WHERE credential_id = c.id LIMIT 1) as service_expires_at
      FROM credentials c
      WHERE c.tenant_id = $1
        AND c.status IN ('available', 'assigned')
      ORDER BY c.created_at DESC;
    `;

    try {
      const result = await this.pool.query(query, [tenantId]);
      return result.rows;
    } catch (error) {
      console.error('Error obtener credenciales disponibles:', error);
      throw new HttpException(
        'Error al obtener credenciales disponibles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
