import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
// src/main.ts
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { TimeoutInterceptor } from './shared/interceptors/timeout.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Enable CORS
  // Tip: In development, you can keep origin as true or an array of localhost URLs.
  // In production, explicitly list allowed origins via env (comma-separated).
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true, // true echoes request origin (dev-friendly)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-Client-Id', // IMPORTANT: custom header used by the frontend
    ],
    exposedHeaders: ['Content-Length', 'Content-Range'],
    credentials: true, // allow cookies/authorization header if needed
    maxAge: 86400, // cache preflight response (in seconds)
  });

  const config = new DocumentBuilder()
    .setTitle('Weather API')
    .setDescription('Weather application API documentation')
    .setVersion('1.0')
    .addTag('weather')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global error filter
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  // Global timeout interceptor
  app.useGlobalInterceptors(new TimeoutInterceptor(5000));

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}
void bootstrap();
