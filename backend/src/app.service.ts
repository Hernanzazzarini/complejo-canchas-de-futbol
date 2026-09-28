import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EstadoDto } from './dtos/estado.dto';

const SERVICIO = 'complejo-futbol-api';

@Injectable()
export class AppService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Health check: además de responder, comprueba que Postgres esté al alcance.
   * Si la base no contesta devuelve 503, para que un deploy o un monitor se
   * entere en vez de ver un 200 engañoso.
   */
  async estado(): Promise<EstadoDto> {
    const base: Omit<EstadoDto, 'estado' | 'baseDatos'> = {
      servicio: SERVICIO,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        ...base,
        estado: 'degradado',
        baseDatos: 'sin conexión',
      });
    }

    return { ...base, estado: 'ok', baseDatos: 'ok' };
  }
}
