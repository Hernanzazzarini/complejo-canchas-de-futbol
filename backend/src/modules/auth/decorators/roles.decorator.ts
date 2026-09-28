import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../enums/rol-usuario.enum';

export const ROLES_KEY = 'roles';

/** Restringe el endpoint a los roles indicados. Requiere RolesGuard. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
