import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrls: ['../shared/auth-form.css'],
})
export class Registro {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  // Los validadores copian los de RegisterDto: si acá pasa, el backend acepta.
  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    telefono: [''],
  });

  enviar(): void {
    if (this.formulario.invalid || this.enviando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { nombre, email, password, telefono } = this.formulario.getRawValue();
    // El backend rechaza propiedades desconocidas y `telefono` es opcional:
    // mandarlo vacío sería un string sin sentido guardado en la base.
    const datos = {
      nombre,
      email,
      password,
      ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
    };

    // register no devuelve token, así que encadenamos el login para que el
    // usuario no tenga que escribir lo mismo dos veces.
    this.auth
      .registrar(datos)
      .pipe(switchMap(() => this.auth.login({ email, password })))
      .subscribe({
        next: () => void this.router.navigateByUrl('/perfil'),
        error: (e: HttpErrorResponse) => {
          this.error.set(this.mensaje(e));
          this.enviando.set(false);
        },
      });
  }

  invalido(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.invalid && control.touched;
  }

  private mensaje(e: HttpErrorResponse): string {
    if (e.status === 409) return 'Ese email ya está registrado.';
    // El ValidationPipe del backend devuelve `message` como array de strings.
    if (e.status === 400) {
      const detalle = e.error?.message;
      return Array.isArray(detalle) ? detalle.join('. ') : 'Revisá los datos.';
    }
    return 'No pudimos conectarnos con el servidor. Verificá que la API esté levantada.';
  }
}
