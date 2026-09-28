import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RolUsuario } from '../models/usuario.model';
import { AuthService } from '../services/auth.service';

/** Deja pasar sólo con sesión iniciada; si no, manda al login y vuelve después. */
export const authGuard: CanActivateFn = (_ruta, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { volverA: estado.url },
  });
};

/**
 * Además del login, exige un rol. Es sólo comodidad de navegación: quien
 * manda es el RolesGuard del backend, que es el que ve el token de verdad.
 */
export function rolGuard(...roles: RolUsuario[]): CanActivateFn {
  return (ruta, estado) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const permitido = authGuard(ruta, estado);
    if (permitido !== true) return permitido;

    const rol = auth.rol();
    return rol && roles.includes(rol) ? true : router.createUrlTree(['/']);
  };
}
