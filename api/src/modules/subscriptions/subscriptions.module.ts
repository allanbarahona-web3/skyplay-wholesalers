import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [SubscriptionsController],
})
export class SubscriptionsModule {}