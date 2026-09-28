import { HttpErrorResponse } from '@angular/common/http';
import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Disponibilidad, Turno } from '../../models/reserva.model';
import { AuthService } from '../../services/auth.service';
import { ReservasService } from '../../services/reservas.service';
import { fechaLarga, hhmm, hoyISO, sumarDias } from '../../utils/fechas';

/** Hasta cuándo se puede reservar hacia adelante. */
const DIAS_A_FUTURO = 30;

@Component({
  selector: 'app-reservar',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './reservar.html',
  styleUrl: './reservar.css',
})
export class Reservar implements OnInit {
  private readonly reservas = inject(ReservasService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  private canchaId = 0;

  readonly fecha = signal(hoyISO());
  readonly disponibilidad = signal<Disponibilidad | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /** La hora del turno que se está confirmando, para deshabilitar sólo ése. */
  readonly enviando = signal<string | null>(null);
  readonly exito = signal<string | null>(null);

  readonly minima = hoyISO();
  readonly maxima = sumarDias(hoyISO(), DIAS_A_FUTURO);

  readonly tituloFecha = computed(() => fechaLarga(this.fecha()));
  readonly hayLibres = computed(
    () => this.disponibilidad()?.turnos.some((t) => t.disponible) ?? false,
  );

  readonly hhmm = hhmm;

  ngOnInit(): void {
    this.canchaId = Number(this.ruta.snapshot.paramMap.get('canchaId'));
    this.cargar();
  }

  cambiarFecha(valor: string): void {
    if (!valor) return;
    this.fecha.set(valor);
    this.exito.set(null);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.reservas.disponibilidad(this.canchaId, this.fecha()).subscribe({
      next: (datos) => {
        this.disponibilidad.set(datos);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 404
            ? 'Esa cancha no existe.'
            : 'No pudimos conectarnos con el servidor. Verificá que la API esté levantada.',
        );
        this.cargando.set(false);
      },
    });
  }

  reservar(turno: Turno): void {
    if (!turno.disponible || this.enviando()) return;

    // La grilla es pública, reservar no: recién acá hace falta la sesión.
    if (!this.auth.autenticado()) {
      void this.router.navigate(['/login'], {
        queryParams: { volverA: this.router.url },
      });
      return;
    }

    this.enviando.set(turno.horaInicio);
    this.error.set(null);
    this.exito.set(null);

    this.reservas
      .crear({
        canchaId: this.canchaId,
        fecha: this.fecha(),
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
      })
      .subscribe({
        next: () => {
          this.exito.set(
            `Turno confirmado: ${fechaLarga(this.fecha())} de ${hhmm(turno.horaInicio)} a ${hhmm(turno.horaFin)}.`,
          );
          this.enviando.set(null);
          // Recargar deja el turno marcado como ocupado sin inventar el estado.
          this.cargar();
        },
        error: (e: HttpErrorResponse) => {
          this.error.set(this.mensaje(e));
          this.enviando.set(null);
          // Un 409 significa que la grilla que estamos viendo quedó vieja.
          if (e.status === 409) this.cargar();
        },
      });
  }

  private mensaje(e: HttpErrorResponse): string {
    if (e.status === 409) {
      return 'Alguien tomó ese turno mientras lo elegías. Mirá los que quedan libres.';
    }
    if (e.status === 400) {
      const detalle = e.error?.message;
      if (Array.isArray(detalle)) return detalle.join('. ');
      if (typeof detalle === 'string') return detalle;
      return 'El turno no es válido.';
    }
    return 'No pudimos confirmar el turno. Probá de nuevo.';
  }
}
