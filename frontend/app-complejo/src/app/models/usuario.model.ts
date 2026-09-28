/** Espejo de RolUsuario del backend (auth/enums/rol-usuario.enum.ts). */
export type RolUsuario = 'CLIENTE' | 'PROPIETARIO' | 'ADMIN';

/** Espejo de UsuarioDto. Nunca trae la password. */
export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
}

/** Espejo de LoginResponseDto. */
export interface LoginResponse {
  accessToken: string;
  usuario: Usuario;
}

/** Cuerpo de POST /auth/login. */
export interface LoginPayload {
  email: string;
  password: string;
}

/** Cuerpo de POST /auth/register. El backend siempre crea un CLIENTE. */
export interface RegisterPayload {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
}
