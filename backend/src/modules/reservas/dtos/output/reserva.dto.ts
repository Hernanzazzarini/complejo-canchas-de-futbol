import { ApiProperty } from '@nestjs/swagger';
import { EstadoReserva } from '../../enums/estados-reserva.enum';
import { CanchaDto } from './cancha.dto';
import { UsuarioDto } from '../../../auth/dtos/output/usuario.dto';

export class ReservaDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: '2026-09-25' })
  fecha: string;

  @ApiProperty({ example: '19:00:00' })
  horaInicio: string;

  @ApiProperty({ example: '20:00:00' })
  horaFin: string;

  @ApiProperty({ enum: EstadoReserva })
  estado: EstadoReserva;

  @ApiProperty({ example: 12000.0 })
  precioTotal: number;

  @ApiProperty({ type: CanchaDto })
  cancha: CanchaDto;

  @ApiProperty({
    type: UsuarioDto,
    required: false,
    description: 'Sólo se incluye en los listados de administración',
  })
  usuario?: UsuarioDto;
}
