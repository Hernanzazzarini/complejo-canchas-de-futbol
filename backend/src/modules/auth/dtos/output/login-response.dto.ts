import { ApiProperty } from '@nestjs/swagger';
import { UsuarioDto } from './usuario.dto';

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: UsuarioDto })
  usuario: UsuarioDto;
}
