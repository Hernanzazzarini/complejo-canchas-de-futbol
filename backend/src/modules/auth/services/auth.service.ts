import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../entities/usuario.entity';
import { RolUsuario } from '../enums/rol-usuario.enum';
import { RegisterDto } from '../dtos/input/register.dto';
import { LoginDto } from '../dtos/input/login.dto';
import { UsuarioDto } from '../dtos/output/usuario.dto';
import { LoginResponseDto } from '../dtos/output/login-response.dto';

const RONDAS_BCRYPT = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly jwtService: JwtService,
  ) {}

  /** El registro público siempre crea clientes. */
  async register(dto: RegisterDto): Promise<UsuarioDto> {
    return this.crearUsuario(dto, RolUsuario.CLIENTE);
  }

  /**
   * Alta de un dueño de complejo. Sólo la puede hacer el ADMIN de la
   * plataforma: es el único camino para que exista un PROPIETARIO.
   */
  async crearPropietario(dto: RegisterDto): Promise<UsuarioDto> {
    return this.crearUsuario(dto, RolUsuario.PROPIETARIO);
  }

  /** Para que el ADMIN sepa a qué id asignarle una cancha. */
  async listarPropietarios(): Promise<UsuarioDto[]> {
    const propietarios = await this.usuarioRepository.find({
      where: { rol: RolUsuario.PROPIETARIO },
      order: { nombre: 'ASC' },
    });

    return propietarios.map((propietario) => this.toDto(propietario));
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const usuario = await this.usuarioRepository.findOne({
      where: { email: dto.email },
    });

    if (!usuario) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const coincide = await bcrypt.compare(dto.password, usuario.password);

    if (!coincide) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    });

    return { accessToken, usuario: this.toDto(usuario) };
  }

  /** Datos frescos del usuario del token (el JWT puede tener el rol viejo). */
  async perfil(id: number): Promise<UsuarioDto> {
    const usuario = await this.usuarioRepository.findOne({ where: { id } });

    if (!usuario) {
      throw new NotFoundException('El usuario no existe');
    }

    return this.toDto(usuario);
  }

  private async crearUsuario(
    dto: RegisterDto,
    rol: RolUsuario,
  ): Promise<UsuarioDto> {
    const existente = await this.usuarioRepository.findOne({
      where: { email: dto.email },
    });

    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }

    const usuario = this.usuarioRepository.create({
      nombre: dto.nombre,
      email: dto.email,
      telefono: dto.telefono,
      password: await bcrypt.hash(dto.password, RONDAS_BCRYPT),
      rol,
    });

    return this.toDto(await this.usuarioRepository.save(usuario));
  }

  private toDto(usuario: Usuario): UsuarioDto {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };
  }
}
