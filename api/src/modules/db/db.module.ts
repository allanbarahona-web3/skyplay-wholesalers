import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'PG_POOL',
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>('DATABASE_URL');
        return new Pool({ connectionString });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['PG_POOL'],
})
export class DbModule {}