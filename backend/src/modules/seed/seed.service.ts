import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../auth/entities/usuario.entity';
import { RolUsuario } from '../auth/enums/rol-usuario.enum';

/**
 * `POST /auth/register` siempre crea usuarios CLIENTE, así que sin esto no
 * habría forma de tener un ADMIN ni, por lo tanto, de dar de alta a los
 * dueños de los complejos. Corre en cada arranque pero es idempotente.
 *
 * Las canchas ya no se siembran: cada una pertenece a un PROPIETARIO, y el
 * ADMIN los crea con `POST /auth/propietarios` una vez levantada la API.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.crearAdmin();
  }

  private async crearAdmin(): Promise<void> {
    const email =
      this.configService.get<string>('ADMIN_EMAIL') ?? 'admin@complejo.com';
    const password =
      this.configService.get<string>('ADMIN_PASSWORD') ?? 'admin1234';

    const existente = await this.usuarioRepository.findOne({
      where: { email },
    });

    if (existente) {
      // Nunca se pisa la contraseña de una cuenta que ya existe; como mucho,
      // se le da el rol si se había registrado como cliente.
      if (existente.rol !== RolUsuario.ADMIN) {
        existente.rol = RolUsuario.ADMIN;
        await this.usuarioRepository.save(existente);
        this.logger.log(`Usuario ${email} promovido a ADMIN`);
      }

      return;
    }

    await this.usuarioRepository.save(
      this.usuarioRepository.create({
        nombre: 'Administrador',
        email,
        password: await bcrypt.hash(password, 10),
        rol: RolUsuario.ADMIN,
      }),
    );

    this.logger.log(`ADMIN inicial creado: ${email} / ${password}`);
  }
}
