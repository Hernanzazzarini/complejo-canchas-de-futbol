import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('estado', () => {
    it('informa ok cuando la base responde', async () => {
      const estado = await appController.estado();

      expect(estado.estado).toBe('ok');
      expect(estado.baseDatos).toBe('ok');
      expect(estado.servicio).toBe('complejo-futbol-api');
      expect(typeof estado.uptime).toBe('number');
    });

    it('devuelve 503 cuando la base no responde', async () => {
      dataSource.query.mockRejectedValue(new Error('conexión caída'));

      await expect(appController.estado()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
