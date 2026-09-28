import { HttpErrorResponse } from '@angular/common/http';
import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reserva } from '../../models/reserva.model';
import { ReservasService } from '../../services/reservas.service';
import { fechaLarga, hhmm, turnoPasado } from '../../utils/fechas';

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './mis-reservas.html',
  styleUrl: './mis-reservas.css',
})
export class MisReservas implements OnInit {
  private readonly reservas = inject(ReservasService);

  readonly lista = signal<Reserva[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly cancelando = signal<number | null>(null);

  /** Las próximas primero; dentro del día, por hora. */
  readonly ordenadas = computed(() =>
    [...this.lista()].sort((a, b) =>
      b.fecha === a.fecha
        ? a.horaInicio.localeCompare(b.horaInicio)
        : b.fecha.localeCompare(a.fecha),
    ),
  );

  readonly fechaLarga = fechaLarga;
  readonly hhmm = hhmm;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.reservas.listarMias().subscribe({
      next: (reservas) => {
        this.lista.set(reservas);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos traer tus reservas del servidor.');
        this.cargando.set(false);
      },
    });
  }

  /** El backend rechaza cancelar un turno pasado: no ofrecemos el botón. */
  cancelable(reserva: Reserva): boolean {
    return (
      reserva.estado === 'CONFIRMADA' &&
      !turnoPasado(reserva.fecha, reserva.horaInicio)
    );
  }

  cancelar(reserva: Reserva): void {
    if (this.cancelando()) return;

    const cuando = `${fechaLarga(reserva.fecha)} a las ${hhmm(reserva.horaInicio)}`;
    if (!confirm(`¿Cancelar el turno en ${reserva.cancha.nombre}, ${cuando}?`)) {
      return;
    }

    this.cancelando.set(reserva.id);
    this.error.set(null);

    this.reservas.cancelar(reserva.id).subscribe({
      next: (actualizada) => {
        // Reemplazamos la fila con lo que devolvió el backend, sin recargar todo.
        this.lista.update((reservas) =>
          reservas.map((r) => (r.id === actualizada.id ? actualizada : r)),
        );
        this.cancelando.set(null);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 409
            ? 'Esa reserva ya estaba cancelada.'
            : 'No pudimos cancelar el turno. Probá de nuevo.',
        );
        this.cancelando.set(null);
        this.cargar();
      },
    });
  }
}
