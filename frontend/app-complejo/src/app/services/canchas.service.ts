import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActualizarCanchaPayload,
  Cancha,
  CrearCanchaPayload,
} from '../models/cancha.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class CanchasService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/canchas`;

  /** GET /canchas — público, no necesita token. Devuelve solo las activas. */
  listar(): Observable<Cancha[]> {
    return this.http.get<Cancha[]>(this.url);
  }

  /** GET /canchas/:id */
  obtener(id: number): Observable<Cancha> {
    return this.http.get<Cancha>(`${this.url}/${id}`);
  }

  /**
   * GET /canchas/mias (PROPIETARIO/ADMIN). Incluye las dadas de baja: el dueño
   * necesita verlas para reactivarlas. El ADMIN ve las de todos.
   */
  listarPropias(): Observable<Cancha[]> {
    return this.http.get<Cancha[]>(`${this.url}/mias`);
  }

  /** POST /canchas — sólo ADMIN. */
  crear(datos: CrearCanchaPayload): Observable<Cancha> {
    return this.http.post<Cancha>(this.url, datos);
  }

  /** PATCH /canchas/:id — el dueño sobre lo suyo; el ADMIN sobre todo. */
  actualizar(id: number, datos: ActualizarCanchaPayload): Observable<Cancha> {
    return this.http.patch<Cancha>(`${this.url}/${id}`, datos);
  }

  /** DELETE /canchas/:id — baja lógica: la marca inactiva y conserva el historial. */
  desactivar(id: number): Observable<Cancha> {
    return this.http.delete<Cancha>(`${this.url}/${id}`);
  }

  /** Volver a publicarla. La baja es un flag, así que alcanza con un PATCH. */
  reactivar(id: number): Observable<Cancha> {
    return this.actualizar(id, { activa: true });
  }
}
