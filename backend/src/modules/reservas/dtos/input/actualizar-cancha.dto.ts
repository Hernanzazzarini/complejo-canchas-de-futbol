import { PartialType } from '@nestjs/swagger';
import { CrearCanchaDto } from './crear-cancha.dto';

export class ActualizarCanchaDto extends PartialType(CrearCanchaDto) {}
