import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { EmailModule } from '../email/email.module';
import { PayPalModule } from '../paypal/paypal.module';

@Module({
  imports: [EmailModule, PayPalModule],
  controllers: [ServicesController],
})
export class ServicesModule {}