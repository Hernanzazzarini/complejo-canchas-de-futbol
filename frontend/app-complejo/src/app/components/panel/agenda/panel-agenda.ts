import { HttpErrorResponse } from '@angular/common/http';
import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Cancha } from '../../../models/cancha.model';
import { Reserva } from '../../../models/reserva.model';
import { CanchasService } from '../../../services/canchas.service';
import { ReservasService } from '../../../services/reservas.service';
import { fechaLarga, hhmm, hoyISO, turnoPasado } from '../../../utils/fechas';

@Component({
  selector: 'app-panel-agenda',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './panel-agenda.html',
  styleUrls: ['../panel-widgets.css', './panel-agenda.css'],
})
export class PanelAgenda implements OnInit {
  private readonly reservas = inject(ReservasService);
  private readonly canchasService = inject(CanchasService);

  readonly fecha = signal(hoyISO());
  readonly canchaId = signal(0);

  readonly canchas = signal<Cancha[]>([]);
  readonly lista = signal<Reserva[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly cancelando = signal<number | null>(null);

  /** Por hora de inicio: es como se lee una agenda del día. */
  readonly ordenadas = computed(() =>
    [...this.lista()].sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.horaInicio.localeCompare(b.horaInicio),
    ),
  );

  readonly confirmadas = computed(() =>
    this.ordenadas().filter((r) => r.estado === 'CONFIRMADA'),
  );

  readonly recaudacion = computed(() =>
    this.confirmadas().reduce((total, r) => total + Number(r.precioTotal), 0),
  );

  readonly tituloFecha = computed(() =>
    this.fecha() ? fechaLarga(this.fecha()) : 'Todas las fechas',
  );

  readonly fechaLarga = fechaLarga;
  readonly hhmm = hhmm;

  ngOnInit(): void {
    this.canchasService.listarPropias().subscribe({
      next: (canchas) => this.canchas.set(canchas),
      error: () => this.canchas.set([]),
    });
    this.cargar();
  }

  cambiarFecha(valor: string): void {
    this.fecha.set(valor);
    this.cargar();
  }

  cambiarCancha(valor: string): void {
    this.canchaId.set(Number(valor));
    this.cargar();
  }

  verTodas(): void {
    this.fecha.set('');
    this.cargar();
  }

  hoy(): void {
    this.fecha.set(hoyISO());
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.reservas
      .listarTodas({
        fecha: this.fecha() || undefined,
        canchaId: this.canchaId() || undefined,
      })
      .subscribe({
        next: (reservas) => {
          this.lista.set(reservas);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set('No pudimos traer la agenda del servidor.');
          this.cargando.set(false);
        },
      });
  }

  cancelable(reserva: Reserva): boolean {
    return (
      reserva.estado === 'CONFIRMADA' &&
      !turnoPasado(reserva.fecha, reserva.horaInicio)
    );
  }

  cancelar(reserva: Reserva): void {
    if (this.cancelando()) return;

    const quien = reserva.usuario?.nombre ?? 'el cliente';
    const cuando = `${fechaLarga(reserva.fecha)} a las ${hhmm(reserva.horaInicio)}`;
    if (!confirm(`¿Cancelar el turno de ${quien} el ${cuando}?`)) return;

    this.cancelando.set(reserva.id);
    this.error.set(null);

    this.reservas.cancelar(reserva.id).subscribe({
      next: (actualizada) => {
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
