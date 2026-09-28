import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Usuario } from '../../models/usuario.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario = signal<Usuario | null>(null);
  readonly cargando = signal(true);

  /** Lo que guardamos al loguear, para mostrarlo mientras llega el pedido. */
  readonly enSesion = this.auth.usuario;
  readonly esGestor = this.auth.esGestor;

  ngOnInit(): void {
    // Pedirlo al backend en vez de leer el localStorage es lo que prueba que
    // el interceptor está mandando el token: sin Bearer esto sería un 401.
    this.auth.perfil().subscribe({
      next: (usuario) => {
        this.usuario.set(usuario);
        this.cargando.set(false);
      },
      // El 401 ya lo maneja el interceptor (cierra sesión y manda al login).
      error: () => this.cargando.set(false),
    });
  }

  salir(): void {
    this.auth.cerrarSesion();
    void this.router.navigateByUrl('/');
  }
}
