import { HttpErrorResponse } from '@angular/common/http';
import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Cancha } from '../../../models/cancha.model';
import { Usuario } from '../../../models/usuario.model';
import { AuthService } from '../../../services/auth.service';
import { CanchasService } from '../../../services/canchas.service';

@Component({
  selector: 'app-panel-canchas',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule],
  templateUrl: './panel-canchas.html',
  styleUrls: ['../panel-widgets.css', './panel-canchas.css'],
})
export class PanelCanchas implements OnInit {
  private readonly canchasService = inject(CanchasService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly esAdmin = this.auth.esAdmin;

  readonly canchas = signal<Cancha[]>([]);
  readonly propietarios = signal<Usuario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);

  /** Id de la cancha abierta en edición, y la que tiene una acción en curso. */
  readonly editando = signal<number | null>(null);
  readonly ocupada = signal<number | null>(null);
  readonly mostrandoAlta = signal(false);
  readonly guardandoAlta = signal(false);

  readonly activas = computed(() => this.canchas().filter((c) => c.activa));
  readonly inactivas = computed(() => this.canchas().filter((c) => !c.activa));

  // Un solo formulario que se rellena con la fila que se abre: armar uno por
  // cancha sería tirar y recrear FormGroups en cada render.
  readonly formEdicion = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    precioPorHora: [0, [Validators.required, Validators.min(0.01)]],
    techada: [false],
  });

  readonly formAlta = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    precioPorHora: [0, [Validators.required, Validators.min(0.01)]],
    techada: [false],
    propietarioId: [0, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.cargar();
    // El alta pide un dueño por id, así que el ADMIN necesita la lista para
    // elegirlo de un desplegable en vez de adivinar el número.
    if (this.esAdmin()) {
      this.auth.listarPropietarios().subscribe({
        next: (usuarios) => this.propietarios.set(usuarios),
        error: () => this.propietarios.set([]),
      });
    }
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.canchasService.listarPropias().subscribe({
      next: (canchas) => {
        this.canchas.set(canchas);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos traer tus canchas del servidor.');
        this.cargando.set(false);
      },
    });
  }

  abrirEdicion(cancha: Cancha): void {
    this.editando.set(cancha.id);
    this.exito.set(null);
    this.formEdicion.setValue({
      nombre: cancha.nombre,
      precioPorHora: cancha.precioPorHora,
      techada: cancha.techada,
    });
  }

  cerrarEdicion(): void {
    this.editando.set(null);
  }

  guardarEdicion(cancha: Cancha): void {
    if (this.formEdicion.invalid) {
      this.formEdicion.markAllAsTouched();
      return;
    }

    this.ocupada.set(cancha.id);
    this.error.set(null);

    this.canchasService
      .actualizar(cancha.id, this.formEdicion.getRawValue())
      .subscribe({
        next: (actualizada) => {
          this.reemplazar(actualizada);
          this.exito.set(`"${actualizada.nombre}" quedó actualizada.`);
          this.editando.set(null);
          this.ocupada.set(null);
        },
        error: (e: HttpErrorResponse) => {
          this.error.set(this.mensaje(e));
          this.ocupada.set(null);
        },
      });
  }

  darDeBaja(cancha: Cancha): void {
    const aviso =
      `¿Dar de baja "${cancha.nombre}"?\n\n` +
      'Deja de aparecer en el listado público y no se puede reservar. ' +
      'Las reservas ya hechas se conservan y la podés reactivar cuando quieras.';
    if (!confirm(aviso)) return;

    this.ocupada.set(cancha.id);
    this.error.set(null);

    this.canchasService.desactivar(cancha.id).subscribe({
      next: (actualizada) => {
        this.reemplazar(actualizada);
        this.exito.set(`"${actualizada.nombre}" quedó fuera del listado.`);
        this.ocupada.set(null);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(this.mensaje(e));
        this.ocupada.set(null);
      },
    });
  }

  reactivar(cancha: Cancha): void {
    this.ocupada.set(cancha.id);
    this.error.set(null);

    this.canchasService.reactivar(cancha.id).subscribe({
      next: (actualizada) => {
        this.reemplazar(actualizada);
        this.exito.set(`"${actualizada.nombre}" volvió al listado público.`);
        this.ocupada.set(null);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(this.mensaje(e));
        this.ocupada.set(null);
      },
    });
  }

  crear(): void {
    if (this.formAlta.invalid) {
      this.formAlta.markAllAsTouched();
      return;
    }

    this.guardandoAlta.set(true);
    this.error.set(null);

    // Un <select> siempre entrega strings: el tipo dice number pero en runtime
    // llegaría "9". El backend lo convertiría igual, pero mejor no depender de eso.
    const datos = {
      ...this.formAlta.getRawValue(),
      propietarioId: Number(this.formAlta.controls.propietarioId.value),
    };

    this.canchasService.crear(datos).subscribe({
      next: (nueva) => {
        this.canchas.update((canchas) => [...canchas, nueva]);
        this.exito.set(`"${nueva.nombre}" dada de alta.`);
        this.formAlta.reset({ nombre: '', precioPorHora: 0, techada: false, propietarioId: 0 });
        this.mostrandoAlta.set(false);
        this.guardandoAlta.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(this.mensaje(e));
        this.guardandoAlta.set(false);
      },
    });
  }

  nombrePropietario(id: number): string {
    return this.propietarios().find((p) => p.id === id)?.nombre ?? `#${id}`;
  }

  // Recibe el FormGroup en vez de su nombre: indexar `this` devuelve la unión
  // de los dos tipados y TypeScript no unifica sus sobrecargas de get().
  invalido(formulario: FormGroup, campo: string): boolean {
    const control = formulario.get(campo);
    return !!control && control.invalid && control.touched;
  }

  private reemplazar(cancha: Cancha): void {
    this.canchas.update((canchas) =>
      canchas.map((c) => (c.id === cancha.id ? cancha : c)),
    );
  }

  private mensaje(e: HttpErrorResponse): string {
    if (e.status === 409) return 'Ese dueño ya tiene una cancha con ese nombre.';
    // El backend devuelve 404 —no 403— cuando la cancha es de otro dueño:
    // un 403 confirmaría que el id existe.
    if (e.status === 404) return 'Esa cancha no existe o no es tuya.';
    if (e.status === 400) {
      const detalle = e.error?.message;
      if (Array.isArray(detalle)) return detalle.join('. ');
      if (typeof detalle === 'string') return detalle;
    }
    return 'No pudimos guardar los cambios. Probá de nuevo.';
  }
}
