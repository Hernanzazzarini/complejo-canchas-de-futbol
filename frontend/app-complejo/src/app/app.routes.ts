import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { authGuard, rolGuard } from './guards/auth.guard';

export const routes: Routes = [
   { path: '', component: Home },
   {
     // Lazy: el bundle de canchas se baja recién cuando se entra a la ruta.
     path: 'canchas',
     loadComponent: () =>
       import('./components/canchas/canchas').then((m) => m.Canchas),
   },
   {
     // Sin guard: la grilla es pública, como GET /reservas/disponibilidad.
     // El login se pide recién al tocar un turno.
     path: 'reservar/:canchaId',
     loadComponent: () =>
       import('./components/reservar/reservar').then((m) => m.Reservar),
   },
   {
     path: 'mis-reservas',
     canActivate: [authGuard],
     loadComponent: () =>
       import('./components/mis-reservas/mis-reservas').then(
         (m) => m.MisReservas,
       ),
   },
   {
     // El panel de gestión. El guard de rol es comodidad de navegación: quien
     // manda es el RolesGuard del backend, que es el que ve el token.
     path: 'panel',
     canActivate: [rolGuard('ADMIN', 'PROPIETARIO')],
     loadComponent: () =>
       import('./components/panel/panel').then((m) => m.Panel),
     children: [
       { path: '', redirectTo: 'canchas', pathMatch: 'full' },
       {
         path: 'canchas',
         loadComponent: () =>
           import('./components/panel/canchas/panel-canchas').then(
             (m) => m.PanelCanchas,
           ),
       },
       {
         path: 'agenda',
         loadComponent: () =>
           import('./components/panel/agenda/panel-agenda').then(
             (m) => m.PanelAgenda,
           ),
       },
       {
         path: 'propietarios',
         canActivate: [rolGuard('ADMIN')],
         loadComponent: () =>
           import('./components/panel/propietarios/panel-propietarios').then(
             (m) => m.PanelPropietarios,
           ),
       },
     ],
   },
   {
     path: 'login',
     loadComponent: () => import('./components/login/login').then((m) => m.Login),
   },
   {
     path: 'registro',
     loadComponent: () =>
       import('./components/registro/registro').then((m) => m.Registro),
   },
   {
     path: 'perfil',
     canActivate: [authGuard],
     loadComponent: () =>
       import('./components/perfil/perfil').then((m) => m.Perfil),
   },
   { path: '**', redirectTo: '' },
];
