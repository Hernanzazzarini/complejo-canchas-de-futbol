import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive, Matches } from 'class-validator';

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

export class CrearReservaDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  canchaId: number;

  @ApiProperty({ example: '2026-09-25', description: 'Formato YYYY-MM-DD' })
  @Matches(FORMATO_FECHA, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  fecha: string;

  @ApiProperty({ example: '19:00', description: 'Formato HH:MM' })
  @Matches(FORMATO_HORA, {
    message: 'La hora de inicio debe tener formato HH:MM',
  })
  horaInicio: string;

  @ApiProperty({ example: '20:00', description: 'Formato HH:MM' })
  @Matches(FORMATO_HORA, { message: 'La hora de fin debe tener formato HH:MM' })
  horaFin: string;
}
