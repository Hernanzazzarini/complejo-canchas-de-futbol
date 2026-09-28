import { Cancha } from './cancha.model';
import { Usuario } from './usuario.model';

/** Espejo de EstadoReserva del backend. */
export type EstadoReserva = 'CONFIRMADA' | 'CANCELADA';

/** Espejo de TurnoDto. Las horas vienen como 'HH:MM:SS'. */
export interface Turno {
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
  precio: number;
}

/** Espejo de DisponibilidadDto. `cancha` es el nombre, no el objeto. */
export interface Disponibilidad {
  canchaId: number;
  cancha: string;
  fecha: string;
  turnos: Turno[];
}

/** Espejo de ReservaDto. `usuario` sólo llega en listados de gestión. */
export interface Reserva {
  id: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: EstadoReserva;
  precioTotal: number;
  cancha: Cancha;
  usuario?: Usuario;
}

/** Cuerpo de POST /reservas. Las horas van en 'HH:MM' o 'HH:MM:SS'. */
export interface CrearReservaPayload {
  canchaId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}
