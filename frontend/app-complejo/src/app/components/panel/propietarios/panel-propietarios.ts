import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Usuario } from '../../../models/usuario.model';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-panel-propietarios',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './panel-propietarios.html',
  styleUrls: ['../panel-widgets.css', './panel-propietarios.css'],
})
export class PanelPropietarios implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly lista = signal<Usuario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly exito = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly mostrandoAlta = signal(false);

  // Mismos validadores que RegisterDto del backend.
  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    telefono: [''],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.auth.listarPropietarios().subscribe({
      next: (usuarios) => {
        this.lista.set(usuarios);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos traer los propietarios del servidor.');
        this.cargando.set(false);
      },
    });
  }

  crear(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    this.exito.set(null);

    const { nombre, email, password, telefono } = this.formulario.getRawValue();
    const datos = {
      nombre,
      email,
      password,
      ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
    };

    this.auth.crearPropietario(datos).subscribe({
      next: (nuevo) => {
        this.lista.update((usuarios) => [...usuarios, nuevo]);
        this.exito.set(
          `${nuevo.nombre} ya es PROPIETARIO. Pasale la contraseña que elegiste: el sistema no la muestra de nuevo.`,
        );
        this.formulario.reset();
        this.mostrandoAlta.set(false);
        this.guardando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(this.mensaje(e));
        this.guardando.set(false);
      },
    });
  }

  invalido(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.invalid && control.touched;
  }

  private mensaje(e: HttpErrorResponse): string {
    if (e.status === 409) return 'Ese email ya está registrado.';
    if (e.status === 403) return 'Sólo el ADMIN puede dar de alta propietarios.';
    if (e.status === 400) {
      const detalle = e.error?.message;
      if (Array.isArray(detalle)) return detalle.join('. ');
    }
    return 'No pudimos crear el propietario. Probá de nuevo.';
  }
}
