import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SanitizedExceptionFilter } from './common/filters/http-exception.filter';

function resolveAllowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN?.trim();
  if (configured) {
    return configured
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  if (process.env.NODE_ENV === 'production') {
    return ['http://localhost', 'http://localhost:4200'];
  }
  return ['http://localhost:4200', 'http://127.0.0.1:4200'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');
  expressApp.set('trust proxy', 1);

  // Limite stricte de taille des corps de requête (anti-DoS JSON/URL-encoded)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // En-têtes de sécurité : CSP stricte, HSTS, X-Content-Type-Options, Frameguard, Referrer-Policy
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // CORS restreint au(x) domaine(s) exact(s), jamais '*' avec credentials
  const allowedOrigins = resolveAllowedOrigins();
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origine CORS non autorisée.'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'ngsw-bypass'],
  });

  app.setGlobalPrefix('api', {
    exclude: ['health', 'api/health'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new SanitizedExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API Résidence Blue démarrée sur http://localhost:${port}`);
}
bootstrap();
