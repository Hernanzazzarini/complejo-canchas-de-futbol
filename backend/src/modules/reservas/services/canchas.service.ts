import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cancha } from '../entities/cancha.entity';
import { CrearCanchaDto } from '../dtos/input/crear-cancha.dto';
import { ActualizarCanchaDto } from '../dtos/input/actualizar-cancha.dto';
import { CanchaDto } from '../dtos/output/cancha.dto';
import { Usuario } from '../../auth/entities/usuario.entity';
import { RolUsuario } from '../../auth/enums/rol-usuario.enum';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class CanchasService {
  constructor(
    @InjectRepository(Cancha)
    private readonly canchaRepository: Repository<Cancha>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  /** Alta de una cancha. Es exclusiva del ADMIN, que le asigna el dueño. */
  async crear(dto: CrearCanchaDto, actor: JwtPayload): Promise<CanchaDto> {
    const propietarioId = await this.resolverPropietario(
      dto.propietarioId,
      actor,
    );

    await this.validarNombreLibre(dto.nombre, propietarioId);

    const cancha = this.canchaRepository.create({
      nombre: dto.nombre,
      precioPorHora: dto.precioPorHora,
      techada: dto.techada,
      activa: dto.activa,
      propietario: { id: propietarioId } as Usuario,
    });

    return CanchasService.toDto(await this.canchaRepository.save(cancha));
  }

  /** Listado público: las canchas de todos los complejos, sólo las activas. */
  async listar(todas = false): Promise<CanchaDto[]> {
    const canchas = await this.canchaRepository.find({
      where: todas ? {} : { activa: true },
      relations: { propietario: true },
      order: { nombre: 'ASC' },
    });

    return canchas.map(CanchasService.toDto);
  }

  /**
   * Panel de administración: un PROPIETARIO ve sólo sus canchas (incluidas las
   * dadas de baja); el ADMIN de la plataforma las ve todas.
   */
  async listarPropias(actor: JwtPayload): Promise<CanchaDto[]> {
    const canchas = await this.canchaRepository.find({
      where: this.alcance(actor),
      relations: { propietario: true },
      order: { nombre: 'ASC' },
    });

    return canchas.map(CanchasService.toDto);
  }

  async obtener(id: number): Promise<CanchaDto> {
    return CanchasService.toDto(await this.buscarOFallar(id));
  }

  async actualizar(
    id: number,
    dto: ActualizarCanchaDto,
    actor: JwtPayload,
  ): Promise<CanchaDto> {
    const cancha = await this.buscarPropiaOFallar(id, actor);
    const propietarioActual = cancha.propietario.id;
    let propietarioId = propietarioActual;

    if (
      dto.propietarioId !== undefined &&
      dto.propietarioId !== propietarioActual
    ) {
      if (actor.rol !== RolUsuario.ADMIN) {
        throw new ForbiddenException(
          'Sólo el administrador puede cambiar el dueño de una cancha',
        );
      }

      propietarioId = await this.resolverPropietario(dto.propietarioId, actor);
    }

    const nombre = dto.nombre ?? cancha.nombre;

    // El nombre se valida contra el dueño que va a quedar, no contra el actual.
    if (nombre !== cancha.nombre || propietarioId !== propietarioActual) {
      await this.validarNombreLibre(nombre, propietarioId, id);
    }

    cancha.propietario = { id: propietarioId } as Usuario;
    cancha.nombre = nombre;
    cancha.precioPorHora = dto.precioPorHora ?? cancha.precioPorHora;
    cancha.techada = dto.techada ?? cancha.techada;
    cancha.activa = dto.activa ?? cancha.activa;

    return CanchasService.toDto(await this.canchaRepository.save(cancha));
  }

  /**
   * Baja lógica: las reservas históricas apuntan a la cancha, así que no se
   * borra la fila, se marca como inactiva y deja de aceptar turnos.
   */
  async desactivar(id: number, actor: JwtPayload): Promise<CanchaDto> {
    const cancha = await this.buscarPropiaOFallar(id, actor);
    cancha.activa = false;
    return CanchasService.toDto(await this.canchaRepository.save(cancha));
  }

  /**
   * Devuelve la entidad (no el DTO) para uso interno de ReservasService.
   * Sin filtro de dueño a propósito: un cliente reserva en cualquier complejo.
   */
  async buscarOFallar(id: number): Promise<Cancha> {
    const cancha = await this.canchaRepository.findOne({
      where: { id },
      relations: { propietario: true },
    });

    if (!cancha) {
      throw new NotFoundException(`No existe la cancha ${id}`);
    }

    return cancha;
  }

  /**
   * Igual que `buscarOFallar` pero acotada al dueño. El filtro va en el `where`
   * y no en un chequeo posterior: al propietario de otro complejo le sale un
   * 404, así no puede averiguar qué ids existen.
   */
  private async buscarPropiaOFallar(
    id: number,
    actor: JwtPayload,
  ): Promise<Cancha> {
    const cancha = await this.canchaRepository.findOne({
      where: { id, ...this.alcance(actor) },
      relations: { propietario: true },
    });

    if (!cancha) {
      throw new NotFoundException(`No existe la cancha ${id}`);
    }

    return cancha;
  }

  /** Condición de dueño: vacía para el ADMIN, que ve toda la plataforma. */
  private alcance(actor: JwtPayload) {
    return actor.rol === RolUsuario.ADMIN
      ? {}
      : { propietario: { id: actor.sub } };
  }

  /**
   * Las canchas las da de alta el ADMIN y siempre a nombre de un dueño, así
   * que acá no hay caso "el propietario la crea para sí mismo".
   */
  private async resolverPropietario(
    propietarioId: number,
    actor: JwtPayload,
  ): Promise<number> {
    if (actor.rol !== RolUsuario.ADMIN) {
      throw new ForbiddenException(
        'Sólo el administrador da de alta canchas y les asigna dueño',
      );
    }

    const propietario = await this.usuarioRepository.findOne({
      where: { id: propietarioId },
    });

    if (!propietario || propietario.rol !== RolUsuario.PROPIETARIO) {
      throw new BadRequestException(
        `El usuario ${propietarioId} no es un propietario`,
      );
    }

    return propietarioId;
  }

  private async validarNombreLibre(
    nombre: string,
    propietarioId: number,
    ignorarId?: number,
  ): Promise<void> {
    const existente = await this.canchaRepository.findOne({
      where: { nombre, propietario: { id: propietarioId } },
    });

    if (existente && existente.id !== ignorarId) {
      throw new ConflictException('Ya tenés una cancha con ese nombre');
    }
  }

  static toDto(cancha: Cancha): CanchaDto {
    return {
      id: cancha.id,
      nombre: cancha.nombre,
      techada: cancha.techada,
      // `decimal` de Postgres llega como string.
      precioPorHora: Number(cancha.precioPorHora),
      activa: cancha.activa,
      propietarioId: cancha.propietario?.id,
    };
  }
}
