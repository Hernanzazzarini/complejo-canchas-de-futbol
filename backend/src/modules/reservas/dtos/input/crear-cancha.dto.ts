import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CrearCanchaDto {
  @ApiProperty({ example: 'Cancha 1' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  nombre: string;

  @ApiProperty({ example: 12000.0, description: 'Precio por hora en pesos' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioPorHora: number;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  techada?: boolean;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @ApiProperty({
    example: 3,
    description:
      'Dueño de la cancha: el id de un usuario con rol PROPIETARIO. Sólo el ' +
      'ADMIN da de alta canchas, y siempre a nombre de alguien.',
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  propietarioId: number;
}
