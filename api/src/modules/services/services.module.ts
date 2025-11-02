import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [ServicesController],
})
export class ServicesModule {}