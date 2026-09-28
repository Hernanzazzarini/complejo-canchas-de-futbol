import { OmitType, PartialType } from '@nestjs/swagger';
import { CrearReservaDto } from './crear-reserva.dto';

/**
 * Mover un turno: cambia la fecha y/o el horario, nunca la cancha. Pasarse a
 * otro complejo es una reserva nueva, no una edición; mandar `canchaId` da 400.
 */
export class ActualizarReservaDto extends OmitType(
  PartialType(CrearReservaDto),
  ['canchaId'] as const,
) {}
