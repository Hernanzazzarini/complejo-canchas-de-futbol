import { ApiProperty } from '@nestjs/swagger';
import { RolUsuario } from '../../enums/rol-usuario.enum';

export class UsuarioDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: RolUsuario })
  rol: RolUsuario;
}
