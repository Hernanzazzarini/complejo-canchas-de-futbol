import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dtos/input/register.dto';
import { LoginDto } from '../dtos/input/login.dto';
import { UsuarioDto } from '../dtos/output/usuario.dto';
import { LoginResponseDto } from '../dtos/output/login-response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolUsuario } from '../enums/rol-usuario.enum';
import { UsuarioActual } from '../decorators/usuario-actual.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  @ApiResponse({ status: 201, type: UsuarioDto })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  register(@Body() dto: RegisterDto): Promise<UsuarioDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener el token' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('propietarios')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dar de alta un dueño de complejo (ADMIN)',
    description:
      'El registro público sólo crea clientes: este es el único camino a un ' +
      'PROPIETARIO. Cada uno administra únicamente sus canchas y sus reservas.',
  })
  @ApiResponse({ status: 201, type: UsuarioDto })
  @ApiResponse({ status: 403, description: 'Requiere rol ADMIN' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  crearPropietario(@Body() dto: RegisterDto): Promise<UsuarioDto> {
    return this.authService.crearPropietario(dto);
  }

  @Get('propietarios')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar los dueños de complejo (ADMIN)' })
  @ApiResponse({ status: 200, type: [UsuarioDto] })
  listarPropietarios(): Promise<UsuarioDto[]> {
    return this.authService.listarPropietarios();
  }

  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos del usuario autenticado' })
  @ApiResponse({ status: 200, type: UsuarioDto })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  perfil(@UsuarioActual() usuario: JwtPayload): Promise<UsuarioDto> {
    return this.authService.perfil(usuario.sub);
  }
}
