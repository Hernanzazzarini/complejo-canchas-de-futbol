/** Espejo de CanchaDto del backend (dtos/output/cancha.dto.ts). */
export interface Cancha {
  id: number;
  nombre: string;
  techada: boolean;
  precioPorHora: number;
  activa: boolean;
  propietarioId: number;
}

/**
 * Cuerpo de POST /canchas. `propietarioId` es obligatorio: un alta siempre
 * nombra a un dueño, y sólo el ADMIN puede darla.
 */
export interface CrearCanchaPayload {
  nombre: string;
  precioPorHora: number;
  techada?: boolean;
  activa?: boolean;
  propietarioId: number;
}

/** Cuerpo de PATCH /canchas/:id. Sólo el ADMIN puede mandar propietarioId. */
export type ActualizarCanchaPayload = Partial<CrearCanchaPayload>;
