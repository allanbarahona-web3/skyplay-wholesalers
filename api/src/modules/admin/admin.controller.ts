import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../../guards/auth.guard';
import { RoleGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/roles.decorator';

@Controller('admin')
@UseGuards(AuthGuard, RoleGuard) // Requiere autenticación Y validación de roles
@Roles('admin') // SOLO usuarios con role='admin' pueden acceder
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('payments/pending')
  getPendingPayments() {
    return this.adminService.getPendingPayments();
  }

  @Post('payments/approve')
  approvePayment(@Body() body: { paymentId: string }) {
    return this.adminService.approvePayment(body.paymentId);
  }

  @Post('payments/reject')
  rejectPayment(@Body() body: { paymentId: string }) {
    return this.adminService.rejectPayment(body.paymentId);
  }

  @Get('tenants')
  async getTenants() {
    // Devuelve todos los mayoristas activos
    return this.adminService.getTenants();
  }

  @Get('wholesaler-requests')
  async getWholesalerRequests() {
    // Devuelve todas las solicitudes con status = 'pending'
    return this.adminService.getWholesalerRequests();
  }

  @Post('wholesaler-requests/:id/approve')
  async approveWholesalerRequest(@Param('id') id: string, @Body() body: { approved_by: number }) {
    // Aprueba la solicitud y crea el tenant
    return this.adminService.approveWholesalerRequest(id, body.approved_by);
  }

  @Post('wholesaler-requests/:id/reject')
  async rejectWholesalerRequest(@Param('id') id: string, @Body() body: { reason?: string }) {
    // Rechaza la solicitud y actualiza el status
    return this.adminService.rejectWholesalerRequest(id, body.reason);
  }

  @Get('orders/sinpe-pending')
  async getSinpePendingOrders() {
    // Devuelve todas las órdenes SINPE pendientes de confirmación
    return this.adminService.getSinpePendingOrders();
  }

  @Post('orders/:orderId/confirm-sinpe')
  async confirmSinpeOrder(@Param('orderId') orderId: string) {
    // Confirma pago SINPE, asigna credenciales y actualiza orden
    return this.adminService.confirmSinpeOrder(parseInt(orderId));
  }
}
