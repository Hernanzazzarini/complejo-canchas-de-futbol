import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  Usuario,
} from '../models/usuario.model';
import { API_URL } from './api.config';

const CLAVE_SESION = 'complejo.sesion';

interface Sesion {
  accessToken: string;
  usuario: Usuario;
}

/**
 * Lee el `exp` del JWT sin verificar la firma. No es una validación de
 * seguridad —de eso se encarga el backend— sino una forma de no arrancar la
 * app con un token que ya sabemos vencido y comerse un 401 en la primera
 * pantalla.
 */
function tokenVigente(token: string): boolean {
  try {
    const [, cuerpo] = token.split('.');
    const datos = JSON.parse(atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof datos.exp === 'number' && datos.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function leerSesion(): Sesion | null {
  try {
    const crudo = localStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;

    const sesion = JSON.parse(crudo) as Sesion;
    if (!sesion?.accessToken || !tokenVigente(sesion.accessToken)) {
      localStorage.removeItem(CLAVE_SESION);
      return null;
    }
    return sesion;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/auth`;

  /** Se hidrata desde localStorage: recargar la página no desloguea. */
  private readonly sesion = signal<Sesion | null>(leerSesion());

  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this.sesion() !== null);
  readonly rol = computed(() => this.sesion()?.usuario.rol ?? null);

  /** ADMIN y PROPIETARIO administran; el CLIENTE sólo reserva. */
  readonly esGestor = computed(
    () => this.rol() === 'ADMIN' || this.rol() === 'PROPIETARIO',
  );

  /** El ADMIN además da de alta canchas y propietarios. */
  readonly esAdmin = computed(() => this.rol() === 'ADMIN');

  get token(): string | null {
    return this.sesion()?.accessToken ?? null;
  }

  login(datos: LoginPayload): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.url}/login`, datos)
      .pipe(tap((respuesta) => this.guardar(respuesta)));
  }

  /**
   * POST /auth/register devuelve el usuario pero NO un token, así que el alta
   * por sí sola no deja la sesión iniciada. Quien llame decide si loguear.
   */
  registrar(datos: RegisterPayload): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.url}/register`, datos);
  }

  /** GET /auth/perfil — pide el usuario de vuelta al backend, ya autenticado. */
  perfil(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.url}/perfil`);
  }

  /** GET /auth/propietarios — sólo ADMIN. */
  listarPropietarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.url}/propietarios`);
  }

  /**
   * POST /auth/propietarios — sólo ADMIN. El registro público siempre crea un
   * CLIENTE: este es el único camino a un dueño de complejo.
   */
  crearPropietario(datos: RegisterPayload): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.url}/propietarios`, datos);
  }

  cerrarSesion(): void {
    this.sesion.set(null);
    localStorage.removeItem(CLAVE_SESION);
  }

  private guardar(respuesta: LoginResponse): void {
    const sesion: Sesion = {
      accessToken: respuesta.accessToken,
      usuario: respuesta.usuario,
    };
    this.sesion.set(sesion);
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  }
}
