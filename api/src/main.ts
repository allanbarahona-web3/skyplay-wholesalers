// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  // Sirve API bajo /api
  app.setGlobalPrefix('api');

  // Sirve archivos estáticos
  app.useStaticAssets(join(__dirname, '..', '..', 'app', 'public'));

  // Habilitar CORS para tu HTML
  app.enableCors({
    origin: 'http://localhost:3000', // URL donde sirves el HTML
    credentials: true, // Permite enviar cookies
  });

  await app.listen(3000);
  console.log(`API on http://localhost:3000/api`);
}
bootstrap();
