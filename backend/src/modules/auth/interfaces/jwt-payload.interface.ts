import { RolUsuario } from '../enums/rol-usuario.enum';

export interface JwtPayload {
  sub: number;
  email: string;
  rol: RolUsuario;
}
