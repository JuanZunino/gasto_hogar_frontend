import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: 'login', title: 'Iniciar sesión | GastoHogar', loadComponent: () => import('./auth/login').then(m => m.Login) },
  { path: 'inicio', title: 'Inicio | GastoHogar', canActivate: [authGuard], loadComponent: () => import('./auth/home').then(m => m.Home) },
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  { path: '**', redirectTo: 'inicio' },
];
