import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CanchasService } from './canchas.service';
import { Cancha } from '../entities/cancha.entity';
import { Usuario } from '../../auth/entities/usuario.entity';
import { RolUsuario } from '../../auth/enums/rol-usuario.enum';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

const DUENIO: JwtPayload = {
  sub: 50,
  email: 'abel@mail.com',
  rol: RolUsuario.PROPIETARIO,
};
const DUENIO_AJENO: JwtPayload = {
  sub: 51,
  email: 'bonino@mail.com',
  rol: RolUsuario.PROPIETARIO,
};
const ADMIN: JwtPayload = {
  sub: 99,
  email: 'admin@mail.com',
  rol: RolUsuario.ADMIN,
};

const canchaDeDuenio = {
  id: 1,
  nombre: 'Cancha 1',
  techada: true,
  precioPorHora: 18000,
  activa: true,
  propietario: { id: DUENIO.sub } as Usuario,
} as Cancha;

const dto = {
  nombre: 'Cancha 1',
  precioPorHora: 18000,
  propietarioId: DUENIO.sub,
};

describe('CanchasService', () => {
  let service: CanchasService;
  let canchas: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let usuarios: { findOne: jest.Mock };

  beforeEach(async () => {
    canchas = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((datos) => datos as Cancha),
      save: jest.fn((datos) => Promise.resolve({ id: 7, ...datos })),
    };
    usuarios = { findOne: jest.fn() };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        CanchasService,
        { provide: getRepositoryToken(Cancha), useValue: canchas },
        { provide: getRepositoryToken(Usuario), useValue: usuarios },
      ],
    }).compile();

    service = modulo.get(CanchasService);
  });

  describe('crear', () => {
    /** El alta siempre la hace el ADMIN, así que el dueño tiene que existir. */
    const conPropietarioValido = (id = DUENIO.sub) =>
      usuarios.findOne.mockResolvedValue({ id, rol: RolUsuario.PROPIETARIO });

    it('deja al ADMIN dar de alta la cancha de un propietario', async () => {
      conPropietarioValido();

      const cancha = await service.crear(dto, ADMIN);

      expect(cancha.propietarioId).toBe(DUENIO.sub);
    });

    it('no deja que un propietario dé de alta su propia cancha', async () => {
      conPropietarioValido();

      await expect(service.crear(dto, DUENIO)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rechaza asignarle una cancha a un usuario que no es propietario', async () => {
      usuarios.findOne.mockResolvedValue({ id: 8, rol: RolUsuario.CLIENTE });

      await expect(
        service.crear({ ...dto, propietarioId: 8 }, ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('permite el mismo nombre de cancha en complejos distintos', async () => {
      conPropietarioValido(DUENIO_AJENO.sub);

      // El `findOne` de control filtra por dueño, así que no encuentra nada.
      await service.crear({ ...dto, propietarioId: DUENIO_AJENO.sub }, ADMIN);

      expect(canchas.findOne).toHaveBeenCalledWith({
        where: { nombre: dto.nombre, propietario: { id: DUENIO_AJENO.sub } },
      });
    });
  });

  describe('alcance por dueño', () => {
    it('busca la cancha acotada al propietario', async () => {
      await expect(service.desactivar(1, DUENIO_AJENO)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(canchas.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, propietario: { id: DUENIO_AJENO.sub } },
        }),
      );
    });

    it('no acota la búsqueda del ADMIN de la plataforma', async () => {
      canchas.findOne.mockResolvedValue({ ...canchaDeDuenio });

      await service.desactivar(1, ADMIN);

      expect(canchas.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('no deja que un propietario le regale su cancha a otro', async () => {
      canchas.findOne.mockResolvedValue({ ...canchaDeDuenio });

      await expect(
        service.actualizar(1, { propietarioId: DUENIO_AJENO.sub }, DUENIO),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('deja al ADMIN reasignar una cancha a otro propietario', async () => {
      canchas.findOne.mockResolvedValue({ ...canchaDeDuenio });
      usuarios.findOne.mockResolvedValue({
        id: DUENIO_AJENO.sub,
        rol: RolUsuario.PROPIETARIO,
      });

      const cancha = await service.actualizar(
        1,
        { propietarioId: DUENIO_AJENO.sub },
        ADMIN,
      );

      expect(cancha.propietarioId).toBe(DUENIO_AJENO.sub);
    });

    it('lista sólo las canchas del propietario', async () => {
      await service.listarPropias(DUENIO);

      expect(canchas.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { propietario: { id: DUENIO.sub } } }),
      );
    });
  });
});
