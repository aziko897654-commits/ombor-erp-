import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());

  // FR-9.2: serve uploaded logos so the UI (and cross-origin prod
  // frontend) can display them; CORP override lets the image embed
  // cross-origin, everything else keeps helmet's same-origin default
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/api/v1/uploads',
    setHeaders: (res: Response) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });
  // Allow the configured origin(s) (comma-separated) plus any *.vercel.app
  // deployment, so the frontend keeps working across Vercel redeploys.
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // same-origin / curl / SSR
      let host = '';
      try {
        host = new URL(origin).hostname;
      } catch {
        /* malformed origin → treat as not allowed */
      }
      const ok = allowedOrigins.includes(origin) || host.endsWith('.vercel.app');
      callback(null, ok);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
