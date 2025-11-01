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
  
  // CORS - Solo dominios específicos
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [
        'https://skyplay.com', // Tu dominio de producción
        'https://www.skyplay.com',
        'https://mayoristas.skyplay.com',
      ]
    : [
        'http://localhost:3001', // Frontend principal dev
        'http://localhost:3002', // Frontend alternativo
      ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (como Postman, curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked request from: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  await app.listen(3000);
  console.log(`API on http://localhost:3000/api`);
}
bootstrap();