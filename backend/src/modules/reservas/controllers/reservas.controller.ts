import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReservasService } from '../services/reservas.service';
import { CrearReservaDto } from '../dtos/input/crear-reserva.dto';
import { ActualizarReservaDto } from '../dtos/input/actualizar-reserva.dto';
import { DisponibilidadQueryDto } from '../dtos/input/disponibilidad-query.dto';
import { ReservaDto } from '../dtos/output/reserva.dto';
import { DisponibilidadDto } from '../dtos/output/disponibilidad.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolUsuario } from '../../auth/enums/rol-usuario.enum';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('Reservas')
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @Get('disponibilidad')
  @ApiOperation({
    summary: 'Turnos libres y ocupados de una cancha en una fecha (público)',
  })
  @ApiResponse({ status: 200, type: DisponibilidadDto })
  @ApiResponse({ status: 404, description: 'La cancha no existe' })
  disponibilidad(
    @Query() query: DisponibilidadQueryDto,
  ): Promise<DisponibilidadDto> {
    return this.reservasService.disponibilidad(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reservar un turno' })
  @ApiResponse({ status: 201, type: ReservaDto })
  @ApiResponse({
    status: 400,
    description: 'Horario inválido o fuera de rango',
  })
  @ApiResponse({ status: 409, description: 'El turno ya está ocupado' })
  crear(
    @Body() dto: CrearReservaDto,
    @UsuarioActual() usuario: JwtPayload,
  ): Promise<ReservaDto> {
    return this.reservasService.crear(dto, usuario);
  }

  @Get('mias')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mis reservas' })
  @ApiResponse({ status: 200, type: [ReservaDto] })
  listarMias(@UsuarioActual() usuario: JwtPayload): Promise<ReservaDto[]> {
    return this.reservasService.listarMias(usuario);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.PROPIETARIO)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar reservas (PROPIETARIO/ADMIN)',
    description:
      'El propietario ve sólo las reservas de sus canchas; el ADMIN de la ' +
      'plataforma ve las de todos los complejos.',
  })
  @ApiQuery({ name: 'fecha', required: false, example: '2026-09-25' })
  @ApiQuery({ name: 'canchaId', required: false, type: Number })
  @ApiResponse({ status: 200, type: [ReservaDto] })
  listarTodas(
    @UsuarioActual() usuario: JwtPayload,
    @Query('fecha') fecha?: string,
    @Query('canchaId', new ParseIntPipe({ optional: true })) canchaId?: number,
  ): Promise<ReservaDto[]> {
    return this.reservasService.listarTodas({ fecha, canchaId }, usuario);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detalle de una reserva' })
  @ApiResponse({ status: 200, type: ReservaDto })
  @ApiResponse({ status: 403, description: 'La reserva es de otro usuario' })
  obtener(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: JwtPayload,
  ): Promise<ReservaDto> {
    return this.reservasService.obtener(id, usuario);
  }

  @Patch(':id/cancelar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancelar una reserva',
    description:
      'La puede cancelar el cliente que reservó, el dueño de la cancha o el ADMIN.',
  })
  @ApiResponse({ status: 200, type: ReservaDto })
  @ApiResponse({ status: 400, description: 'El turno ya pasó' })
  @ApiResponse({ status: 409, description: 'Ya estaba cancelada' })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: JwtPayload,
  ): Promise<ReservaDto> {
    return this.reservasService.cancelar(id, usuario);
  }

  // Va después de ':id/cancelar' para no comerse esa ruta.
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mover un turno de fecha u horario',
    description:
      'La puede modificar el cliente que reservó, el dueño de la cancha o el ' +
      'ADMIN. La cancha no se cambia: para eso es una reserva nueva.',
  })
  @ApiResponse({ status: 200, type: ReservaDto })
  @ApiResponse({
    status: 400,
    description: 'Horario inválido, fuera de rango o el turno ya pasó',
  })
  @ApiResponse({ status: 409, description: 'El turno nuevo ya está ocupado' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarReservaDto,
    @UsuarioActual() usuario: JwtPayload,
  ): Promise<ReservaDto> {
    return this.reservasService.actualizar(id, dto, usuario);
  }
}
