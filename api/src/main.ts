// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useStaticAssets(join(__dirname, '..', '..', 'app', 'public'));
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500'
    ],
    credentials: true,
  });

  await app.listen(3000);
  console.log(`API on http://localhost:3000/api`);
}
bootstrap();