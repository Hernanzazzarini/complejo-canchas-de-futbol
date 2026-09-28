import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel {
  private readonly auth = inject(AuthService);

  readonly usuario = this.auth.usuario;
  readonly esAdmin = this.auth.esAdmin;
}
