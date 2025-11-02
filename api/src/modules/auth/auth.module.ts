// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { EmailModule } from '../email/email.module';
import { PayPalModule } from '../paypal/paypal.module';

@Module({
  imports: [EmailModule, PayPalModule],
  controllers: [AuthController],
})
export class AuthModule {}
