export enum RolUsuario {
  /** Reserva turnos. Puede reservar en las canchas de cualquier propietario. */
  CLIENTE = 'CLIENTE',
  /** Dueño de una o más canchas: sólo ve y administra lo suyo. */
  PROPIETARIO = 'PROPIETARIO',
  /** Administrador de la plataforma: da de alta a los propietarios. */
  ADMIN = 'ADMIN',
}
