import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Module({
  providers: [EmailService],
  exports: [EmailService], // Exportamos para usar en otros módulos
})
export class EmailModule {}
