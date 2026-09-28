import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { CanchasService } from './canchas.service';
import { Reserva } from '../entities/reserva.entity';
import { Cancha } from '../entities/cancha.entity';
import { EstadoReserva } from '../enums/estados-reserva.enum';
import { Usuario } from '../../auth/entities/usuario.entity';
import { RolUsuario } from '../../auth/enums/rol-usuario.enum';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

const CLIENTE: JwtPayload = {
  sub: 1,
  email: 'cliente@mail.com',
  rol: RolUsuario.CLIENTE,
};
const ADMIN: JwtPayload = {
  sub: 99,
  email: 'admin@mail.com',
  rol: RolUsuario.ADMIN,
};
/** Dueño de la cancha de los tests. */
const DUENIO: JwtPayload = {
  sub: 50,
  email: 'abel@mail.com',
  rol: RolUsuario.PROPIETARIO,
};
/** Dueño de otro complejo: no tiene que ver nada de lo de DUENIO. */
const DUENIO_AJENO: JwtPayload = {
  sub: 51,
  email: 'bonino@mail.com',
  rol: RolUsuario.PROPIETARIO,
};

const cancha: Cancha = {
  id: 1,
  nombre: 'Cancha 1',
  techada: true,
  precioPorHora: 18000,
  activa: true,
  propietario: { id: DUENIO.sub } as Usuario,
  reservas: [],
};

/** Fecha futura fija para que los tests no dependan del día en que corren. */
const MANANA = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
})();

const AYER = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();

describe('ReservasService', () => {
  let service: ReservasService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: { [k: string]: jest.Mock };

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((datos) => datos as Reserva),
      save: jest.fn((datos) => Promise.resolve({ id: 10, ...datos })),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        ReservasService,
        { provide: getRepositoryToken(Reserva), useValue: repo },
        {
          provide: CanchasService,
          useValue: { buscarOFallar: jest.fn().mockResolvedValue(cancha) },
        },
      ],
    }).compile();

    service = modulo.get(ReservasService);
  });

  describe('crear', () => {
    const dto = {
      canchaId: 1,
      fecha: MANANA,
      horaInicio: '19:00',
      horaFin: '20:00',
    };

    it('guarda la reserva y calcula el precio por hora', async () => {
      const reserva = await service.crear(dto, CLIENTE);

      expect(reserva.precioTotal).toBe(18000);
      expect(reserva.horaInicio).toBe('19:00:00');
      expect(reserva.estado).toBe(EstadoReserva.CONFIRMADA);
    });

    it('prorratea el precio en reservas de más de una hora', async () => {
      const reserva = await service.crear(
        { ...dto, horaFin: '21:00' },
        CLIENTE,
      );

      expect(reserva.precioTotal).toBe(36000);
    });

    it('rechaza si la hora de fin no es posterior a la de inicio', async () => {
      await expect(
        service.crear({ ...dto, horaFin: '19:00' }, CLIENTE),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza fuera del horario del complejo', async () => {
      await expect(
        service.crear(
          { ...dto, horaInicio: '06:00', horaFin: '07:00' },
          CLIENTE,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza el turno que arranca justo antes de abrir', async () => {
      await expect(
        service.crear(
          { ...dto, horaInicio: '16:00', horaFin: '17:00' },
          CLIENTE,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('acepta el primer turno del día', async () => {
      const reserva = await service.crear(
        { ...dto, horaInicio: '17:00', horaFin: '18:00' },
        CLIENTE,
      );

      expect(reserva.horaInicio).toBe('17:00:00');
    });

    it('rechaza una fecha pasada', async () => {
      await expect(
        service.crear({ ...dto, fecha: AYER }, CLIENTE),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza duraciones que no son múltiplo del turno', async () => {
      await expect(
        service.crear({ ...dto, horaFin: '19:40' }, CLIENTE),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si el turno se superpone con otra reserva', async () => {
      queryBuilder.getOne.mockResolvedValue({
        id: 5,
        horaInicio: '19:30:00',
        horaFin: '20:30:00',
      });

      await expect(service.crear(dto, CLIENTE)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rechaza si la cancha está inactiva', async () => {
      const canchas = service['canchasService'] as unknown as {
        buscarOFallar: jest.Mock;
      };
      canchas.buscarOFallar.mockResolvedValue({ ...cancha, activa: false });

      await expect(service.crear(dto, CLIENTE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('cancelar', () => {
    const reservaFutura = {
      id: 10,
      fecha: MANANA,
      horaInicio: '19:00:00',
      horaFin: '20:00:00',
      estado: EstadoReserva.CONFIRMADA,
      precioTotal: 18000,
      creadoEn: new Date(),
      cancha,
      usuario: { id: CLIENTE.sub, rol: RolUsuario.CLIENTE },
    };

    it('deja al dueño cancelar su reserva', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });

      const reserva = await service.cancelar(10, CLIENTE);

      expect(reserva.estado).toBe(EstadoReserva.CANCELADA);
    });

    it('deja al ADMIN cancelar la reserva de otro', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });

      const reserva = await service.cancelar(10, ADMIN);

      expect(reserva.estado).toBe(EstadoReserva.CANCELADA);
    });

    it('no deja cancelar la reserva de otro cliente', async () => {
      repo.findOne.mockResolvedValue({
        ...reservaFutura,
        usuario: { id: 777 },
      });

      await expect(service.cancelar(10, CLIENTE)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('no deja cancelar dos veces', async () => {
      repo.findOne.mockResolvedValue({
        ...reservaFutura,
        estado: EstadoReserva.CANCELADA,
      });

      await expect(service.cancelar(10, CLIENTE)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('no deja cancelar un turno que ya pasó', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura, fecha: AYER });

      await expect(service.cancelar(10, CLIENTE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('deja al dueño de la cancha cancelar una reserva de su complejo', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });

      const reserva = await service.cancelar(10, DUENIO);

      expect(reserva.estado).toBe(EstadoReserva.CANCELADA);
    });

    it('al dueño de otro complejo le responde 404, no 403', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });

      // Un 403 le confirmaría que la reserva existe; el 404 no le dice nada.
      await expect(service.cancelar(10, DUENIO_AJENO)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('actualizar', () => {
    const reservaFutura = {
      id: 10,
      fecha: MANANA,
      horaInicio: '19:00:00',
      horaFin: '20:00:00',
      estado: EstadoReserva.CONFIRMADA,
      precioTotal: 18000,
      cancha,
      usuario: { id: CLIENTE.sub, rol: RolUsuario.CLIENTE },
    };

    it('mueve el turno y recalcula el precio', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });

      const reserva = await service.actualizar(
        10,
        { horaInicio: '20:00', horaFin: '22:00' },
        CLIENTE,
      );

      expect(reserva.horaInicio).toBe('20:00:00');
      expect(reserva.precioTotal).toBe(36000);
    });

    it('deja cambiar sólo la fecha y mantiene el horario', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });

      const reserva = await service.actualizar(10, { fecha: MANANA }, CLIENTE);

      expect(reserva.horaInicio).toBe('19:00:00');
      expect(reserva.horaFin).toBe('20:00:00');
    });

    it('no se considera solapada consigo misma', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });

      await service.actualizar(10, { horaFin: '21:00' }, CLIENTE);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'reserva.id != :ignorarId',
        { ignorarId: 10 },
      );
    });

    it('rechaza el turno nuevo si lo tiene otro', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });
      queryBuilder.getOne.mockResolvedValue({
        id: 5,
        horaInicio: '21:00:00',
        horaFin: '22:00:00',
      });

      await expect(
        service.actualizar(
          10,
          { horaInicio: '21:00', horaFin: '22:00' },
          CLIENTE,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza moverlo fuera del horario del complejo', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });

      await expect(
        service.actualizar(
          10,
          { horaInicio: '16:00', horaFin: '17:00' },
          CLIENTE,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no deja modificar una reserva cancelada', async () => {
      repo.findOne.mockResolvedValue({
        ...reservaFutura,
        estado: EstadoReserva.CANCELADA,
      });

      await expect(
        service.actualizar(10, { horaInicio: '20:00' }, CLIENTE),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('no deja modificar un turno que ya pasó', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura, fecha: AYER });

      await expect(
        service.actualizar(10, { fecha: MANANA }, CLIENTE),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no deja modificar la reserva de otro cliente', async () => {
      repo.findOne.mockResolvedValue({
        ...reservaFutura,
        usuario: { id: 777 },
      });

      await expect(
        service.actualizar(10, { horaInicio: '20:00' }, CLIENTE),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('deja al dueño de la cancha mover un turno de su complejo', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });

      const reserva = await service.actualizar(
        10,
        { horaInicio: '20:00', horaFin: '21:00' },
        DUENIO,
      );

      expect(reserva.horaInicio).toBe('20:00:00');
    });

    it('al dueño de otro complejo le responde 404, no 403', async () => {
      repo.findOne.mockResolvedValue({ ...reservaFutura });

      await expect(
        service.actualizar(10, { horaInicio: '20:00' }, DUENIO_AJENO),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('aislamiento entre complejos', () => {
    it('acota el listado del propietario a sus propias canchas', async () => {
      await service.listarTodas({}, DUENIO);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cancha: { propietario: { id: DUENIO.sub } } },
        }),
      );
    });

    it('mantiene el filtro de dueño aunque se pida una cancha ajena', async () => {
      await service.listarTodas({ canchaId: 777 }, DUENIO);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cancha: { id: 777, propietario: { id: DUENIO.sub } } },
        }),
      );
    });

    it('no acota el listado del ADMIN de la plataforma', async () => {
      await service.listarTodas({}, ADMIN);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('le muestra al dueño los datos del cliente que reservó', async () => {
      repo.findOne.mockResolvedValue({
        id: 10,
        fecha: MANANA,
        horaInicio: '19:00:00',
        horaFin: '20:00:00',
        estado: EstadoReserva.CONFIRMADA,
        precioTotal: 18000,
        cancha,
        usuario: { id: CLIENTE.sub, nombre: 'Cliente', email: CLIENTE.email },
      });

      const reserva = await service.obtener(10, DUENIO);

      expect(reserva.usuario?.email).toBe(CLIENTE.email);
    });
  });

  describe('disponibilidad', () => {
    it('marca como ocupados los turnos que pisan una reserva confirmada', async () => {
      repo.find.mockResolvedValue([
        { horaInicio: '19:00:00', horaFin: '21:00:00' },
      ]);

      const { turnos } = await service.disponibilidad({
        canchaId: 1,
        fecha: MANANA,
      });

      const ocupados = turnos
        .filter((t) => !t.disponible)
        .map((t) => t.horaInicio);

      expect(ocupados).toEqual(['19:00:00', '20:00:00']);
    });

    it('devuelve todos los turnos libres si no hay reservas', async () => {
      const { turnos } = await service.disponibilidad({
        canchaId: 1,
        fecha: MANANA,
      });

      expect(turnos.every((t) => t.disponible)).toBe(true);
      expect(turnos[0].precio).toBe(18000);
    });
  });
});
