import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Reserva } from '../entities/reserva.entity';
import { Cancha } from '../entities/cancha.entity';
import { EstadoReserva } from '../enums/estados-reserva.enum';
import { CrearReservaDto } from '../dtos/input/crear-reserva.dto';
import { ActualizarReservaDto } from '../dtos/input/actualizar-reserva.dto';
import { DisponibilidadQueryDto } from '../dtos/input/disponibilidad-query.dto';
import { ReservaDto } from '../dtos/output/reserva.dto';
import { DisponibilidadDto, TurnoDto } from '../dtos/output/disponibilidad.dto';
import { CanchasService } from './canchas.service';
import { RolUsuario } from '../../auth/enums/rol-usuario.enum';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import {
  DURACION_TURNO_MIN,
  HORA_APERTURA,
  HORA_CIERRE,
  aMinutos,
  ahoraISO,
  duracionEnHoras,
  grillaDeTurnos,
  hoyISO,
  normalizarHora,
  seSolapan,
} from '../utils/horarios.util';

/** Código de violación de unicidad de Postgres. */
const PG_UNIQUE_VIOLATION = '23505';

/** Quién ve los datos del cliente que reservó: el dueño de la cancha o el ADMIN. */
const esGestor = (usuario: JwtPayload): boolean =>
  usuario.rol === RolUsuario.ADMIN || usuario.rol === RolUsuario.PROPIETARIO;

@Injectable()
export class ReservasService {
  constructor(
    @InjectRepository(Reserva)
    private readonly reservaRepository: Repository<Reserva>,
    private readonly canchasService: CanchasService,
  ) {}

  async crear(dto: CrearReservaDto, usuario: JwtPayload): Promise<ReservaDto> {
    const horaInicio = normalizarHora(dto.horaInicio);
    const horaFin = normalizarHora(dto.horaFin);

    this.validarHorario(dto.fecha, horaInicio, horaFin);

    const cancha = await this.canchasService.buscarOFallar(dto.canchaId);

    if (!cancha.activa) {
      throw new BadRequestException(
        `La cancha "${cancha.nombre}" no está disponible`,
      );
    }

    await this.validarSinSolapamiento(
      cancha.id,
      dto.fecha,
      horaInicio,
      horaFin,
    );

    const reserva = this.reservaRepository.create({
      fecha: dto.fecha,
      horaInicio,
      horaFin,
      estado: EstadoReserva.CONFIRMADA,
      precioTotal: this.calcularPrecio(cancha, horaInicio, horaFin),
      cancha,
      usuario: { id: usuario.sub },
    });

    const guardada = await this.guardar(reserva);

    return this.toDto({ ...guardada, cancha });
  }

  /**
   * Mueve un turno de fecha y/u horario, dentro de la misma cancha. La puede
   * mover el cliente que reservó, el dueño de la cancha o el ADMIN.
   */
  async actualizar(
    id: number,
    dto: ActualizarReservaDto,
    usuario: JwtPayload,
  ): Promise<ReservaDto> {
    const reserva = await this.buscarOFallar(id);
    this.validarPropiedad(reserva, usuario);

    if (reserva.estado === EstadoReserva.CANCELADA) {
      throw new ConflictException(
        'La reserva está cancelada: hay que sacar un turno nuevo',
      );
    }

    if (this.yaPaso(reserva.fecha, reserva.horaInicio)) {
      throw new BadRequestException(
        'No se puede modificar un turno que ya pasó',
      );
    }

    if (!reserva.cancha.activa) {
      throw new BadRequestException(
        `La cancha "${reserva.cancha.nombre}" no está disponible`,
      );
    }

    const fecha = dto.fecha ?? reserva.fecha;
    const horaInicio = normalizarHora(dto.horaInicio ?? reserva.horaInicio);
    const horaFin = normalizarHora(dto.horaFin ?? reserva.horaFin);

    this.validarHorario(fecha, horaInicio, horaFin);

    // Se ignora a sí misma: correr el turno una hora no es chocar consigo mismo.
    await this.validarSinSolapamiento(
      reserva.cancha.id,
      fecha,
      horaInicio,
      horaFin,
      reserva.id,
    );

    reserva.fecha = fecha;
    reserva.horaInicio = horaInicio;
    reserva.horaFin = horaFin;
    reserva.precioTotal = this.calcularPrecio(
      reserva.cancha,
      horaInicio,
      horaFin,
    );

    const guardada = await this.guardar(reserva);

    return this.toDto(guardada, esGestor(usuario));
  }

  /** Reservas del usuario autenticado, de la más reciente a la más vieja. */
  async listarMias(usuario: JwtPayload): Promise<ReservaDto[]> {
    const reservas = await this.reservaRepository.find({
      where: { usuario: { id: usuario.sub } },
      relations: { cancha: true },
      order: { fecha: 'DESC', horaInicio: 'DESC' },
    });

    return reservas.map((reserva) => this.toDto(reserva));
  }

  /**
   * Listado de administración; se puede filtrar por fecha y/o cancha.
   * Un PROPIETARIO sólo ve las reservas de sus propias canchas: el filtro va
   * en el `where`, así no hay forma de que se le cuele una de otro complejo.
   */
  async listarTodas(
    filtros: { fecha?: string; canchaId?: number },
    actor: JwtPayload,
  ): Promise<ReservaDto[]> {
    const cancha = {
      ...(filtros.canchaId ? { id: filtros.canchaId } : {}),
      ...(actor.rol === RolUsuario.PROPIETARIO
        ? { propietario: { id: actor.sub } }
        : {}),
    };

    const reservas = await this.reservaRepository.find({
      where: {
        ...(filtros.fecha ? { fecha: filtros.fecha } : {}),
        ...(Object.keys(cancha).length > 0 ? { cancha } : {}),
      },
      relations: { cancha: { propietario: true }, usuario: true },
      order: { fecha: 'DESC', horaInicio: 'DESC' },
    });

    return reservas.map((reserva) => this.toDto(reserva, true));
  }

  async obtener(id: number, usuario: JwtPayload): Promise<ReservaDto> {
    const reserva = await this.buscarOFallar(id);
    this.validarPropiedad(reserva, usuario);

    return this.toDto(reserva, esGestor(usuario));
  }

  /** Cancela la reserva. La puede cancelar su dueño o un ADMIN. */
  async cancelar(id: number, usuario: JwtPayload): Promise<ReservaDto> {
    const reserva = await this.buscarOFallar(id);
    this.validarPropiedad(reserva, usuario);

    if (reserva.estado === EstadoReserva.CANCELADA) {
      throw new ConflictException('La reserva ya estaba cancelada');
    }

    if (this.yaPaso(reserva.fecha, reserva.horaInicio)) {
      throw new BadRequestException(
        'No se puede cancelar un turno que ya pasó',
      );
    }

    reserva.estado = EstadoReserva.CANCELADA;
    const guardada = await this.reservaRepository.save(reserva);

    return this.toDto(guardada, esGestor(usuario));
  }

  /** Grilla del día con cada turno marcado como libre u ocupado. */
  async disponibilidad(
    query: DisponibilidadQueryDto,
  ): Promise<DisponibilidadDto> {
    const cancha = await this.canchasService.buscarOFallar(query.canchaId);

    const ocupadas = await this.reservaRepository.find({
      where: {
        cancha: { id: cancha.id },
        fecha: query.fecha,
        estado: EstadoReserva.CONFIRMADA,
      },
    });

    const esHoy = query.fecha === hoyISO();
    const ahora = ahoraISO();

    const turnos: TurnoDto[] = grillaDeTurnos().map(
      ({ horaInicio, horaFin }) => {
        const ocupado = ocupadas.some((reserva) =>
          seSolapan(
            horaInicio,
            horaFin,
            normalizarHora(reserva.horaInicio),
            normalizarHora(reserva.horaFin),
          ),
        );
        const yaPaso = esHoy && aMinutos(horaInicio) <= aMinutos(ahora);

        return {
          horaInicio,
          horaFin,
          disponible: cancha.activa && !ocupado && !yaPaso,
          precio: this.calcularPrecio(cancha, horaInicio, horaFin),
        };
      },
    );

    return {
      canchaId: cancha.id,
      cancha: cancha.nombre,
      fecha: query.fecha,
      turnos,
    };
  }

  private async buscarOFallar(id: number): Promise<Reserva> {
    const reserva = await this.reservaRepository.findOne({
      where: { id },
      relations: { cancha: { propietario: true }, usuario: true },
    });

    if (!reserva) {
      throw new NotFoundException(`No existe la reserva ${id}`);
    }

    return reserva;
  }

  /**
   * Quién puede ver o cancelar una reserva: el cliente que la hizo, el dueño
   * de la cancha y el ADMIN de la plataforma.
   */
  private validarPropiedad(reserva: Reserva, usuario: JwtPayload): void {
    if (reserva.usuario?.id === usuario.sub) {
      return;
    }

    if (usuario.rol === RolUsuario.ADMIN) {
      return;
    }

    if (usuario.rol === RolUsuario.PROPIETARIO) {
      if (reserva.cancha?.propietario?.id === usuario.sub) {
        return;
      }

      // Es de otro complejo: ni siquiera le confirmamos que el id existe.
      throw new NotFoundException(`No existe la reserva ${reserva.id}`);
    }

    throw new ForbiddenException('La reserva pertenece a otro usuario');
  }

  private validarHorario(fecha: string, inicio: string, fin: string): void {
    if (aMinutos(fin) <= aMinutos(inicio)) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la de inicio',
      );
    }

    const duracion = aMinutos(fin) - aMinutos(inicio);

    if (duracion % DURACION_TURNO_MIN !== 0) {
      throw new BadRequestException(
        `La reserva debe ser en bloques de ${DURACION_TURNO_MIN} minutos`,
      );
    }

    if (
      aMinutos(inicio) < aMinutos(HORA_APERTURA) ||
      aMinutos(fin) > aMinutos(HORA_CIERRE)
    ) {
      throw new BadRequestException(
        `El complejo abre de ${HORA_APERTURA.slice(0, 5)} a ${HORA_CIERRE.slice(0, 5)}`,
      );
    }

    if (this.yaPaso(fecha, inicio)) {
      throw new BadRequestException(
        'No se puede reservar un turno que ya pasó',
      );
    }
  }

  /**
   * `ignorarId` excluye una reserva del control: al mover un turno, la propia
   * reserva sigue en la tabla y si no se la saca se choca consigo misma.
   */
  private async validarSinSolapamiento(
    canchaId: number,
    fecha: string,
    inicio: string,
    fin: string,
    ignorarId?: number,
  ): Promise<void> {
    // `hora_inicio < fin AND hora_fin > inicio` es la condición de solapamiento;
    // los turnos que arrancan justo cuando termina otro no cuentan.
    const consulta = this.reservaRepository
      .createQueryBuilder('reserva')
      .where('reserva.cancha = :canchaId', { canchaId })
      .andWhere('reserva.fecha = :fecha', { fecha })
      .andWhere('reserva.estado = :estado', {
        estado: EstadoReserva.CONFIRMADA,
      })
      .andWhere('reserva.horaInicio < :fin', { fin })
      .andWhere('reserva.horaFin > :inicio', { inicio });

    if (ignorarId !== undefined) {
      consulta.andWhere('reserva.id != :ignorarId', { ignorarId });
    }

    const solapada = await consulta.getOne();

    if (solapada) {
      throw new ConflictException(
        `El turno se superpone con otra reserva (${solapada.horaInicio} a ${solapada.horaFin})`,
      );
    }
  }

  /**
   * Guarda traduciendo la violación del índice único parcial a un 409: entre
   * la consulta de solapamiento y el `save` puede colarse otro pedido, y
   * `uq_turno_confirmado` es el que decide de verdad quién se quedó el turno.
   */
  private async guardar(reserva: Reserva): Promise<Reserva> {
    try {
      return await this.reservaRepository.save(reserva);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Ese turno acaba de ser reservado');
      }

      throw error;
    }
  }

  private calcularPrecio(cancha: Cancha, inicio: string, fin: string): number {
    const total = Number(cancha.precioPorHora) * duracionEnHoras(inicio, fin);
    return Math.round(total * 100) / 100;
  }

  private yaPaso(fecha: string, hora: string): boolean {
    const hoy = hoyISO();

    if (fecha < hoy) {
      return true;
    }

    return fecha === hoy && aMinutos(hora) <= aMinutos(ahoraISO());
  }

  private toDto(reserva: Reserva, incluirUsuario = false): ReservaDto {
    const dto: ReservaDto = {
      id: reserva.id,
      fecha: reserva.fecha,
      horaInicio: reserva.horaInicio,
      horaFin: reserva.horaFin,
      estado: reserva.estado,
      precioTotal: Number(reserva.precioTotal),
      cancha: CanchasService.toDto(reserva.cancha),
    };

    if (incluirUsuario && reserva.usuario) {
      dto.usuario = {
        id: reserva.usuario.id,
        nombre: reserva.usuario.nombre,
        email: reserva.usuario.email,
        rol: reserva.usuario.rol,
      };
    }

    return dto;
  }
}
