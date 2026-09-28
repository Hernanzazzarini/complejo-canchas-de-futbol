import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mismos pipes que main.ts, si no las validaciones no corren en los tests.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('GET / informa el estado del servicio y de la base', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(({ body }) => {
        expect(body.estado).toBe('ok');
        expect(body.baseDatos).toBe('ok');
      });
  });

  it('GET /canchas lista las canchas activas', () => {
    return request(app.getHttpServer())
      .get('/canchas')
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body)).toBe(true);
      });
  });

  it('GET /auth/perfil sin token devuelve 401', () => {
    return request(app.getHttpServer()).get('/auth/perfil').expect(401);
  });

  // Los guards corren antes que el ValidationPipe: sin token es 401, no 400.
  it('POST /reservas sin token devuelve 401 aunque el body sea inválido', () => {
    return request(app.getHttpServer())
      .post('/reservas')
      .send({ canchaId: 'no-es-un-numero' })
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
