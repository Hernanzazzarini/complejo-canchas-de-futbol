import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Necesario para que @Type() convierta los query params, que llegan
      // siempre como string.
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Complejo Fútbol 5')
    .setDescription('API de reservas de turnos')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup(
    'api',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const puerto = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(puerto);

  new Logger('Bootstrap').log(
    `API en http://localhost:${puerto} — Swagger en http://localhost:${puerto}/api`,
  );
}

void bootstrap();
