import { Module } from '@nestjs/common';
import { CRMController } from './crm.controller';
import { CRMService } from './crm.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [CRMController],
  providers: [CRMService],
  exports: [CRMService],
})
export class CRMModule {}
