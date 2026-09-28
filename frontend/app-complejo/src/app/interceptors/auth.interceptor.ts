import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../services/api.config';
import { AuthService } from '../services/auth.service';

/**
 * Pega el Bearer en cada pedido a nuestra API y limpia la sesión si el backend
 * contesta 401 (token vencido o firmado con otro JWT_SECRET).
 */
export const authInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;

  // Sólo a nuestra API: un token nuestro no tiene por qué viajar a otro dominio.
  const pedido =
    token && peticion.url.startsWith(API_URL)
      ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : peticion;

  return siguiente(pedido).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && auth.autenticado()) {
        auth.cerrarSesion();
        void router.navigate(['/login'], {
          queryParams: { volverA: router.url },
        });
      }
      return throwError(() => error);
    }),
  );
};
