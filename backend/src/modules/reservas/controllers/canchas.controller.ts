import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
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
import { CanchasService } from '../services/canchas.service';
import { CrearCanchaDto } from '../dtos/input/crear-cancha.dto';
import { ActualizarCanchaDto } from '../dtos/input/actualizar-cancha.dto';
import { CanchaDto } from '../dtos/output/cancha.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolUsuario } from '../../auth/enums/rol-usuario.enum';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('Canchas')
@Controller('canchas')
export class CanchasController {
  constructor(private readonly canchasService: CanchasService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar canchas de todos los complejos (público)',
  })
  @ApiQuery({
    name: 'todas',
    required: false,
    type: Boolean,
    description: 'Incluir las inactivas',
  })
  @ApiResponse({ status: 200, type: [CanchaDto] })
  listar(
    @Query('todas', new ParseBoolPipe({ optional: true })) todas?: boolean,
  ): Promise<CanchaDto[]> {
    return this.canchasService.listar(todas ?? false);
  }

  // Va antes de `:id`, si no Nest interpreta "mias" como un id y falla.
  @Get('mias')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.PROPIETARIO)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mis canchas (PROPIETARIO/ADMIN)',
    description:
      'Incluye las dadas de baja. El ADMIN de la plataforma ve las de todos.',
  })
  @ApiResponse({ status: 200, type: [CanchaDto] })
  listarPropias(@UsuarioActual() usuario: JwtPayload): Promise<CanchaDto[]> {
    return this.canchasService.listarPropias(usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una cancha' })
  @ApiResponse({ status: 200, type: CanchaDto })
  @ApiResponse({ status: 404, description: 'La cancha no existe' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<CanchaDto> {
    return this.canchasService.obtener(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dar de alta una cancha (sólo ADMIN)',
    description:
      'El alta es del administrador de la plataforma, que indica en ' +
      'propietarioId a qué dueño pertenece. Un PROPIETARIO no crea canchas: ' +
      'administra las que le dieron de alta.',
  })
  @ApiResponse({ status: 201, type: CanchaDto })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN' })
  @ApiResponse({
    status: 409,
    description: 'Ese dueño ya tiene una cancha con ese nombre',
  })
  crear(
    @Body() dto: CrearCanchaDto,
    @UsuarioActual() usuario: JwtPayload,
  ): Promise<CanchaDto> {
    return this.canchasService.crear(dto, usuario);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.PROPIETARIO)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar una cancha propia (PROPIETARIO/ADMIN)',
    description:
      'Sólo el ADMIN puede cambiar el propietarioId (reasignar el complejo).',
  })
  @ApiResponse({ status: 200, type: CanchaDto })
  @ApiResponse({ status: 404, description: 'No existe o es de otro dueño' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCanchaDto,
    @UsuarioActual() usuario: JwtPayload,
  ): Promise<CanchaDto> {
    return this.canchasService.actualizar(id, dto, usuario);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.PROPIETARIO)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dar de baja una cancha propia (PROPIETARIO/ADMIN)',
    description: 'Baja lógica: la marca inactiva, conserva el historial.',
  })
  @ApiResponse({ status: 200, type: CanchaDto })
  @ApiResponse({ status: 404, description: 'No existe o es de otro dueño' })
  desactivar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: JwtPayload,
  ): Promise<CanchaDto> {
    return this.canchasService.desactivar(id, usuario);
  }
}
