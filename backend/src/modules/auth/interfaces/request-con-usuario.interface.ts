import { Request } from 'express';
import { JwtPayload } from './jwt-payload.interface';

/**
 * Request de Express una vez que JwtAuthGuard validó el token y adjuntó
 * el payload. Evita tener que indexar `request['user']` sin tipar.
 */
export interface RequestConUsuario extends Request {
  user?: JwtPayload;
}
