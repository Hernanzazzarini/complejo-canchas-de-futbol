import { ApiProperty } from '@nestjs/swagger';

export class CanchaDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  techada: boolean;

  @ApiProperty({ example: 12000.0 })
  precioPorHora: number;

  @ApiProperty()
  activa: boolean;

  @ApiProperty({ example: 3, description: 'Usuario dueño del complejo' })
  propietarioId: number;
}
