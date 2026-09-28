import { ApiProperty } from '@nestjs/swagger';

export class TurnoDto {
  @ApiProperty({ example: '19:00:00' })
  horaInicio: string;

  @ApiProperty({ example: '20:00:00' })
  horaFin: string;

  @ApiProperty({ example: true })
  disponible: boolean;

  @ApiProperty({ example: 12000.0 })
  precio: number;
}

export class DisponibilidadDto {
  @ApiProperty({ example: 1 })
  canchaId: number;

  @ApiProperty({ example: 'Cancha 1' })
  cancha: string;

  @ApiProperty({ example: '2026-09-25' })
  fecha: string;

  @ApiProperty({ type: [TurnoDto] })
  turnos: TurnoDto[];
}
