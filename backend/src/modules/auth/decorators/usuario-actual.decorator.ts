import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { RequestConUsuario } from '../interfaces/request-con-usuario.interface';

/**
 * Devuelve el payload del JWT. Sólo tiene valor en rutas protegidas con
 * `@UseGuards(JwtAuthGuard)`, que es quien adjunta `request.user`.
 */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    return request.user as JwtPayload;
  },
);
