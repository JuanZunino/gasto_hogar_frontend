import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: 'login', title: 'Iniciar sesión | GastoHogar', loadComponent: () => import('./auth/login').then(m => m.Login) },
  { path: 'inicio', title: 'Inicio | GastoHogar', canActivate: [authGuard], data: { authenticatedLayout: true }, loadComponent: () => import('./auth/home').then(m => m.Home) },
  { path: 'dashboard', title: 'Resumen de gastos | GastoHogar', canActivate: [authGuard], data: { authenticatedLayout: true }, loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'gastos/nuevo', title: 'Nuevo gasto | GastoHogar', canActivate: [authGuard], data: { authenticatedLayout: true }, loadComponent: () => import('./expenses/new-expense').then(m => m.NewExpense) },
  { path: 'gastos/:id/editar', title: 'Editar gasto | GastoHogar', canActivate: [authGuard], data: { authenticatedLayout: true }, loadComponent: () => import('./expenses/new-expense').then(m => m.NewExpense) },
  { path: 'gastos', title: 'Mis gastos | GastoHogar', canActivate: [authGuard], data: { authenticatedLayout: true }, loadComponent: () => import('./expenses/expenses').then(m => m.Expenses) },
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  { path: '**', redirectTo: 'inicio' },
];
