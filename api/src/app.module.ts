import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './modules/db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { MeModule } from './modules/me/me.module';
import { ServicesModule } from './modules/services/services.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmailModule } from './modules/email/email.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
  DbModule,
  AuthModule,
  MeModule,
  ServicesModule,
  SubscriptionsModule,
  AdminModule,
  EmailModule,
  ],
})
export class AppModule {}