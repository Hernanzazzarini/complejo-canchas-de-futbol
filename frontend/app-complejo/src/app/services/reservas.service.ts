import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CrearReservaPayload,
  Disponibilidad,
  Reserva,
} from '../models/reserva.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/reservas`;

  /**
   * GET /reservas/disponibilidad — público. El backend arma la grilla del día
   * (17:00 a 23:00, turnos de una hora) y marca cada uno libre u ocupado;
   * también da por ocupados los que ya pasaron si la fecha es hoy.
   */
  disponibilidad(canchaId: number, fecha: string): Observable<Disponibilidad> {
    const params = new HttpParams()
      .set('canchaId', canchaId)
      .set('fecha', fecha);

    return this.http.get<Disponibilidad>(`${this.url}/disponibilidad`, {
      params,
    });
  }

  /** POST /reservas — requiere sesión; el interceptor pone el token. */
  crear(datos: CrearReservaPayload): Observable<Reserva> {
    return this.http.post<Reserva>(this.url, datos);
  }

  /** GET /reservas/mias — las del usuario logueado, de todos los complejos. */
  listarMias(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(`${this.url}/mias`);
  }

  /**
   * GET /reservas (PROPIETARIO/ADMIN). El scope lo aplica el backend en el
   * `where`: el dueño recibe sólo las de sus canchas, sin pedirlo. Acá los
   * filtros son de pantalla, no de seguridad.
   */
  listarTodas(filtros: { fecha?: string; canchaId?: number }): Observable<Reserva[]> {
    let params = new HttpParams();
    if (filtros.fecha) params = params.set('fecha', filtros.fecha);
    if (filtros.canchaId) params = params.set('canchaId', filtros.canchaId);

    return this.http.get<Reserva[]>(this.url, { params });
  }

  /** PATCH /reservas/:id/cancelar */
  cancelar(id: number): Observable<Reserva> {
    return this.http.patch<Reserva>(`${this.url}/${id}/cancelar`, {});
  }
}
