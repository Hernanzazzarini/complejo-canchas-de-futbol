import { ApiProperty } from '@nestjs/swagger';

export class EstadoDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'degradado'] })
  estado: 'ok' | 'degradado';

  @ApiProperty({ example: 'complejo-futbol-api' })
  servicio: string;

  @ApiProperty({ example: 'ok', enum: ['ok', 'sin conexión'] })
  baseDatos: string;

  @ApiProperty({ example: 42, description: 'Segundos desde que arrancó' })
  uptime: number;

  @ApiProperty({ example: '2026-09-20T18:30:00.000Z' })
  timestamp: string;
}
