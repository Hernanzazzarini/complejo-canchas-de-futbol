import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolUsuario } from '../enums/rol-usuario.enum';
import { RequestConUsuario } from '../interfaces/request-con-usuario.interface';

/**
 * Se usa siempre después de JwtAuthGuard:
 * `@UseGuards(JwtAuthGuard, RolesGuard)`, porque lee `request.user.rol`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<
      RolUsuario[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const usuario = request.user;

    if (!usuario || !rolesRequeridos.includes(usuario.rol)) {
      throw new ForbiddenException('No tenés permisos para esta operación');
    }

    return true;
  }
}
