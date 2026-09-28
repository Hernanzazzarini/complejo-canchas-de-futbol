import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Signals del service: el header se redibuja solo al entrar o salir. */
  readonly usuario = this.auth.usuario;
  readonly esGestor = this.auth.esGestor;

  salir(): void {
    this.auth.cerrarSesion();
    void this.router.navigateByUrl('/');
  }
}
