import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CRMService } from './crm.service';
import { CreateCRMClientDto } from './dto/create-crm-client.dto';
import { UpdateCRMClientDto } from './dto/update-crm-client.dto';

@Controller('api/crm')
@UseGuards(AuthGuard('jwt'))
export class CRMController {
  constructor(private crmService: CRMService) {}

  /**
   * POST /api/crm/clients - Crear un nuevo cliente
   */
  @Post('clients')
  async createClient(@Req() req: any, @Body() createCRMClientDto: CreateCRMClientDto) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new HttpException('Tenant no identificado', HttpStatus.UNAUTHORIZED);
    }
    return this.crmService.createClient(tenantId, createCRMClientDto);
  }

  /**
   * GET /api/crm/clients - Obtener todos los clientes del tenant
   */
  @Get('clients')
  async getClients(@Req() req: any) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new HttpException('Tenant no identificado', HttpStatus.UNAUTHORIZED);
    }
    return this.crmService.getClients(tenantId);
  }

  /**
   * GET /api/crm/clients/:id - Obtener un cliente específico
   */
  @Get('clients/:id')
  async getClient(@Req() req: any, @Param('id') clientId: string) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new HttpException('Tenant no identificado', HttpStatus.UNAUTHORIZED);
    }
    return this.crmService.getClient(tenantId, clientId);
  }

  /**
   * PUT /api/crm/clients/:id - Actualizar un cliente
   */
  @Put('clients/:id')
  async updateClient(
    @Req() req: any,
    @Param('id') clientId: string,
    @Body() updateCRMClientDto: UpdateCRMClientDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new HttpException('Tenant no identificado', HttpStatus.UNAUTHORIZED);
    }
    return this.crmService.updateClient(tenantId, clientId, updateCRMClientDto);
  }

  /**
   * DELETE /api/crm/clients/:id - Eliminar un cliente
   */
  @Delete('clients/:id')
  async deleteClient(@Req() req: any, @Param('id') clientId: string) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new HttpException('Tenant no identificado', HttpStatus.UNAUTHORIZED);
    }
    return this.crmService.deleteClient(tenantId, clientId);
  }

  /**
   * GET /api/crm/stats - Obtener estadísticas del CRM
   */
  @Get('stats')
  async getStats(@Req() req: any) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new HttpException('Tenant no identificado', HttpStatus.UNAUTHORIZED);
    }
    return this.crmService.getStats(tenantId);
  }

  /**
   * GET /api/crm/available-credentials - Obtener credenciales disponibles (últimas 15 min)
   */
  @Get('available-credentials')
  async getAvailableCredentials(@Req() req: any) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new HttpException('Tenant no identificado', HttpStatus.UNAUTHORIZED);
    }
    return this.crmService.getAvailableCredentials(tenantId);
  }
}
