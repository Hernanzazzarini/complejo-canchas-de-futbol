import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Cancha } from '../../models/cancha.model';
import { CanchasService } from '../../services/canchas.service';

@Component({
  selector: 'app-canchas',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './canchas.html',
  styleUrl: './canchas.css',
})
export class Canchas implements OnInit {
  private readonly canchasService = inject(CanchasService);

  readonly canchas = signal<Cancha[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.canchasService.listar().subscribe({
      next: (canchas) => {
        this.canchas.set(canchas);
        this.cargando.set(false);
      },
      error: () => {
        // Casi siempre es el backend apagado: el navegador no distingue
        // "no hay servidor" de "CORS rechazó", ambos llegan como status 0.
        this.error.set(
          'No pudimos conectarnos con el servidor. Verificá que la API esté levantada.',
        );
        this.cargando.set(false);
      },
    });
  }
}
