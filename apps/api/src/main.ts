import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Sécurité des headers HTTP
  app.use(helmet());

  // CORS sécurisé
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Préfixe global pour toutes les routes API (sauf GET /health exposé aussi à la racine)
  app.setGlobalPrefix('api', {
    exclude: ['health', 'api/health'],
  });

  // RÈGLE SÉCURITÉ AGENTS.MD : ValidationPipe stricte (whitelist + forbidNonWhitelisted)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[Résidence Blue API] En écoute sur le port ${port}`);
}

bootstrap();
