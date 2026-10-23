import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService, AuthUser } from './auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <h1 tabindex="-1" #heading>GastoHogar</h1>
    @if (loading()) { <p role="status">Cargando perfil…</p> }
    @if (user(); as profile) {
      <p>Bienvenido/a, {{ profile.name }}</p>
      <p>Email: {{ profile.email }}</p>
    }
    @if (error()) { <p role="alert">{{ error() }}</p> }
    <nav aria-label="Navegación principal"><a routerLink="/gastos">Ver mis gastos</a></nav>
    <button type="button" (click)="logout()">Cerrar sesión</button>
  `,
})
export class Home {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly user = signal<AuthUser | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.auth.profile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (user) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) {
          this.logout();
        } else {
          this.error.set('No se pudo cargar tu perfil. Intentá nuevamente más tarde.');
        }
      },
    });
  }

  ngAfterViewInit(): void {
    this.heading().nativeElement.focus();
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
